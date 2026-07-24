/**
 * src/pages/Chat.jsx
 * Route: /chat/:threadId
 *
 * Real-time chat with:
 * - Socket.IO messaging
 * - Offers / Counter-offers
 * - Multi-image upload  (max 10 | 5 MB each)
 * - Multi-video upload  (max 3  | 10 MB each | 60 sec)
 * - Location sharing
 * - Product sharing
 * - Context menu
 * - Typing indicators
 */

import {
  useEffect, useState, useRef,
  useCallback, useMemo, useReducer,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io }  from "socket.io-client";
import axios   from "axios";

import ChatHeader        from "./chat/ChatHeader";
import SuggestionsBar    from "./chat/SuggestionsBar";
import MakeOfferModal    from "./chat/MakeOfferModal";
import CounterOfferModal from "./chat/CounterOfferModal";
import LocationModal     from "./chat/LocationModal";
import ContextMenu       from "./chat/ContextMenu";
import ReportModal       from "./chat/ReportModal";
import DeleteChatConfirm from "./chat/DeleteChatConfirm";
import Bubble, { TypingBubble, DateSep } from "./chat/Bubble";
import { Icon } from "./chat/icons";
import {
  MESSAGE_TYPES, OFFER_STATUS, CURRENCY,
  authH, dedupe, groupByDate,
  pickSuggestions, truncate,
} from "./chat/constants";

import "../styles/Chat.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const BASE         = import.meta.env.VITE_API_BASE_URL;
const API          = `${BASE}/api`;
const SOCKET_URL   = BASE;
const SEND_TIMEOUT = 15_000;

/* ═══════════════════════════════════════════════════════════════
   UPLOAD LIMITS  (must match server)
═══════════════════════════════════════════════════════════════ */
const IMAGE_MAX_COUNT   = 10;
const IMAGE_MAX_BYTES   = 5  * 1024 * 1024;   // 5  MB
const VIDEO_MAX_COUNT   = 3;
const VIDEO_MAX_BYTES   = 10 * 1024 * 1024;   // 10 MB
const VIDEO_MAX_SECONDS = 60;

/* ═══════════════════════════════════════════════════════════════
   MESSAGE REDUCER
═══════════════════════════════════════════════════════════════ */
function msgsReducer(state, action) {
  switch (action.type) {

    case "SET":
      return dedupe(action.payload);

    case "APPEND": {
      if (state.some((m) => m.id === action.payload.id)) return state;
      if (action.payload._temp && action.payload.client_message_id) {
        if (state.some(
          (m) => !m._temp &&
                 m.client_message_id === action.payload.client_message_id
        )) return state;
      }
      return dedupe([...state, action.payload]);
    }

    case "REPLACE": {
      let replaced = false;
      const next = state.map((m) => {
        if (m.id === action.tempId) { replaced = true; return action.payload; }
        if (
          !replaced && m._temp &&
          action.payload.client_message_id &&
          m.client_message_id === action.payload.client_message_id
        ) { replaced = true; return action.payload; }
        return m;
      });
      if (!replaced) {
        if (state.some((m) => m.id === action.payload.id)) return state;
        return dedupe([...state, action.payload]);
      }
      return next;
    }

    case "PATCH":
      return state.map((m) =>
        m.id === action.id ? { ...m, ...action.patch } : m
      );

    case "PATCH_OFFER":
      return state.map((m) =>
        m.id === action.id && m._offerMeta
          ? { ...m, _offerMeta: { ...m._offerMeta, status: action.status } }
          : m
      );

    case "SOFT_DELETE":
      return state.map((m) =>
        m.id === action.id ? { ...m, _deleted: true } : m
      );

    case "MARK_READ":
      return state.map((m) =>
        m.sender_id === action.myId && m.status !== "read"
          ? { ...m, status: "read" }
          : m
      );

    case "REMOVE":
      return state.filter((m) => m.id !== action.id);

    default:
      return state;
  }
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */

/** Read video duration from a File object */
function getClientVideoDuration(file) {
  return new Promise((resolve) => {
    const url   = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    video.src = url;
  });
}

/** Validate image files, return { valid, errors } */
function validateImages(files) {
  const errors = [];
  if (files.length > IMAGE_MAX_COUNT) {
    errors.push(`Max ${IMAGE_MAX_COUNT} images per message.`);
    return { valid: [], errors };
  }
  const valid = [];
  for (const f of files) {
    if (!f.type.startsWith("image/")) {
      errors.push(`"${f.name}" is not an image.`);
    } else if (f.size > IMAGE_MAX_BYTES) {
      errors.push(`"${f.name}" exceeds 5 MB.`);
    } else {
      valid.push(f);
    }
  }
  return { valid, errors };
}

/** Validate video files (async — needs duration check) */
async function validateVideos(files) {
  const errors = [];
  if (files.length > VIDEO_MAX_COUNT) {
    errors.push(`Max ${VIDEO_MAX_COUNT} videos per message.`);
    return { valid: [], errors };
  }
  const valid = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f.type.startsWith("video/")) {
      errors.push(`"${f.name}" is not a video.`);
      continue;
    }
    if (f.size > VIDEO_MAX_BYTES) {
      errors.push(`"${f.name}" exceeds 10 MB.`);
      continue;
    }
    const dur = await getClientVideoDuration(f);
    if (dur > VIDEO_MAX_SECONDS) {
      errors.push(
        `"${f.name}" is ${Math.round(dur)}s — max ${VIDEO_MAX_SECONDS}s.`
      );
      continue;
    }
    valid.push(f);
  }
  return { valid, errors };
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function Chat({ user }) {
  const { threadId } = useParams();
  const navigate     = useNavigate();

  /* ── Core state ── */
  const [messages,  dispatch]     = useReducer(msgsReducer, []);
  const [newMsg,    setNewMsg]    = useState("");
  const [otherUser, setOtherUser] = useState(null);
  const [product,   setProduct]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const [isTyping,  setIsTyping]  = useState(false);
  const [sockReady, setSockReady] = useState(false);
  const [error,     setError]     = useState(null);
  const [threadBuyerId, setThreadBuyerId] = useState(null);

  /* ── Upload state ── */
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingVideos, setUploadingVideos] = useState(false);

  /* ── UI state ── */
  const [showMenu,        setShowMenu]        = useState(false);
  const [muted,           setMuted]           = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showAttach,      setShowAttach]      = useState(false);
  const [lightboxSrcs,    setLightboxSrcs]    = useState(null); // { urls[], index }
  const [replyTo,         setReplyTo]         = useState(null);

  /* ── Context menu ── */
  const [ctxMsgId, setCtxMsgId] = useState(null);
  const [ctxPos,   setCtxPos]   = useState(null);

  /* ── Modals ── */
  const [offerModal,        setOfferModal]        = useState(false);
  const [counterModal,      setCounterModal]      = useState(null);
  const [locationModal,     setLocationModal]     = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportModal,   setShowReportModal]   = useState(false);

  /* ── Refs ── */
  const socketRef     = useRef(null);
  const bottomRef     = useRef(null);
  const inputRef      = useRef(null);
  const typingTimer   = useRef(null);
  const historyLoaded = useRef(false);
  const pendingMsgs   = useRef([]);
  const mounted       = useRef(true);
  const sendTimers    = useRef(new Map());
  const imageFileRef  = useRef(null);   // gallery (images)
  const videoFileRef  = useRef(null);   // gallery (videos)
  const cameraRef     = useRef(null);   // camera capture

  const newMsgRef  = useRef("");
  const sendingRef = useRef(false);
  useEffect(() => { newMsgRef.current  = newMsg;  }, [newMsg]);
  useEffect(() => { sendingRef.current = sending; }, [sending]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const safe = useCallback((fn) => { if (mounted.current) fn(); }, []);

  /* ── Derived ── */
  const suggestions = useMemo(
    () => pickSuggestions(messages, user?.id),
    [messages, user?.id]
  );
  const msgMap = useMemo(() => {
    const m = new Map();
    messages.forEach((msg) => m.set(msg.id, msg));
    return m;
  }, [messages]);

  const grouped     = useMemo(() => groupByDate(messages), [messages]);
  const canSend     = newMsg.trim().length > 0 && !sending;
  const isBuyerUser = threadBuyerId === user?.id;

  /* ══════════════════════════════════════════════════════════
     THREAD META
  ══════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!threadId || !user?.id) return;
    const ctrl = new AbortController();

    axios
      .get(`${API}/conversations/${threadId}`, {
        headers: authH(), signal: ctrl.signal, timeout: 8_000,
      })
      .then(({ data }) => {
        const oid =
          data.other_user_id ||
          (data.buyer_id === user.id ? data.seller_id : data.buyer_id);

        safe(() => setThreadBuyerId(data.buyer_id));
        safe(() => setOtherUser({
          id           : oid,
          name         : data.other_user_name  || "User",
          profile_image: data.other_user_image || null,
          is_online    : data.other_user_online || false,
          store_name   : data.other_user_store  || "",
          last_login   : data.last_login        || null,
        }));

        if (data.product_title) {
          safe(() => setProduct({
            title : data.product_title,
            images: data.product_image ? [data.product_image] : [],
            price : data.product_price,
            id    : data.product_id,
            slug  : data.product_slug || data.product_id,
          }));
        }

        if (oid) {
          axios.get(`${API}/users/${oid}`, { headers: authH() })
            .then(({ data: u }) =>
              safe(() => setOtherUser((p) => ({
                ...p, ...u,
                is_online: p?.is_online || u.is_online || false,
              })))
            )
            .catch(() => {});
        }
      })
      .catch(() => {});

    return () => ctrl.abort();
  }, [threadId, user?.id]); // eslint-disable-line

  /* ══════════════════════════════════════════════════════════
     SOCKET
  ══════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!user?.id || !threadId) return;

    const sock = io(SOCKET_URL, {
      transports          : ["websocket", "polling"],
      withCredentials     : false,
      query               : { userId: user.id },
      reconnection        : true,
      reconnectionAttempts: 10,
      reconnectionDelay   : 1500,
    });
    socketRef.current = sock;

    const onConnect    = () => {
      sock.emit("joinThread", { threadId, userId: user.id });
      safe(() => setSockReady(true));
    };
    const onDisconnect = () => safe(() => setSockReady(false));
    const onReconnect  = (n) => console.log(`[socket] reconnect #${n}`);

    const onReceive = (msg) => {
      if (!msg?.id || msg.sender_id === user.id) return;
      if (!historyLoaded.current) { pendingMsgs.current.push(msg); return; }
      safe(() => dispatch({ type: "APPEND", payload: msg }));
      sock.emit("markRead", { threadId, userId: user.id });
      axios
        .patch(`${API}/conversations/${threadId}/read`,
          { userId: user.id }, { headers: authH() })
        .catch(() => {});
    };

    const onRead = ({ userId: uid }) => {
      if (uid === user.id) return;
      safe(() => dispatch({ type: "MARK_READ", myId: user.id }));
    };

    const onTyping     = () => safe(() => setIsTyping(true));
    const onStopTyping = () => safe(() => setIsTyping(false));

    const onDeleted = ({ messageId }) =>
      safe(() => dispatch({ type: "SOFT_DELETE", id: messageId }));

    const onOfferUpdated = ({ messageId, status }) =>
      safe(() => dispatch({ type: "PATCH_OFFER", id: messageId, status }));

    const onOnline  = ({ userId: uid }) => {
      if (uid !== user.id)
        safe(() => setOtherUser((p) => p ? { ...p, is_online: true  } : p));
    };
    const onOffline = ({ userId: uid }) => {
      if (uid !== user.id)
        safe(() => setOtherUser((p) => p ? { ...p, is_online: false } : p));
    };

    sock.on("connect",           onConnect);
    sock.on("disconnect",        onDisconnect);
    sock.on("reconnect_attempt", onReconnect);
    sock.on("receiveMessage",    onReceive);
    sock.on("messagesRead",      onRead);
    sock.on("userTyping",        onTyping);
    sock.on("userStopTyping",    onStopTyping);
    sock.on("messageDeleted",    onDeleted);
    sock.on("offerUpdated",      onOfferUpdated);
    sock.on("userOnline",        onOnline);
    sock.on("userOffline",       onOffline);

    return () => {
      sock.off("connect",           onConnect);
      sock.off("disconnect",        onDisconnect);
      sock.off("reconnect_attempt", onReconnect);
      sock.off("receiveMessage",    onReceive);
      sock.off("messagesRead",      onRead);
      sock.off("userTyping",        onTyping);
      sock.off("userStopTyping",    onStopTyping);
      sock.off("messageDeleted",    onDeleted);
      sock.off("offerUpdated",      onOfferUpdated);
      sock.off("userOnline",        onOnline);
      sock.off("userOffline",       onOffline);
      sock.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, threadId]); // eslint-disable-line

  /* ══════════════════════════════════════════════════════════
     LOAD HISTORY
  ══════════════════════════════════════════════════════════ */
  const loadHistory = useCallback(async () => {
    if (!user?.id || !threadId) return;
    historyLoaded.current = false;
    pendingMsgs.current   = [];
    safe(() => { setLoading(true); setError(null); });

    try {
      const { data } = await axios.get(`${API}/messages`, {
        params : { threadId, userId: user.id },
        headers: authH(),
        timeout: 12_000,
      });

      const all = dedupe([
        ...(Array.isArray(data) ? data : []),
        ...pendingMsgs.current,
      ]);

      pendingMsgs.current   = [];
      historyLoaded.current = true;
      safe(() => dispatch({ type: "SET", payload: all }));

      socketRef.current?.emit("markRead", { threadId, userId: user.id });
      axios
        .patch(`${API}/conversations/${threadId}/read`,
          { userId: user.id }, { headers: authH() })
        .catch(() => {});

    } catch (err) {
      safe(() =>
        setError(
          `${err.response?.status ?? "Network"} — ${
            err.response?.data?.message ?? err.message
          }`
        )
      );
    } finally {
      safe(() => setLoading(false));
    }
  }, [user?.id, threadId, safe]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  /* ══════════════════════════════════════════════════════════
     AUTO-SCROLL
  ══════════════════════════════════════════════════════════ */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  /* ══════════════════════════════════════════════════════════
     TYPING
  ══════════════════════════════════════════════════════════ */
  const handleTyping = useCallback(() => {
    socketRef.current?.emit("typing", { threadId, userId: user?.id });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit("stopTyping", { threadId, userId: user?.id });
    }, 1500);
  }, [threadId, user?.id]);

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  /* ══════════════════════════════════════════════════════════
     CORE SEND  (text / offer / location / product)
  ══════════════════════════════════════════════════════════ */
  const doSend = useCallback(async (text, extras = {}) => {
    if (!text || typeof text !== "string") return;
    const trimmed = text.trim();
    if (!trimmed || sendingRef.current || !user?.id || !threadId) return;

    const clientMsgId = `${user.id}_${Date.now()}`;
    const tempId      = `temp_${clientMsgId}`;
    const replyRef    = replyTo ? { reply_to_id: replyTo.id } : {};

    const msgType =
      extras.offerMeta      ? MESSAGE_TYPES.OFFER
      : extras.location     ? MESSAGE_TYPES.LOCATION
      : extras.shared_product ? MESSAGE_TYPES.PRODUCT
      : MESSAGE_TYPES.TEXT;

    const temp = {
      id               : tempId,
      client_message_id: clientMsgId,
      thread_id        : threadId,
      sender_id        : user.id,
      message          : trimmed,
      message_type     : msgType,
      created_at       : new Date().toISOString(),
      status           : "sending",
      _temp            : true,
      _failed          : false,
      _timedOut        : false,
      ...replyRef,
      ...(extras.offerMeta      ? { _offerMeta:    extras.offerMeta }      : {}),
      ...(extras.location       ? { location:       extras.location }       : {}),
      ...(extras.shared_product ? { shared_product: extras.shared_product } : {}),
    };

    dispatch({ type: "APPEND", payload: temp });
    setNewMsg("");
    setSending(true);
    sendingRef.current = true;
    setShowSuggestions(false);
    setReplyTo(null);

    clearTimeout(typingTimer.current);
    socketRef.current?.emit("stopTyping", { threadId, userId: user.id });

    const timer = setTimeout(() => {
      if (mounted.current) {
        dispatch({ type: "PATCH", id: tempId,
          patch: { _temp: false, _timedOut: true } });
        setSending(false);
        sendingRef.current = false;
      }
    }, SEND_TIMEOUT);
    sendTimers.current.set(tempId, timer);

    try {
      const { data: saved } = await axios.post(
        `${API}/messages`,
        {
          threadId,
          senderId        : user.id,
          message         : trimmed,
          messageType     : msgType,
          clientMessageId : clientMsgId,
          ...replyRef,
          ...(extras.offerMeta      ? { offerMeta:     extras.offerMeta }      : {}),
          ...(extras.location       ? { location:      extras.location }       : {}),
          ...(extras.shared_product ? { sharedProduct: extras.shared_product } : {}),
        },
        { headers: authH(), timeout: SEND_TIMEOUT }
      );

      clearTimeout(sendTimers.current.get(tempId));
      sendTimers.current.delete(tempId);

      const final = {
        ...saved,
        ...(extras.offerMeta      ? { _offerMeta:    extras.offerMeta }      : {}),
        ...(extras.location       ? { location:       extras.location }       : {}),
        ...(extras.shared_product ? { shared_product: extras.shared_product } : {}),
      };

      if (mounted.current)
        dispatch({ type: "REPLACE", tempId, payload: final });

      socketRef.current?.emit("sendMessage", final);

    } catch (err) {
      clearTimeout(sendTimers.current.get(tempId));
      sendTimers.current.delete(tempId);
      console.error("Send error:", err.response?.data ?? err.message);

      if (mounted.current) {
        dispatch({ type: "PATCH", id: tempId,
          patch: { _temp: false, _failed: true, _timedOut: false } });
        setNewMsg(trimmed);
      }
    } finally {
      if (mounted.current) { setSending(false); sendingRef.current = false; }
      inputRef.current?.focus();
    }
  }, [threadId, user?.id, replyTo]); // eslint-disable-line

  const handleSend = useCallback((e) => {
    if (e?.preventDefault) e.preventDefault();
    const text = newMsgRef.current.trim();
    if (!text) return;
    doSend(text);
  }, [doSend]);

  const sendMessage = useCallback((overrideText, extras = {}) => {
    const text =
      typeof overrideText === "string" && overrideText.trim()
        ? overrideText.trim()
        : newMsgRef.current.trim();
    if (!text) return;
    doSend(text, extras);
  }, [doSend]);

  /* ══════════════════════════════════════════════════════════
     IMAGE UPLOAD  (multi — max 10 | 5 MB each)
  ══════════════════════════════════════════════════════════ */
  const handleImageChange = useCallback(async (e) => {
    const raw = Array.from(e.target.files || []);
    e.target.value = "";
    setShowAttach(false);
    if (!raw.length) return;

    /* validate */
    const { valid, errors } = validateImages(raw);
    if (errors.length) { alert(errors.join("\n")); return; }
    if (!valid.length) return;

    const clientMsgId = `${user.id}_${Date.now()}`;
    const tempId      = `temp_${clientMsgId}`;

    /* build local preview URLs */
    const localUrls = valid.map((f) => URL.createObjectURL(f));
    const count     = valid.length;
    const preview   = count === 1 ? "Photo" : `${count} Photos`;

    /* optimistic temp bubble */
    dispatch({
      type: "APPEND",
      payload: {
        id               : tempId,
        client_message_id: clientMsgId,
        thread_id        : threadId,
        sender_id        : user.id,
        message          : preview,
        message_type     : MESSAGE_TYPES.MEDIA,
        media_url        : localUrls,       // array of blob URLs
        created_at       : new Date().toISOString(),
        status           : "sending",
        _temp            : true,
        _failed          : false,
        _timedOut        : false,
        ...(replyTo ? { reply_to_id: replyTo.id } : {}),
      },
    });

    setUploadingImages(true);
    setReplyTo(null);

    try {
      const form = new FormData();
      valid.forEach((f) => form.append("files", f));
      form.append("threadId",        threadId);
      form.append("senderId",        user.id);
      form.append("clientMessageId", clientMsgId);
      if (replyTo) form.append("reply_to_id", replyTo.id);

      const { data: saved } = await axios.post(
        `${API}/messages/upload`,
        form,
        {
          headers: { ...authH(), "Content-Type": "multipart/form-data" },
          timeout: 60_000,
        }
      );

      /* revoke blob URLs */
      localUrls.forEach((u) => URL.revokeObjectURL(u));

      if (mounted.current) {
        dispatch({ type: "REPLACE", tempId, payload: saved });
      }
      socketRef.current?.emit("sendMessage", saved);

    } catch (err) {
      console.error("Image upload failed:", err.message);
      localUrls.forEach((u) => URL.revokeObjectURL(u));
      if (mounted.current)
        dispatch({ type: "PATCH", id: tempId,
          patch: { _temp: false, _failed: true } });
    } finally {
      safe(() => setUploadingImages(false));
    }
  }, [threadId, user?.id, replyTo, safe]);

  /* ══════════════════════════════════════════════════════════
     VIDEO UPLOAD  (multi — max 3 | 10 MB each | 60 sec each)
  ══════════════════════════════════════════════════════════ */
  const handleVideoChange = useCallback(async (e) => {
    const raw = Array.from(e.target.files || []);
    e.target.value = "";
    setShowAttach(false);
    if (!raw.length) return;

    /* validate (async — duration check) */
    const { valid, errors } = await validateVideos(raw);
    if (errors.length) { alert(errors.join("\n")); return; }
    if (!valid.length) return;

    const clientMsgId = `${user.id}_${Date.now()}`;
    const tempId      = `temp_${clientMsgId}`;

    const localUrls = valid.map((f) => URL.createObjectURL(f));
    const count     = valid.length;
    const preview   = count === 1 ? "Video" : `${count} Videos`;

    /* optimistic temp bubble */
    dispatch({
      type: "APPEND",
      payload: {
        id               : tempId,
        client_message_id: clientMsgId,
        thread_id        : threadId,
        sender_id        : user.id,
        message          : preview,
        message_type     : MESSAGE_TYPES.VIDEO,
        media_url        : localUrls,
        created_at       : new Date().toISOString(),
        status           : "sending",
        _temp            : true,
        _failed          : false,
        _timedOut        : false,
        ...(replyTo ? { reply_to_id: replyTo.id } : {}),
      },
    });

    setUploadingVideos(true);
    setReplyTo(null);

    try {
      const form = new FormData();
      valid.forEach((f) => form.append("files", f));
      form.append("threadId",        threadId);
      form.append("senderId",        user.id);
      form.append("clientMessageId", clientMsgId);
      if (replyTo) form.append("reply_to_id", replyTo.id);

      const { data: saved } = await axios.post(
        `${API}/messages/upload-video`,
        form,
        {
          headers: { ...authH(), "Content-Type": "multipart/form-data" },
          timeout: 60_000,
        }
      );

      localUrls.forEach((u) => URL.revokeObjectURL(u));

      if (mounted.current)
        dispatch({ type: "REPLACE", tempId, payload: saved });

      socketRef.current?.emit("sendMessage", saved);

    } catch (err) {
      console.error("Video upload failed:", err.message);
      localUrls.forEach((u) => URL.revokeObjectURL(u));
      if (mounted.current)
        dispatch({ type: "PATCH", id: tempId,
          patch: { _temp: false, _failed: true } });
    } finally {
      safe(() => setUploadingVideos(false));
    }
  }, [threadId, user?.id, replyTo, safe]);

  /* ══════════════════════════════════════════════════════════
     OFFER HANDLERS
  ══════════════════════════════════════════════════════════ */
  const handleSendOffer = useCallback((offerMeta) => {
    const label = `Offer: ${CURRENCY}${offerMeta.amount.toLocaleString()}`;
    sendMessage(label, { offerMeta });
  }, [sendMessage]);

  const handleOfferRespond = useCallback((origMsg, action) => {
    if (action === OFFER_STATUS.COUNTERED) {
      setCounterModal(origMsg);
      return;
    }
    if (mounted.current)
      dispatch({ type: "PATCH_OFFER", id: origMsg.id, status: action });

    const txt =
      action === OFFER_STATUS.ACCEPTED
        ? `Accepted! ${CURRENCY}${origMsg._offerMeta.amount.toLocaleString()}`
        : "Offer declined.";

    sendMessage(txt, {});

    socketRef.current?.emit("offerResponse", {
      threadId, messageId: origMsg.id, status: action, userId: user.id,
    });
    axios
      .patch(`${API}/messages/${origMsg.id}/offer`,
        { status: action, userId: user.id }, { headers: authH() })
      .catch(() => {});
  }, [threadId, user?.id, sendMessage]); // eslint-disable-line

  /* ══════════════════════════════════════════════════════════
     OTHER HANDLERS
  ══════════════════════════════════════════════════════════ */
  const handleDelete = useCallback((msg) => {
    if (!window.confirm("Delete this message?")) return;
    if (mounted.current) dispatch({ type: "SOFT_DELETE", id: msg.id });
    socketRef.current?.emit("deleteMessage", { threadId, messageId: msg.id });
    axios
      .delete(`${API}/messages/${msg.id}`,
        { data: { userId: user.id }, headers: authH() })
      .catch(() => {});
  }, [threadId, user?.id]);

  const handleCopy = useCallback((msg) => {
    navigator.clipboard?.writeText(msg.message).catch(() => {});
  }, []);

  const handleSendLocation = useCallback((coords, addr) => {
    sendMessage(
      addr ? truncate(addr, 50) : "My Location",
      { location: { ...coords, address: addr } }
    );
  }, [sendMessage]);

  const handleShareProduct = useCallback(() => {
    if (!product) return;
    sendMessage(
      `${product.title} — ${CURRENCY}${Number(product.price).toLocaleString()}`,
      {
        shared_product: {
          id   : product.id    || "",
          slug : product.slug  || product.id || "",
          title: product.title,
          price: product.price,
          image: product.images?.[0] || "",
        },
      }
    );
  }, [product, sendMessage]);

  const handleDeleteChat = useCallback(async () => {
    try {
      await axios.delete(`${API}/conversations/${threadId}`,
        { data: { userId: user.id }, headers: authH() });
      navigate(-1);
    } catch (err) {
      console.error("Delete chat failed:", err.message);
      alert("Failed to delete chat. Please try again.");
    }
  }, [threadId, user?.id, navigate]);

  /* ── Context menu ── */
  const handleCtx = useCallback((msg, pos, shortcut) => {
    if (shortcut === "reply") {
      setReplyTo(msg);
      inputRef.current?.focus();
      return;
    }
    setCtxMsgId(msg.id);
    setCtxPos(pos);
  }, []);

  const closeCtx = useCallback(() => {
    setCtxMsgId(null);
    setCtxPos(null);
  }, []);

  const ctxMsg = useMemo(() => msgMap.get(ctxMsgId), [msgMap, ctxMsgId]);

  const handleCtxReply  = useCallback(() => {
    if (ctxMsg) { setReplyTo(ctxMsg); inputRef.current?.focus(); }
  }, [ctxMsg]);
  const handleCtxCopy   = useCallback(() => { if (ctxMsg) handleCopy(ctxMsg);   }, [ctxMsg, handleCopy]);
  const handleCtxDelete = useCallback(() => { if (ctxMsg) handleDelete(ctxMsg); }, [ctxMsg, handleDelete]);

  /* ── Retry ── */
  const retryMessage = useCallback((fm) => {
    dispatch({ type: "REMOVE", id: fm.id });
    setNewMsg(fm.message);
    inputRef.current?.focus();
  }, []);

  /* ── Keyboard ── */
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); }
    if (e.key === "Escape") setReplyTo(null);
  }, [handleSend]);

  const handleInputChange = useCallback((e) => {
    setNewMsg(e.target.value);
    handleTyping();
  }, [handleTyping]);

  const isMine = useCallback((m) => m.sender_id === user?.id, [user?.id]);

  /* ── Lightbox helpers ── */
  const openLightbox = useCallback((urls, index = 0) => {
    /* urls can be string | string[] | null */
    const list = Array.isArray(urls) ? urls : urls ? [urls] : [];
    if (list.length) setLightboxSrcs({ urls: list, index });
  }, []);

  const closeLightbox = useCallback(() => setLightboxSrcs(null), []);

  const lightboxPrev = useCallback(() =>
    setLightboxSrcs((s) => s && s.index > 0
      ? { ...s, index: s.index - 1 } : s
    ), []);

  const lightboxNext = useCallback(() =>
    setLightboxSrcs((s) => s && s.index < s.urls.length - 1
      ? { ...s, index: s.index + 1 } : s
    ), []);

  /* ── Stable UI callbacks ── */
  const openOfferModal       = useCallback(() => setOfferModal(true),          []);
  const closeOfferModal      = useCallback(() => setOfferModal(false),         []);
  const closeCounterModal    = useCallback(() => setCounterModal(null),        []);
  const openLocationModal    = useCallback(() => { setShowAttach(false); setLocationModal(true); }, []);
  const closeLocationModal   = useCallback(() => setLocationModal(false),      []);
  const toggleMenu           = useCallback(() => setShowMenu((v) => !v),       []);
  const closeMenu            = useCallback(() => setShowMenu(false),           []);
  const toggleAttach         = useCallback((e) => { e.stopPropagation(); setShowAttach((v) => !v); }, []);
  const showSuggestionsAgain = useCallback(() => setShowSuggestions(true),     []);
  const handleMute           = useCallback(() => setMuted((v) => !v),          []);
  const openCamera           = useCallback(() => cameraRef.current?.click(),   []);
  const openGallery          = useCallback(() => imageFileRef.current?.click(),[]);
  const openVideoGallery     = useCallback(() => videoFileRef.current?.click(),[]);
  const clearReply           = useCallback(() => setReplyTo(null),             []);
  const openDeleteConfirm    = useCallback(() => setShowDeleteConfirm(true),   []);
  const closeDeleteConfirm   = useCallback(() => setShowDeleteConfirm(false),  []);
  const openReportModal      = useCallback(() => setShowReportModal(true),     []);
  const closeReportModal     = useCallback(() => setShowReportModal(false),    []);

  const handleSelectSuggestion = useCallback((s) => {
    setNewMsg(s);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, []);

  const handleDismissSuggestions = useCallback(() => setShowSuggestions(false), []);

  const handleBodyClick = useCallback(() => {
    setCtxMsgId(null);
    setCtxPos(null);
    setShowAttach(false);
  }, []);

  /* cleanup send timers */
  useEffect(() => () => sendTimers.current.forEach((t) => clearTimeout(t)), []);

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="chat-wrap" onClick={handleBodyClick}>

      {/* ── Header ── */}
      <ChatHeader
        otherUser={otherUser}
        product={product}
        isTyping={isTyping}
        sockReady={sockReady}
        showMenu={showMenu}
        onToggleMenu={toggleMenu}
        onMenuClose={closeMenu}
        navigate={navigate}
        muted={muted}
        onMute={handleMute}
        onDeleteChat={openDeleteConfirm}
        onReport={openReportModal}
        isBuyer={isBuyerUser}
      />

      {muted && (
        <div className="mute-banner">
          Notifications muted
          <button onClick={handleMute}>Unmute</button>
        </div>
      )}

      {/* ── Body ── */}
      <main className="chat-body">

        {loading && (
          <div className="chat-center">
            <div className="chat-spinner" />
          </div>
        )}

        {!loading && error && (
          <div className="chat-center">
            <p className="chat-empty-title">Failed to load messages</p>
            <p className="chat-err-code">{error}</p>
            <button onClick={loadHistory} className="chat-retry-btn">Retry</button>
          </div>
        )}

        {!loading && !error && messages.length === 0 && (
          <div className="chat-center">
            <p className="chat-empty-title">No messages yet</p>
            <p className="chat-empty-sub">Say hello or make an offer to start!</p>
          </div>
        )}

        {!loading && !error && messages.length > 0 &&
          grouped.map((item, i) =>
            item.type === "date" ? (
              <DateSep key={`d${i}`} label={item.label} />
            ) : (
              <Bubble
                key={item.data.id}
                msg={item.data}
                mine={isMine(item.data)}
                onRetry={retryMessage}
                onOfferRespond={handleOfferRespond}
                onCtx={handleCtx}
                onLightbox={openLightbox}
                replyToMsg={
                  item.data.reply_to_id
                    ? msgMap.get(item.data.reply_to_id)
                    : null
                }
              />
            )
          )
        }

        {isTyping && <TypingBubble />}

        {/* upload progress indicators */}
        {uploadingImages && (
          <div className="upload-progress-banner">
            <div className="chat-btn-spinner" />
            <span>Uploading photos…</span>
          </div>
        )}
        {uploadingVideos && (
          <div className="upload-progress-banner">
            <div className="chat-btn-spinner" />
            <span>Uploading videos…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* ── Context Menu ── */}
      {ctxMsgId && ctxMsg && ctxPos && (
        <ContextMenu
          msg={ctxMsg}
          mine={isMine(ctxMsg)}
          pos={ctxPos}
          onClose={closeCtx}
          onReply={handleCtxReply}
          onCopy={handleCtxCopy}
          onDelete={handleCtxDelete}
        />
      )}

      {/* ── Toolbar ── */}
      <div className="chat-toolbar">
        {isBuyerUser && (
          <button className="toolbar-btn offer" onClick={openOfferModal}>
            {Icon.offer} Make Offer
          </button>
        )}
        {product && (
          <button className="toolbar-btn share-product" onClick={handleShareProduct}>
            {Icon.product} Share Product
          </button>
        )}
        {!showSuggestions && (
          <button className="toolbar-btn" onClick={showSuggestionsAgain}>
            {Icon.suggest} Suggestions
          </button>
        )}
      </div>

      {/* ── Suggestions ── */}
      {showSuggestions && (
        <SuggestionsBar
          suggestions={suggestions}
          onSelect={handleSelectSuggestion}
          onDismiss={handleDismissSuggestions}
        />
      )}

      {/* ── Reply Preview ── */}
      {replyTo && (
        <div className="footer-reply-preview">
          {Icon.reply}
          <div className="footer-reply-text">
            <div className="footer-reply-sender">
              {replyTo.sender_id === user?.id ? "You" : otherUser?.name}
            </div>

            {/* image reply */}
            {replyTo.message_type === MESSAGE_TYPES.MEDIA &&
             Array.isArray(replyTo.media_url) &&
             replyTo.media_url.length > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <img
                  src={replyTo.media_url[0]}
                  alt=""
                  className="footer-reply-thumb"
                />
                <span className="footer-reply-msg">
                  {replyTo.media_url.length > 1
                    ? `${replyTo.media_url.length} Photos`
                    : "Photo"}
                </span>
              </div>
            /* video reply */
            ) : replyTo.message_type === MESSAGE_TYPES.VIDEO &&
              Array.isArray(replyTo.media_url) &&
              replyTo.media_url.length > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div className="footer-reply-video-thumb">
                  {Icon.video || "▶"}
                </div>
                <span className="footer-reply-msg">
                  {replyTo.media_url.length > 1
                    ? `${replyTo.media_url.length} Videos`
                    : "Video"}
                </span>
              </div>
            ) : (
              <div className="footer-reply-msg">
                {truncate(replyTo.message)}
              </div>
            )}
          </div>
          <button className="footer-reply-close" onClick={clearReply}>
            {Icon.close}
          </button>
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="chat-footer">

        {/* Attach popover */}
        {showAttach && (
          <div className="attach-popover">

            <button className="attach-option" onClick={openCamera}>
              {Icon.camera}
              <span>Camera</span>
            </button>

            <button className="attach-option" onClick={openGallery}>
              {Icon.gallery}
              <span>
                Photo
                <small style={{ display: "block", fontSize: 10, opacity: 0.6 }}>
                  max {IMAGE_MAX_COUNT} · 5 MB each
                </small>
              </span>
            </button>

            <button className="attach-option" onClick={openVideoGallery}>
              {Icon.video || "🎥"}
              <span>
                Video
                <small style={{ display: "block", fontSize: 10, opacity: 0.6 }}>
                  max {VIDEO_MAX_COUNT} · 10 MB · 60 s
                </small>
              </span>
            </button>

            <button className="attach-option" onClick={openLocationModal}>
              {Icon.location}
              <span>Location</span>
            </button>

          </div>
        )}

        {/* Hidden inputs */}
        {/* images — gallery, multi-select */}
        <input
          ref={imageFileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden-input"
          onChange={handleImageChange}
        />
        {/* camera capture — single */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden-input"
          onChange={handleImageChange}
        />
        {/* videos — multi-select */}
        <input
          ref={videoFileRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden-input"
          onChange={handleVideoChange}
        />

        <button
          className="chat-icon-btn"
          onClick={toggleAttach}
          aria-label="Attach"
        >
          {Icon.plus}
        </button>

        <input
          ref={inputRef}
          className="chat-input"
          type="text"
          value={newMsg}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={replyTo ? "Write a reply…" : "Type a message…"}
          aria-label="Message"
          maxLength={5000}
        />

        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send"
          style={{
            background: canSend ? "#111" : "#e5e5e5",
            color     : canSend ? "#fff" : "#aaa",
          }}
        >
          {sending ? <div className="chat-btn-spinner" /> : Icon.send}
        </button>

      </footer>

      {/* ── Lightbox (multi-image / video) ── */}
      {lightboxSrcs && lightboxSrcs.urls.length > 0 && (
        <div className="lightbox-overlay" onClick={closeLightbox}>

          {/* prev */}
          {lightboxSrcs.index > 0 && (
            <button
              className="lightbox-nav lightbox-prev"
              onClick={(e) => { e.stopPropagation(); lightboxPrev(); }}
            >
              ‹
            </button>
          )}

          {/* media */}
          {lightboxSrcs.urls[lightboxSrcs.index]?.match(/\.(mp4|webm|mov|3gp|mkv)(\?|$)/i)
            ? (
              <video
                src={lightboxSrcs.urls[lightboxSrcs.index]}
                className="lightbox-img"
                controls
                autoPlay
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img
                src={lightboxSrcs.urls[lightboxSrcs.index]}
                alt={`Media ${lightboxSrcs.index + 1}`}
                className="lightbox-img"
                onClick={(e) => e.stopPropagation()}
              />
            )
          }

          {/* next */}
          {lightboxSrcs.index < lightboxSrcs.urls.length - 1 && (
            <button
              className="lightbox-nav lightbox-next"
              onClick={(e) => { e.stopPropagation(); lightboxNext(); }}
            >
              ›
            </button>
          )}

          {/* counter */}
          {lightboxSrcs.urls.length > 1 && (
            <div className="lightbox-counter">
              {lightboxSrcs.index + 1} / {lightboxSrcs.urls.length}
            </div>
          )}

          <button className="lightbox-close" onClick={closeLightbox}>
            {Icon.close}
          </button>

        </div>
      )}

      {/* ── Modals ── */}
      {offerModal && (
        <MakeOfferModal
          product={product}
          onSend={handleSendOffer}
          onClose={closeOfferModal}
        />
      )}
      {counterModal && (
        <CounterOfferModal
          originalMsg={counterModal}
          onSend={handleSendOffer}
          onClose={closeCounterModal}
        />
      )}
      {locationModal && (
        <LocationModal
          onSend={handleSendLocation}
          onClose={closeLocationModal}
        />
      )}
      {showDeleteConfirm && (
        <DeleteChatConfirm
          onConfirm={() => { setShowDeleteConfirm(false); handleDeleteChat(); }}
          onCancel={closeDeleteConfirm}
        />
      )}
      {showReportModal && (
        <ReportModal
          threadId={threadId}
          userId={user?.id}
          otherUserName={otherUser?.name || "Seller"}
          onClose={closeReportModal}
          onSuccess={() => {}}
        />
      )}

    </div>
  );
}
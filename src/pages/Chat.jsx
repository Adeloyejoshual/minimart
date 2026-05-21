import React, {
  useEffect, useState, useRef,
  useCallback, useMemo, useReducer,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io }   from "socket.io-client";
import axios    from "axios";

import ChatHeader        from "./chat/ChatHeader";
import SuggestionsBar    from "./chat/SuggestionsBar";
import MakeOfferModal    from "./chat/MakeOfferModal";
import CounterOfferModal from "./chat/CounterOfferModal";
import LocationModal     from "./chat/LocationModal";
import Bubble, { TypingBubble, DateSep } from "./chat/Bubble";
import { Icon }          from "./chat/icons";
import {
  MESSAGE_TYPES, OFFER_STATUS,
  authH, dedupe, groupByDate,
  pickSuggestions, truncate,
} from "./chat/constants";

import "../styles/Chat.css";

const BASE         = "https://minimart-ivrm.onrender.com";
const API          = `${BASE}/api`;
const SOCKET_URL   = BASE;
const SEND_TIMEOUT = 15_000;

/* ═══════════════════════════════════════════
   MESSAGE REDUCER
═══════════════════════════════════════════ */
function msgsReducer(state, action) {
  switch (action.type) {

    /* Replace entire list (initial load) */
    case "SET":
      return dedupe(action.payload);

    /* Add one message — skip if id already exists */
    case "APPEND": {
      const alreadyById = state.some(m => m.id === action.payload.id);
      if (alreadyById) return state;

      /* also skip temp if we already have the real version */
      if (action.payload._temp && action.payload.client_message_id) {
        const realExists = state.some(
          m =>
            !m._temp &&
            m.client_message_id === action.payload.client_message_id
        );
        if (realExists) return state;
      }

      return dedupe([...state, action.payload]);
    }

    /* Replace temp message with saved message from server */
    case "REPLACE": {
      let replaced = false;

      const next = state.map(m => {
        /* primary match: temp id */
        if (m.id === action.tempId) {
          replaced = true;
          return action.payload;
        }
        /* fallback match: same client_message_id */
        if (
          !replaced &&
          m._temp &&
          action.payload.client_message_id &&
          m.client_message_id === action.payload.client_message_id
        ) {
          replaced = true;
          return action.payload;
        }
        return m;
      });

      if (!replaced) {
        /* temp was already removed — append real if not duplicate */
        const exists = state.some(m => m.id === action.payload.id);
        if (exists) return state;
        return dedupe([...state, action.payload]);
      }

      return next;
    }

    case "PATCH":
      return state.map(m =>
        m.id === action.id ? { ...m, ...action.patch } : m
      );

    case "PATCH_OFFER":
      return state.map(m =>
        m.id === action.id && m._offerMeta
          ? { ...m, _offerMeta: { ...m._offerMeta, status: action.status } }
          : m
      );

    case "SOFT_DELETE":
      return state.map(m =>
        m.id === action.id ? { ...m, _deleted: true } : m
      );

    case "MARK_READ":
      return state.map(m =>
        m.sender_id === action.myId && m.status !== "read"
          ? { ...m, status: "read" }
          : m
      );

    case "REMOVE":
      return state.filter(m => m.id !== action.id);

    default:
      return state;
  }
}

/* ═══════════════════════════════════════════
   MAIN
═══════════════════════════════════════════ */
export default function Chat({ user }) {
  const { threadId } = useParams();
  const navigate     = useNavigate();

  /* ── core state ── */
  const [messages,  dispatch]     = useReducer(msgsReducer, []);
  const [newMsg,    setNewMsg]    = useState("");
  const [otherUser, setOtherUser] = useState(null);
  const [product,   setProduct]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const [isTyping,  setIsTyping]  = useState(false);
  const [sockReady, setSockReady] = useState(false);
  const [error,     setError]     = useState(null);

  /* ── UI state ── */
  const [showMenu,         setShowMenu]         = useState(false);
  const [muted,            setMuted]            = useState(false);
  const [showSuggestions,  setShowSuggestions]  = useState(true);
  const [showAttach,       setShowAttach]       = useState(false);
  const [lightboxUrl,      setLightboxUrl]      = useState(null);
  const [replyTo,          setReplyTo]          = useState(null);
  const [ctxMsgId,         setCtxMsgId]         = useState(null);
  const [offerModal,       setOfferModal]       = useState(false);
  const [counterModal,     setCounterModal]     = useState(null);
  const [locationModal,    setLocationModal]    = useState(false);

  /* ── refs ── */
  const socketRef     = useRef(null);
  const bottomRef     = useRef(null);
  const inputRef      = useRef(null);
  const typingTimer   = useRef(null);
  const historyLoaded = useRef(false);
  const pendingMsgs   = useRef([]);
  const mounted       = useRef(true);
  const sendTimers    = useRef(new Map());
  const fileRef       = useRef(null);
  const cameraRef     = useRef(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const safe = useCallback(fn => {
    if (mounted.current) fn();
  }, []);

  /* ── derived ── */
  const suggestions = useMemo(
    () => pickSuggestions(messages, user?.id),
    [messages, user?.id]
  );

  const msgMap = useMemo(() => {
    const m = new Map();
    messages.forEach(msg => m.set(msg.id, msg));
    return m;
  }, [messages]);

  const grouped = useMemo(() => groupByDate(messages), [messages]);
  const canSend = newMsg.trim().length > 0 && !sending;

  /* ════════════════════════════════════
     THREAD META
  ════════════════════════════════════ */
  useEffect(() => {
    if (!threadId || !user?.id) return;
    const ctrl = new AbortController();

    axios
      .get(`${API}/conversations/${threadId}`, {
        headers: authH(),
        signal:  ctrl.signal,
        timeout: 8000,
      })
      .then(({ data }) => {
        const oid =
          data.other_user_id ||
          (data.buyer_id === user.id ? data.seller_id : data.buyer_id);

        safe(() =>
          setOtherUser({
            id:            oid,
            name:          data.other_user_name  || "User",
            profile_image: data.other_user_image || null,
            is_online:     data.other_user_online || false,
            store_name:    data.other_user_store  || "",
            last_login:    data.last_login        || null,
          })
        );

        if (data.product_title) {
          safe(() =>
            setProduct({
              title:  data.product_title,
              images: data.product_image ? [data.product_image] : [],
              price:  data.product_price,
              id:     data.product_id,
            })
          );
        }

        if (oid) {
          axios
            .get(`${API}/users/${oid}`, { headers: authH() })
            .then(({ data: u }) =>
              safe(() =>
                setOtherUser(prev => ({
                  ...prev,
                  ...u,
                  is_online: prev?.is_online || u.is_online || false,
                }))
              )
            )
            .catch(() => {});
        }
      })
      .catch(() => {});

    return () => ctrl.abort();
  }, [threadId, user?.id]); // eslint-disable-line

  /* ════════════════════════════════════
     SOCKET
  ════════════════════════════════════ */
  useEffect(() => {
    if (!user?.id || !threadId) return;

    const sock = io(SOCKET_URL, {
      transports:           ["websocket", "polling"],
      withCredentials:      false,
      query:                { userId: user.id },
      reconnection:         true,
      reconnectionAttempts: 10,
      reconnectionDelay:    1500,
    });
    socketRef.current = sock;

    const onConnect = () => {
      sock.emit("joinThread", { threadId, userId: user.id });
      safe(() => setSockReady(true));
    };

    const onDisconnect = () => safe(() => setSockReady(false));

    const onReconnect = attempt =>
      console.log(`[socket] reconnect attempt ${attempt}`);

    const onReceive = msg => {
      /* ignore own messages — handled by HTTP response */
      if (!msg?.id || msg.sender_id === user.id) return;

      if (!historyLoaded.current) {
        pendingMsgs.current.push(msg);
        return;
      }

      safe(() => dispatch({ type: "APPEND", payload: msg }));

      sock.emit("markRead", { threadId, userId: user.id });
      axios
        .patch(
          `${API}/conversations/${threadId}/read`,
          { userId: user.id },
          { headers: authH() }
        )
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
      safe(() =>
        dispatch({ type: "PATCH_OFFER", id: messageId, status })
      );

    const onOnline = ({ userId: uid }) => {
      if (uid !== user.id)
        safe(() =>
          setOtherUser(p => (p ? { ...p, is_online: true } : p))
        );
    };

    const onOffline = ({ userId: uid }) => {
      if (uid !== user.id)
        safe(() =>
          setOtherUser(p => (p ? { ...p, is_online: false } : p))
        );
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

  /* ════════════════════════════════════
     LOAD HISTORY
  ════════════════════════════════════ */
  const loadHistory = useCallback(async () => {
    if (!user?.id || !threadId) return;
    historyLoaded.current = false;
    pendingMsgs.current   = [];
    safe(() => { setLoading(true); setError(null); });

    try {
      const { data } = await axios.get(`${API}/messages`, {
        params:  { threadId, userId: user.id },
        headers: authH(),
        timeout: 12000,
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
        .patch(
          `${API}/conversations/${threadId}/read`,
          { userId: user.id },
          { headers: authH() }
        )
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

  /* ════════════════════════════════════
     AUTO-SCROLL
  ════════════════════════════════════ */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  /* ════════════════════════════════════
     TYPING
  ════════════════════════════════════ */
  const handleTyping = useCallback(() => {
    socketRef.current?.emit("typing", { threadId, userId: user?.id });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit("stopTyping", {
        threadId, userId: user?.id,
      });
    }, 1500);
  }, [threadId, user?.id]);

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  /* ════════════════════════════════════
     SEND MESSAGE
  ════════════════════════════════════ */
  const sendMessage = useCallback(
    async (overrideText, extras = {}) => {
      const text = (overrideText ?? newMsg).trim();
      if (!text || sending) return;

      /* unique ids */
      const clientMsgId = `${user.id}_${Date.now()}`;
      const tempId      = `temp_${clientMsgId}`;
      const replyRef    = replyTo ? { reply_to_id: replyTo.id } : {};

      const msgType =
        extras.offerMeta      ? MESSAGE_TYPES.OFFER
        : extras.location     ? MESSAGE_TYPES.LOCATION
        : extras.shared_product ? MESSAGE_TYPES.PRODUCT
        : MESSAGE_TYPES.TEXT;

      /* optimistic temp message */
      const temp = {
        id:                tempId,
        client_message_id: clientMsgId,   // ← critical for deduping
        thread_id:         threadId,
        sender_id:         user.id,
        message:           text,
        message_type:      msgType,
        created_at:        new Date().toISOString(),
        status:            "sending",
        _temp:             true,
        _failed:           false,
        _timedOut:         false,
        ...replyRef,
        ...(extras.offerMeta
          ? { _offerMeta: extras.offerMeta }
          : {}),
        ...(extras.location
          ? { location: extras.location }
          : {}),
        ...(extras.shared_product
          ? { shared_product: extras.shared_product }
          : {}),
      };

      safe(() => {
        dispatch({ type: "APPEND", payload: temp });
        if (!overrideText) setNewMsg("");
        setSending(true);
        setShowSuggestions(false);
        setReplyTo(null);
      });

      clearTimeout(typingTimer.current);
      socketRef.current?.emit("stopTyping", {
        threadId, userId: user.id,
      });

      /* timeout → mark as timed out */
      const timer = setTimeout(() => {
        safe(() => {
          dispatch({
            type:  "PATCH",
            id:    tempId,
            patch: { _temp: false, _timedOut: true },
          });
          setSending(false);
        });
      }, SEND_TIMEOUT);
      sendTimers.current.set(tempId, timer);

      try {
        const { data: saved } = await axios.post(
          `${API}/messages`,
          {
            threadId,
            senderId:        user.id,
            message:         text,
            messageType:     msgType,
            clientMessageId: clientMsgId,
            ...replyRef,
            ...(extras.offerMeta
              ? { offerMeta: extras.offerMeta }
              : {}),
            ...(extras.location
              ? { location: extras.location }
              : {}),
            ...(extras.shared_product
              ? { sharedProduct: extras.shared_product }
              : {}),
          },
          { headers: authH(), timeout: SEND_TIMEOUT }
        );

        /* cancel timeout */
        clearTimeout(sendTimers.current.get(tempId));
        sendTimers.current.delete(tempId);

        console.log("✅ Message saved:", saved.id);

        /* merge any client-side extras that backend doesn't return */
        const final = {
          ...saved,
          ...(extras.offerMeta
            ? { _offerMeta: extras.offerMeta }
            : {}),
          ...(extras.location
            ? { location: extras.location }
            : {}),
          ...(extras.shared_product
            ? { shared_product: extras.shared_product }
            : {}),
        };

        /* replace the temp bubble with the real message */
        safe(() =>
          dispatch({ type: "REPLACE", tempId, payload: final })
        );

        /* tell the other party via socket */
        socketRef.current?.emit("sendMessage", final);
      } catch (err) {
        clearTimeout(sendTimers.current.get(tempId));
        sendTimers.current.delete(tempId);

        console.error(
          "Send failed:",
          err.response?.data ?? err.message
        );

        safe(() => {
          dispatch({
            type:  "PATCH",
            id:    tempId,
            patch: { _temp: false, _failed: true, _timedOut: false },
          });
          if (!overrideText) setNewMsg(text); // restore input
        });
      } finally {
        safe(() => setSending(false));
        inputRef.current?.focus();
      }
    },
    [newMsg, sending, threadId, user?.id, safe, replyTo] // eslint-disable-line
  );

  /* ════════════════════════════════════
     IMAGE UPLOAD
  ════════════════════════════════════ */
  const handleImageChange = useCallback(
    async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      setShowAttach(false);

      if (!file.type.startsWith("image/")) {
        alert("Only images allowed.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert("Image too large. Max 10 MB.");
        return;
      }

      const clientMsgId = `${user.id}_${Date.now()}`;
      const tempId      = `temp_${clientMsgId}`;
      const localUrl    = URL.createObjectURL(file);

      const temp = {
        id:                tempId,
        client_message_id: clientMsgId,
        thread_id:         threadId,
        sender_id:         user.id,
        message:           "Photo",
        message_type:      MESSAGE_TYPES.MEDIA,
        media_url:         localUrl,
        created_at:        new Date().toISOString(),
        status:            "sending",
        _temp:             true,
        _failed:           false,
        _timedOut:         false,
      };

      safe(() => dispatch({ type: "APPEND", payload: temp }));

      try {
        const form = new FormData();
        form.append("file",            file);
        form.append("threadId",        threadId);
        form.append("senderId",        user.id);
        form.append("messageType",     MESSAGE_TYPES.MEDIA);
        form.append("clientMessageId", clientMsgId);
        if (replyTo) form.append("reply_to_id", replyTo.id);

        const { data: saved } = await axios.post(
          `${API}/messages/upload`,
          form,
          {
            headers: {
              ...authH(),
              "Content-Type": "multipart/form-data",
            },
            timeout: 30000,
          }
        );

        URL.revokeObjectURL(localUrl);
        safe(() => {
          dispatch({ type: "REPLACE", tempId, payload: saved });
          setReplyTo(null);
        });
        socketRef.current?.emit("sendMessage", saved);
      } catch (err) {
        console.error("Upload failed:", err.message);
        URL.revokeObjectURL(localUrl);
        safe(() =>
          dispatch({
            type:  "PATCH",
            id:    tempId,
            patch: { _temp: false, _failed: true, _timedOut: false },
          })
        );
      }
    },
    [threadId, user?.id, safe, replyTo]
  );

  /* ════════════════════════════════════
     OFFER HANDLERS
  ════════════════════════════════════ */
  const handleSendOffer = useCallback(
    offerMeta => {
      const label = `Offer: ৳${offerMeta.amount.toLocaleString()}`;
      sendMessage(label, { offerMeta });
    },
    [sendMessage]
  );

  const handleOfferRespond = useCallback(
    (origMsg, action) => {
      if (action === OFFER_STATUS.COUNTERED) {
        setCounterModal(origMsg);
        return;
      }

      safe(() =>
        dispatch({ type: "PATCH_OFFER", id: origMsg.id, status: action })
      );

      const txt =
        action === OFFER_STATUS.ACCEPTED
          ? `Accepted! ৳${origMsg._offerMeta.amount.toLocaleString()}`
          : "Offer declined.";

      sendMessage(txt, {});

      socketRef.current?.emit("offerResponse", {
        threadId,
        messageId: origMsg.id,
        status:    action,
        userId:    user.id,
      });

      axios
        .patch(
          `${API}/messages/${origMsg.id}/offer`,
          { status: action, userId: user.id },
          { headers: authH() }
        )
        .catch(() => {});
    },
    [threadId, user?.id, safe, sendMessage] // eslint-disable-line
  );

  /* ════════════════════════════════════
     OTHER HANDLERS
  ════════════════════════════════════ */
  const handleDelete = useCallback(
    msg => {
      if (!window.confirm("Delete this message?")) return;
      safe(() => dispatch({ type: "SOFT_DELETE", id: msg.id }));
      socketRef.current?.emit("deleteMessage", {
        threadId, messageId: msg.id,
      });
      axios
        .delete(`${API}/messages/${msg.id}`, {
          data:    { userId: user.id },
          headers: authH(),
        })
        .catch(() => {});
    },
    [threadId, user?.id, safe]
  );

  const handleCopy = useCallback(msg => {
    navigator.clipboard?.writeText(msg.message).catch(() => {});
  }, []);

  const handleSendLocation = useCallback(
    (coords, addr) => {
      const label = addr ? truncate(addr, 50) : "My Location";
      sendMessage(label, { location: { ...coords, address: addr } });
    },
    [sendMessage]
  );

  const handleShareProduct = useCallback(() => {
    if (!product) return;
    sendMessage(
      `${product.title} — ৳${Number(product.price).toLocaleString()}`,
      {
        shared_product: {
          id:    product.id || "",
          title: product.title,
          price: product.price,
          image: product.images?.[0] || "",
        },
      }
    );
  }, [product, sendMessage]);

  /* ── context menu ── */
  const handleCtx = useCallback((msg, pos, shortcut) => {
    if (shortcut === "reply") {
      setReplyTo(msg);
      inputRef.current?.focus();
      return;
    }
    setCtxMsgId(msg.id);
  }, []);

  const closeCtx  = useCallback(() => setCtxMsgId(null), []);
  const ctxMsg    = useMemo(() => msgMap.get(ctxMsgId), [msgMap, ctxMsgId]);

  const handleCtxReply = useCallback(() => {
    if (ctxMsg) { setReplyTo(ctxMsg); inputRef.current?.focus(); }
  }, [ctxMsg]);

  const handleCtxCopy = useCallback(
    () => { if (ctxMsg) handleCopy(ctxMsg); },
    [ctxMsg, handleCopy]
  );

  const handleCtxDelete = useCallback(
    () => { if (ctxMsg) handleDelete(ctxMsg); },
    [ctxMsg, handleDelete]
  );

  /* ── retry failed ── */
  const retryMessage = useCallback(fm => {
    dispatch({ type: "REMOVE", id: fm.id });
    setNewMsg(fm.message);
    inputRef.current?.focus();
  }, []);

  /* ── keyboard ── */
  const handleKeyDown = useCallback(
    e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
      if (e.key === "Escape") setReplyTo(null);
    },
    [sendMessage]
  );

  const handleInputChange = useCallback(
    e => { setNewMsg(e.target.value); handleTyping(); },
    [handleTyping]
  );

  const isMine = useCallback(
    m => m.sender_id === user?.id,
    [user?.id]
  );

  /* ── stable UI callbacks ── */
  const openOfferModal      = useCallback(() => setOfferModal(true),   []);
  const closeOfferModal     = useCallback(() => setOfferModal(false),  []);
  const closeCounterModal   = useCallback(() => setCounterModal(null), []);
  const openLocationModal   = useCallback(() => {
    setShowAttach(false); setLocationModal(true);
  }, []);
  const closeLocationModal  = useCallback(() => setLocationModal(false), []);
  const toggleMenu          = useCallback(() => setShowMenu(v => !v),  []);
  const closeMenu           = useCallback(() => setShowMenu(false),    []);
  const toggleAttach        = useCallback(e => {
    e.stopPropagation(); setShowAttach(v => !v);
  }, []);
  const showSuggestionsAgain  = useCallback(() => setShowSuggestions(true),  []);
  const handleMute            = useCallback(() => setMuted(v => !v),          []);
  const closeLightbox         = useCallback(() => setLightboxUrl(null),       []);
  const openCamera            = useCallback(() => cameraRef.current?.click(), []);
  const openGallery           = useCallback(() => fileRef.current?.click(),   []);
  const clearReply            = useCallback(() => setReplyTo(null),           []);
  const handleSelectSuggestion  = useCallback(s => {
    setNewMsg(s); setShowSuggestions(false); inputRef.current?.focus();
  }, []);
  const handleDismissSuggestions = useCallback(
    () => setShowSuggestions(false), []
  );
  const handleBodyClick = useCallback(() => {
    setCtxMsgId(null); setShowAttach(false);
  }, []);

  /* cleanup timers on unmount */
  useEffect(
    () => () => sendTimers.current.forEach(t => clearTimeout(t)),
    []
  );

  /* ═══════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════ */
  return (
    <div className="chat-wrap" onClick={handleBodyClick}>

      {/* HEADER */}
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
      />

      {muted && (
        <div className="mute-banner">
          Notifications muted
          <button onClick={handleMute}>Unmute</button>
        </div>
      )}

      {/* BODY */}
      <main className="chat-body">
        {loading && (
          <div className="chat-center">
            <div className="chat-spinner"/>
          </div>
        )}

        {!loading && error && (
          <div className="chat-center">
            <p className="chat-empty-title">Failed to load messages</p>
            <p className="chat-err-code">{error}</p>
            <button onClick={loadHistory} className="chat-retry-btn">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && messages.length === 0 && (
          <div className="chat-center">
            <p className="chat-empty-title">No messages yet</p>
            <p className="chat-empty-sub">
              Say hello or make an offer to start!
            </p>
          </div>
        )}

        {!loading && !error && messages.length > 0 &&
          grouped.map((item, i) =>
            item.type === "date" ? (
              <DateSep key={`d${i}`} label={item.label}/>
            ) : (
              <Bubble
                key={item.data.id}
                msg={item.data}
                mine={isMine(item.data)}
                onRetry={retryMessage}
                onOfferRespond={handleOfferRespond}
                onCtx={handleCtx}
                onLightbox={setLightboxUrl}
                replyToMsg={
                  item.data.reply_to_id
                    ? msgMap.get(item.data.reply_to_id)
                    : null
                }
                ctxMsgId={ctxMsgId}
                onCtxClose={closeCtx}
                onCtxReply={handleCtxReply}
                onCtxCopy={handleCtxCopy}
                onCtxDelete={handleCtxDelete}
              />
            )
          )
        }

        {isTyping && <TypingBubble/>}
        <div ref={bottomRef}/>
      </main>

      {/* TOOLBAR */}
      <div className="chat-toolbar">
        <button className="toolbar-btn offer" onClick={openOfferModal}>
          {Icon.offer} Make Offer
        </button>
        {product && (
          <button
            className="toolbar-btn share-product"
            onClick={handleShareProduct}
          >
            {Icon.product} Share Product
          </button>
        )}
        {!showSuggestions && (
          <button className="toolbar-btn" onClick={showSuggestionsAgain}>
            {Icon.suggest} Suggestions
          </button>
        )}
      </div>

      {/* SUGGESTIONS */}
      {showSuggestions && (
        <SuggestionsBar
          suggestions={suggestions}
          onSelect={handleSelectSuggestion}
          onDismiss={handleDismissSuggestions}
        />
      )}

      {/* REPLY PREVIEW */}
      {replyTo && (
        <div className="footer-reply-preview">
          {Icon.reply}
          <div className="footer-reply-text">
            <div className="footer-reply-sender">
              {replyTo.sender_id === user?.id ? "You" : otherUser?.name}
            </div>
            {replyTo.media_url ? (
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <img
                  src={replyTo.media_url}
                  alt=""
                  className="footer-reply-thumb"
                />
                <span className="footer-reply-msg">Photo</span>
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

      {/* FOOTER */}
      <footer className="chat-footer">
        {showAttach && (
          <div className="attach-popover">
            <button className="attach-option" onClick={openCamera}>
              {Icon.camera}<span>Camera</span>
            </button>
            <button className="attach-option" onClick={openGallery}>
              {Icon.gallery}<span>Gallery</span>
            </button>
            <button className="attach-option" onClick={openLocationModal}>
              {Icon.location}<span>Location</span>
            </button>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden-input"
          onChange={handleImageChange}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden-input"
          onChange={handleImageChange}
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
          onClick={sendMessage}
          disabled={!canSend}
          aria-label="Send"
          style={{
            background: canSend ? "#111" : "#e5e5e5",
            color:      canSend ? "#fff" : "#aaa",
          }}
        >
          {sending
            ? <div className="chat-btn-spinner"/>
            : Icon.send}
        </button>
      </footer>

      {/* LIGHTBOX */}
      {lightboxUrl && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <img
            src={lightboxUrl}
            alt="Full size"
            className="lightbox-img"
            onClick={e => e.stopPropagation()}
          />
          <button className="lightbox-close" onClick={closeLightbox}>
            {Icon.close}
          </button>
        </div>
      )}

      {/* MODALS */}
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
    </div>
  );
}
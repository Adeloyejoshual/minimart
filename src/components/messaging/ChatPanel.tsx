import {
  useEffect,
  useState,
  useCallback,
  useRef,
  useReducer,
  useMemo,
  FC,
} from "react";
import { useNavigate } from "react-router-dom";
import { io, Socket }  from "socket.io-client";
import axios           from "axios";

/* ═══════════════════════════════════════════════════════════════
   EXISTING CHAT SUB-COMPONENTS
   (same ones used by the mobile Chat.jsx)
═══════════════════════════════════════════════════════════════ */
import ChatHeader           from "../../pages/chat/ChatHeader";
import SuggestionsBar       from "../../pages/chat/SuggestionsBar";
import MakeOfferModal       from "../../pages/chat/MakeOfferModal";
import CounterOfferModal    from "../../pages/chat/CounterOfferModal";
import LocationModal        from "../../pages/chat/LocationModal";
import ContextMenu          from "../../pages/chat/ContextMenu";
import ReportModal          from "../../pages/chat/ReportModal";
import DeleteChatConfirm    from "../../pages/chat/DeleteChatConfirm";
import DeleteMessageConfirm from "../../pages/chat/DeleteMessageConfirm";
import Bubble, { TypingBubble, DateSep } from "../../pages/chat/Bubble";
import { Icon } from "../../pages/chat/icons";
import {
  MESSAGE_TYPES,
  OFFER_STATUS,
  CURRENCY,
  authH,
  dedupe,
  groupByDate,
  pickSuggestions,
  truncate,
} from "../../pages/chat/constants";

import { User, Message, Product } from "./types";
import "../../styles/chat-panel.css";

/* ═══════════════════════════════════════════════════════════════
   ENV
═══════════════════════════════════════════════════════════════ */
const BASE         = import.meta.env.VITE_API_BASE_URL as string;
const API          = `${BASE}/api`;
const SOCKET_URL   = BASE;
const SEND_TIMEOUT = 15_000;

/* ═══════════════════════════════════════════════════════════════
   UPLOAD LIMITS  (must match server)
═══════════════════════════════════════════════════════════════ */
const IMAGE_MAX_COUNT = 10;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/* ═══════════════════════════════════════════════════════════════
   UPLOAD HELPERS
═══════════════════════════════════════════════════════════════ */

/** Validate image files → { valid, errors } */
function validateImages(files: File[]): { valid: File[]; errors: string[] } {
  const errors: string[] = [];
  if (files.length > IMAGE_MAX_COUNT) {
    errors.push(`Max ${IMAGE_MAX_COUNT} images per message.`);
    return { valid: [], errors };
  }
  const valid: File[] = [];
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

/** Normalise media_url → always string[] */
function asMediaArray(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as string[];
  return [raw as string];
}

/** Is a URL a video file? (kept only for lightbox display of legacy videos) */
function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|3gp|mkv)(\?|$)/i.test(url);
}

/** Auto-resize textarea (max 120px / ~5 lines) */
function resizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

/* ═══════════════════════════════════════════════════════════════
   MESSAGE CACHE  (localStorage)
═══════════════════════════════════════════════════════════════ */
const CACHE_PREFIX   = "chat_msgs_";
const CACHE_MAX_MSGS = 200;
const CACHE_TTL_MS   = 7 * 24 * 60 * 60 * 1000; // 7 days

function cacheKey(threadId: string): string {
  return `${CACHE_PREFIX}${threadId}`;
}

function loadCachedMessages(threadId: string): Message[] | null {
  if (!threadId) return null;
  try {
    const raw = localStorage.getItem(cacheKey(threadId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.messages || !Array.isArray(parsed.messages)) return null;
    if (Date.now() - (parsed.savedAt || 0) > CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey(threadId));
      return null;
    }
    return parsed.messages as Message[];
  } catch {
    return null;
  }
}

function saveCachedMessages(threadId: string, messages: Message[]) {
  if (!threadId || !Array.isArray(messages)) return;
  try {
    const clean = messages
      .filter(
        (m: any) => !m._temp && !m._failed && !m._timedOut
      )
      .slice(-CACHE_MAX_MSGS);
    localStorage.setItem(
      cacheKey(threadId),
      JSON.stringify({ savedAt: Date.now(), messages: clean })
    );
  } catch {
    /* quota exceeded — ignore */
  }
}

function clearCachedMessages(threadId: string) {
  if (!threadId) return;
  try {
    localStorage.removeItem(cacheKey(threadId));
  } catch {}
}

/* ═══════════════════════════════════════════════════════════════
   MESSAGES REDUCER
═══════════════════════════════════════════════════════════════ */
type MsgAction =
  | { type: "SET";         payload: Message[] }
  | { type: "APPEND";      payload: Message }
  | { type: "REPLACE";     tempId: string | number; payload: Message }
  | { type: "PATCH";       id: string | number; patch: Partial<Message> }
  | { type: "PATCH_OFFER"; id: string | number; status: string }
  | { type: "SOFT_DELETE"; id: string | number }
  | { type: "MARK_READ";   myId: string | number }
  | { type: "REMOVE";      id: string | number };

function msgsReducer(state: Message[], action: MsgAction): Message[] {
  switch (action.type) {

    case "SET":
      return dedupe(action.payload);

    case "APPEND": {
      if (state.some((m) => m.id === action.payload.id)) return state;
      if (
        (action.payload as any)._temp &&
        action.payload.client_message_id
      ) {
        if (
          state.some(
            (m) =>
              !(m as any)._temp &&
              m.client_message_id === action.payload.client_message_id
          )
        )
          return state;
      }
      return dedupe([...state, action.payload]);
    }

    case "REPLACE": {
      let replaced = false;
      const next = state.map((m) => {
        if (m.id === action.tempId) {
          replaced = true;
          return action.payload;
        }
        if (
          !replaced &&
          (m as any)._temp &&
          action.payload.client_message_id &&
          m.client_message_id === action.payload.client_message_id
        ) {
          replaced = true;
          return action.payload;
        }
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
        m.id === action.id && (m as any)._offerMeta
          ? {
              ...m,
              _offerMeta: {
                ...(m as any)._offerMeta,
                status: action.status,
              },
            }
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
   LIGHTBOX STATE
═══════════════════════════════════════════════════════════════ */
interface LightboxState {
  urls:  string[];
  index: number;
}

/* ═══════════════════════════════════════════════════════════════
   PROPS
═══════════════════════════════════════════════════════════════ */
interface ChatPanelProps {
  threadId:           string;
  user:               User;
  onDeselectThread?:  () => void;
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════ */
const ChatPanel: FC<ChatPanelProps> = ({
  threadId,
  user,
  onDeselectThread,
}) => {
  const navigate = useNavigate();

  /* ── Core state ─────────────────────────────────────────── */
  const [messages,  dispatch]     = useReducer(msgsReducer, []);
  const [newMsg,    setNewMsg]    = useState("");
  const [otherUser, setOtherUser] = useState<any>(null);
  const [product,   setProduct]   = useState<Product | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const [isTyping,  setIsTyping]  = useState(false);
  const [sockReady, setSockReady] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  /* Buyer tracking */
  const [threadBuyerId, setThreadBuyerId] = useState<
    string | number | null
  >(null);

  /* Upload state */
  const [uploadingImages, setUploadingImages] = useState(false);

  /* ── UI state ───────────────────────────────────────────── */
  const [showMenu,        setShowMenu]        = useState(false);
  const [muted,           setMuted]           = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showAttach,      setShowAttach]      = useState(false);
  const [lightbox,        setLightbox]        = useState<LightboxState | null>(null);
  const [replyTo,         setReplyTo]         = useState<Message | null>(null);

  /* Context menu */
  const [ctxMsgId, setCtxMsgId] = useState<string | number | null>(null);
  const [ctxPos,   setCtxPos]   = useState<any>(null);

  /* Modals */
  const [offerModal,        setOfferModal]        = useState(false);
  const [counterModal,      setCounterModal]      = useState<Message | null>(null);
  const [locationModal,     setLocationModal]     = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportModal,   setShowReportModal]   = useState(false);
  const [deleteMsgTarget,   setDeleteMsgTarget]   = useState<Message | null>(null);

  /* ── Refs ───────────────────────────────────────────────── */
  const socketRef     = useRef<Socket | null>(null);
  const bottomRef     = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLTextAreaElement>(null);
  const typingTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyLoaded = useRef(false);
  const pendingMsgs   = useRef<Message[]>([]);
  const mounted       = useRef(true);
  const sendTimers    = useRef(
    new Map<string | number, ReturnType<typeof setTimeout>>()
  );
  const imageFileRef  = useRef<HTMLInputElement>(null);  // gallery images
  const cameraRef     = useRef<HTMLInputElement>(null);  // camera capture

  /* Always-fresh refs */
  const newMsgRef  = useRef("");
  const sendingRef = useRef(false);
  useEffect(() => { newMsgRef.current  = newMsg;   }, [newMsg]);
  useEffect(() => { sendingRef.current = sending;  }, [sending]);

  /* Mount guard */
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const safe = useCallback((fn: () => void) => {
    if (mounted.current) fn();
  }, []);

  /* ── Derived ────────────────────────────────────────────── */
  const suggestions = useMemo(
    () => pickSuggestions(messages, user?.id),
    [messages, user?.id]
  );

  const msgMap = useMemo(() => {
    const m = new Map<string | number, Message>();
    messages.forEach((msg) => m.set(msg.id, msg));
    return m;
  }, [messages]);

  const grouped     = useMemo(() => groupByDate(messages), [messages]);
  const canSend     = newMsg.trim().length > 0 && !sending;
  const isBuyerUser = threadBuyerId === user?.id;

  /* ════════════════════════════════════════════════════════════
     THREAD META
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!threadId || !user?.id) return;
    const ctrl = new AbortController();

    axios
      .get(`${API}/conversations/${threadId}`, {
        headers: authH(),
        signal:  ctrl.signal,
        timeout: 8_000,
      })
      .then(({ data }) => {
        const oid =
          data.other_user_id ||
          (data.buyer_id === user.id ? data.seller_id : data.buyer_id);

        safe(() => setThreadBuyerId(data.buyer_id));
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
              slug:   data.product_slug || data.product_id,
            })
          );
        }

        /* Enrich with full user profile */
        if (oid) {
          axios
            .get(`${API}/users/${oid}`, { headers: authH() })
            .then(({ data: u }) =>
              safe(() =>
                setOtherUser((prev: any) => ({
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
  }, [threadId, user?.id, safe]);

  /* ════════════════════════════════════════════════════════════
     SOCKET
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!user?.id || !threadId) return;

    const sock = io(SOCKET_URL, {
      transports:           ["websocket", "polling"],
      withCredentials:      false,
      query:                { userId: String(user.id) },
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

    const onReceive = (msg: Message) => {
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

    const onRead = ({ userId: uid }: { userId: string | number }) => {
      if (uid === user.id) return;
      safe(() => dispatch({ type: "MARK_READ", myId: user.id }));
    };

    const onTyping     = () => safe(() => setIsTyping(true));
    const onStopTyping = () => safe(() => setIsTyping(false));

    const onDeleted = ({ messageId }: { messageId: string | number }) =>
      safe(() => dispatch({ type: "SOFT_DELETE", id: messageId }));

    const onOfferUpdated = ({
      messageId,
      status,
    }: {
      messageId: string | number;
      status:    string;
    }) =>
      safe(() => dispatch({ type: "PATCH_OFFER", id: messageId, status }));

    const onOnline = ({ userId: uid }: { userId: string | number }) => {
      if (String(uid) !== String(user.id))
        safe(() =>
          setOtherUser((p: any) => (p ? { ...p, is_online: true } : p))
        );
    };
    const onOffline = ({ userId: uid }: { userId: string | number }) => {
      if (String(uid) !== String(user.id))
        safe(() =>
          setOtherUser((p: any) => (p ? { ...p, is_online: false } : p))
        );
    };

    sock.on("connect",        onConnect);
    sock.on("disconnect",     onDisconnect);
    sock.on("receiveMessage", onReceive);
    sock.on("messagesRead",   onRead);
    sock.on("userTyping",     onTyping);
    sock.on("userStopTyping", onStopTyping);
    sock.on("messageDeleted", onDeleted);
    sock.on("offerUpdated",   onOfferUpdated);
    sock.on("userOnline",     onOnline);
    sock.on("userOffline",    onOffline);

    return () => {
      sock.off("connect",        onConnect);
      sock.off("disconnect",     onDisconnect);
      sock.off("receiveMessage", onReceive);
      sock.off("messagesRead",   onRead);
      sock.off("userTyping",     onTyping);
      sock.off("userStopTyping", onStopTyping);
      sock.off("messageDeleted", onDeleted);
      sock.off("offerUpdated",   onOfferUpdated);
      sock.off("userOnline",     onOnline);
      sock.off("userOffline",    onOffline);
      sock.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, threadId, safe]);

  /* ════════════════════════════════════════════════════════════
     LOAD HISTORY  (with localStorage cache)
  ════════════════════════════════════════════════════════════ */
  const loadHistory = useCallback(async () => {
    if (!user?.id || !threadId) return;

    historyLoaded.current = false;
    pendingMsgs.current   = [];

    /* 1) Hydrate from cache first so UI never looks broken */
    const cached = loadCachedMessages(threadId);
    if (cached && cached.length) {
      safe(() => {
        dispatch({ type: "SET", payload: cached });
        setLoading(false);
        setError(null);
      });
    } else {
      safe(() => { setLoading(true); setError(null); });
    }

    /* 2) Fetch fresh from network */
    try {
      const { data } = await axios.get(`${API}/messages`, {
        params:  { threadId, userId: user.id },
        headers: authH(),
        timeout: 12_000,
      });

      const all = dedupe([
        ...(Array.isArray(data) ? data : []),
        ...pendingMsgs.current,
      ]);

      pendingMsgs.current   = [];
      historyLoaded.current = true;

      safe(() => {
        dispatch({ type: "SET", payload: all });
        setError(null);
      });

      /* 3) Update cache with fresh data */
      saveCachedMessages(threadId, all);

      socketRef.current?.emit("markRead", { threadId, userId: user.id });
      axios
        .patch(
          `${API}/conversations/${threadId}/read`,
          { userId: user.id },
          { headers: authH() }
        )
        .catch(() => {});
    } catch (err: any) {
      historyLoaded.current = true;

      /* Only show error if we have NOTHING to display */
      if (!cached || cached.length === 0) {
        safe(() =>
          setError(
            `${err.response?.status ?? "Network"} — ${
              err.response?.data?.message ?? err.message
            }`
          )
        );
      } else {
        console.warn("Message refresh failed, using cache:", err.message);
      }
    } finally {
      safe(() => setLoading(false));
    }
  }, [user?.id, threadId, safe]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  /* ════════════════════════════════════════════════════════════
     PERSIST MESSAGES TO LOCALSTORAGE
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!threadId || !historyLoaded.current) return;
    if (!messages.length) return;
    saveCachedMessages(threadId, messages);
  }, [messages, threadId]);

  /* ════════════════════════════════════════════════════════════
     AUTO-SCROLL
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  /* ════════════════════════════════════════════════════════════
     FOCUS INPUT ON THREAD CHANGE
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [threadId]);

  /* ════════════════════════════════════════════════════════════
     TEXTAREA AUTO-RESIZE on newMsg change
  ════════════════════════════════════════════════════════════ */
  useEffect(() => {
    resizeTextarea(inputRef.current);
  }, [newMsg]);

  /* ════════════════════════════════════════════════════════════
     TYPING
  ════════════════════════════════════════════════════════════ */
  const handleTyping = useCallback(() => {
    socketRef.current?.emit("typing", { threadId, userId: user?.id });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit("stopTyping", {
        threadId,
        userId: user?.id,
      });
    }, 1500);
  }, [threadId, user?.id]);

  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    },
    []
  );

  /* ════════════════════════════════════════════════════════════
     CORE SEND
  ════════════════════════════════════════════════════════════ */
  const doSend = useCallback(
    async (text: string, extras: Record<string, any> = {}) => {
      if (!text || typeof text !== "string") return;
      const trimmed = text.trim();
      if (!trimmed)           return;
      if (sendingRef.current) return;
      if (!user?.id)          return;
      if (!threadId)          return;

      const clientMsgId = `${user.id}_${Date.now()}`;
      const tempId      = `temp_${clientMsgId}`;
      const replyRef    = replyTo ? { reply_to_id: replyTo.id } : {};

      const msgType =
        extras.offerMeta
          ? MESSAGE_TYPES.OFFER
          : extras.location
          ? MESSAGE_TYPES.LOCATION
          : extras.shared_product
          ? MESSAGE_TYPES.PRODUCT
          : MESSAGE_TYPES.TEXT;

      const temp: any = {
        id:                tempId,
        client_message_id: clientMsgId,
        thread_id:         threadId,
        sender_id:         user.id,
        message:           trimmed,
        message_type:      msgType,
        created_at:        new Date().toISOString(),
        status:            "sending",
        _temp:             true,
        _failed:           false,
        _timedOut:         false,
        ...replyRef,
        ...(extras.offerMeta      ? { _offerMeta:    extras.offerMeta }      : {}),
        ...(extras.location       ? { location:       extras.location }       : {}),
        ...(extras.shared_product ? { shared_product: extras.shared_product } : {}),
      };

      dispatch({ type: "APPEND", payload: temp });

      /* reset textarea */
      setNewMsg("");
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }

      setSending(true);
      sendingRef.current = true;
      setShowSuggestions(false);
      setReplyTo(null);

      if (typingTimer.current) clearTimeout(typingTimer.current);
      socketRef.current?.emit("stopTyping", { threadId, userId: user.id });

      /* Timeout fallback */
      const timer = setTimeout(() => {
        if (mounted.current) {
          dispatch({
            type:  "PATCH",
            id:    tempId,
            patch: { _temp: false, _timedOut: true } as any,
          });
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
            senderId:        user.id,
            message:         trimmed,
            messageType:     msgType,
            clientMessageId: clientMsgId,
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
      } catch (err: any) {
        clearTimeout(sendTimers.current.get(tempId));
        sendTimers.current.delete(tempId);

        if (mounted.current) {
          dispatch({
            type:  "PATCH",
            id:    tempId,
            patch: { _temp: false, _failed: true, _timedOut: false } as any,
          });
          setNewMsg(trimmed);
        }
      } finally {
        if (mounted.current) {
          setSending(false);
          sendingRef.current = false;
        }
        inputRef.current?.focus();
      }
    },
    [threadId, user?.id, replyTo]
  );

  /* Button onClick — never receives event as text */
  const handleSend = useCallback(
    (e?: any) => {
      if (e?.preventDefault) e.preventDefault();
      const text = newMsgRef.current.trim();
      if (!text) return;
      doSend(text);
    },
    [doSend]
  );

  /* Called with (string, extras) from offer / location / product */
  const sendMessage = useCallback(
    (overrideText: string, extras: Record<string, any> = {}) => {
      const text =
        typeof overrideText === "string" && overrideText.trim()
          ? overrideText.trim()
          : newMsgRef.current.trim();
      if (!text) return;
      doSend(text, extras);
    },
    [doSend]
  );

  /* ════════════════════════════════════════════════════════════
     IMAGE UPLOAD  (multi — max 10 | 5 MB each)
  ════════════════════════════════════════════════════════════ */
  const handleImageChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      const localUrls = valid.map((f) => URL.createObjectURL(f));
      const count     = valid.length;
      const preview   = count === 1 ? "Photo" : `${count} Photos`;

      /* optimistic temp bubble — media_url always an array */
      dispatch({
        type: "APPEND",
        payload: {
          id:                tempId,
          client_message_id: clientMsgId,
          thread_id:         threadId,
          sender_id:         user.id,
          message:           preview,
          message_type:      MESSAGE_TYPES.MEDIA,
          media_url:         localUrls,
          created_at:        new Date().toISOString(),
          status:            "sending",
          _temp:             true,
          _failed:           false,
          _timedOut:         false,
          ...(replyTo ? { reply_to_id: replyTo.id } : {}),
        } as any,
      });

      setUploadingImages(true);
      setReplyTo(null);

      try {
        const form = new FormData();
        valid.forEach((f) => form.append("files", f));
        form.append("threadId",        threadId);
        form.append("senderId",        String(user.id));
        form.append("clientMessageId", clientMsgId);
        if (replyTo) form.append("reply_to_id", String(replyTo.id));

        const { data: saved } = await axios.post(
          `${API}/messages/upload`,
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
      } catch (err: any) {
        console.error("Image upload failed:", err.message);
        localUrls.forEach((u) => URL.revokeObjectURL(u));
        if (mounted.current)
          dispatch({
            type:  "PATCH",
            id:    tempId,
            patch: { _temp: false, _failed: true } as any,
          });
      } finally {
        safe(() => setUploadingImages(false));
      }
    },
    [threadId, user?.id, replyTo, safe]
  );

  /* ════════════════════════════════════════════════════════════
     OFFER HANDLERS
  ════════════════════════════════════════════════════════════ */
  const handleSendOffer = useCallback(
    (offerMeta: any) => {
      const label = `Offer: ${CURRENCY}${offerMeta.amount.toLocaleString()}`;
      sendMessage(label, { offerMeta });
    },
    [sendMessage]
  );

  const handleOfferRespond = useCallback(
    (origMsg: any, action: string) => {
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
    [threadId, user?.id, sendMessage]
  );

  /* ════════════════════════════════════════════════════════════
     DELETE MESSAGE  (custom modal)
  ════════════════════════════════════════════════════════════ */
  const handleDelete = useCallback((msg: Message) => {
    setDeleteMsgTarget(msg);
  }, []);

  const confirmDeleteMessage = useCallback(() => {
    const msg = deleteMsgTarget;
    setDeleteMsgTarget(null);
    if (!msg) return;
    if (mounted.current) dispatch({ type: "SOFT_DELETE", id: msg.id });
    socketRef.current?.emit("deleteMessage", {
      threadId,
      messageId: msg.id,
    });
    axios
      .delete(`${API}/messages/${msg.id}`, {
        data:    { userId: user.id },
        headers: authH(),
      })
      .catch(() => {});
  }, [deleteMsgTarget, threadId, user?.id]);

  const cancelDeleteMessage = useCallback(
    () => setDeleteMsgTarget(null),
    []
  );

  /* ════════════════════════════════════════════════════════════
     OTHER HANDLERS
  ════════════════════════════════════════════════════════════ */
  const handleCopy = useCallback((msg: Message) => {
    navigator.clipboard?.writeText(msg.message || "").catch(() => {});
  }, []);

  const handleSendLocation = useCallback(
    (coords: any, addr: string) => {
      sendMessage(
        addr ? truncate(addr, 50) : "My Location",
        { location: { ...coords, address: addr } }
      );
    },
    [sendMessage]
  );

  const handleShareProduct = useCallback(() => {
    if (!product) return;
    sendMessage(
      `${product.title} — ${CURRENCY}${Number(product.price).toLocaleString()}`,
      {
        shared_product: {
          id:    product.id    || "",
          slug:  product.slug  || product.id || "",
          title: product.title,
          price: product.price,
          image: product.images?.[0] || "",
        },
      }
    );
  }, [product, sendMessage]);

  /*
   * handleDeleteChat:
   *  - Desktop: clear right panel via onDeselectThread
   *  - Mobile : navigate(-1)
   */
  const handleDeleteChat = useCallback(async () => {
    try {
      await axios.delete(`${API}/conversations/${threadId}`, {
        data:    { userId: user.id },
        headers: authH(),
      });
      clearCachedMessages(threadId);
      if (onDeselectThread) {
        onDeselectThread();
      } else {
        navigate(-1);
      }
    } catch {
      alert("Failed to delete chat. Please try again.");
    }
  }, [threadId, user?.id, navigate, onDeselectThread]);

  /* Context menu */
  const handleCtx = useCallback(
    (msg: Message, pos: any, shortcut?: string) => {
      if (shortcut === "reply") {
        setReplyTo(msg);
        inputRef.current?.focus();
        return;
      }
      setCtxMsgId(msg.id);
      setCtxPos(pos);
    },
    []
  );

  const closeCtx = useCallback(() => {
    setCtxMsgId(null);
    setCtxPos(null);
  }, []);

  const ctxMsg = useMemo(
    () => (ctxMsgId ? msgMap.get(ctxMsgId) || null : null),
    [msgMap, ctxMsgId]
  );

  const handleCtxReply = useCallback(() => {
    if (ctxMsg) {
      setReplyTo(ctxMsg);
      inputRef.current?.focus();
    }
  }, [ctxMsg]);

  const handleCtxCopy = useCallback(() => {
    if (ctxMsg) handleCopy(ctxMsg);
  }, [ctxMsg, handleCopy]);

  const handleCtxDelete = useCallback(() => {
    if (ctxMsg) handleDelete(ctxMsg);
  }, [ctxMsg, handleDelete]);

  /* Retry failed message */
  const retryMessage = useCallback((fm: Message) => {
    dispatch({ type: "REMOVE", id: fm.id });
    setNewMsg(fm.message || "");
    setTimeout(() => resizeTextarea(inputRef.current), 0);
    inputRef.current?.focus();
  }, []);

  /* Keyboard — Enter inserts newline, Escape clears reply */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") setReplyTo(null);
      /* Enter → newline (default textarea behavior). Send only via button. */
    },
    []
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setNewMsg(e.target.value);
      resizeTextarea(e.target);
      handleTyping();
    },
    [handleTyping]
  );

  const isMine = useCallback(
    (m: Message) => m.sender_id === user?.id,
    [user?.id]
  );

  /* ════════════════════════════════════════════════════════════
     LIGHTBOX  (multi-media aware)
  ════════════════════════════════════════════════════════════ */
  const openLightbox = useCallback(
    (urls: string | string[] | null, index: number = 0) => {
      const list = asMediaArray(urls);
      if (list.length) setLightbox({ urls: list, index });
    },
    []
  );

  const closeLightbox = useCallback(() => setLightbox(null), []);

  const lightboxPrev = useCallback(
    () =>
      setLightbox((s) =>
        s && s.index > 0 ? { ...s, index: s.index - 1 } : s
      ),
    []
  );

  const lightboxNext = useCallback(
    () =>
      setLightbox((s) =>
        s && s.index < s.urls.length - 1
          ? { ...s, index: s.index + 1 }
          : s
      ),
    []
  );

  /* Keyboard nav for lightbox (desktop) */
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")     closeLightbox();
      if (e.key === "ArrowLeft")  lightboxPrev();
      if (e.key === "ArrowRight") lightboxNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, closeLightbox, lightboxPrev, lightboxNext]);

  /* ── Stable UI callbacks ─────────────────────────────────── */
  const openOfferModal    = useCallback(() => setOfferModal(true),  []);
  const closeOfferModal   = useCallback(() => setOfferModal(false), []);
  const closeCounterModal = useCallback(() => setCounterModal(null), []);
  const openLocationModal = useCallback(() => {
    setShowAttach(false);
    setLocationModal(true);
  }, []);
  const closeLocationModal   = useCallback(() => setLocationModal(false),      []);
  const toggleMenu           = useCallback(() => setShowMenu((v) => !v),       []);
  const closeMenu            = useCallback(() => setShowMenu(false),           []);
  const toggleAttach         = useCallback((e: any) => {
    e.stopPropagation();
    setShowAttach((v) => !v);
  }, []);
  const showSuggestionsAgain = useCallback(() => setShowSuggestions(true),     []);
  const handleMute           = useCallback(() => setMuted((v) => !v),          []);
  const openCamera           = useCallback(() => cameraRef.current?.click(),   []);
  const openGallery          = useCallback(() => imageFileRef.current?.click(),[]);
  const clearReply           = useCallback(() => setReplyTo(null),             []);
  const openDeleteConfirm    = useCallback(() => setShowDeleteConfirm(true),   []);
  const closeDeleteConfirm   = useCallback(() => setShowDeleteConfirm(false),  []);
  const openReportModal      = useCallback(() => setShowReportModal(true),     []);
  const closeReportModal     = useCallback(() => setShowReportModal(false),    []);

  const handleSelectSuggestion = useCallback((s: string) => {
    setNewMsg(s);
    setShowSuggestions(false);
    setTimeout(() => resizeTextarea(inputRef.current), 0);
    inputRef.current?.focus();
  }, []);

  const handleDismissSuggestions = useCallback(
    () => setShowSuggestions(false),
    []
  );

  const handleBodyClick = useCallback(() => {
    setCtxMsgId(null);
    setCtxPos(null);
    setShowAttach(false);
  }, []);

  /* Cleanup all send timers on unmount */
  useEffect(
    () => () => sendTimers.current.forEach((t) => clearTimeout(t)),
    []
  );

  /* ── Reply preview media info ────────────────────────────── */
  const replyMedia = useMemo(() => {
    if (!replyTo) return null;
    const urls = asMediaArray((replyTo as any).media_url);
    if (!urls.length) return null;
    const isVideo =
      (replyTo as any).message_type === "video" || isVideoUrl(urls[0]);
    return { urls, isVideo };
  }, [replyTo]);

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <div className="cp-panel" onClick={handleBodyClick}>

      {/* ── Header ─────────────────────────────────────────── */}
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
        onDeselectThread={onDeselectThread}
      />

      {/* ── Mute Banner ────────────────────────────────────── */}
      {muted && (
        <div className="cp-mute-banner">
          Notifications muted
          <button onClick={handleMute}>Unmute</button>
        </div>
      )}

      {/* ── Messages Body ──────────────────────────────────── */}
      <main className="cp-body">

        {loading && (
          <div className="cp-center">
            <div className="cp-spinner" />
          </div>
        )}

        {!loading && error && (
          <div className="cp-center">
            <p className="cp-center__title">Failed to load messages</p>
            <p className="cp-center__error-code">{error}</p>
            <button onClick={loadHistory} className="cp-center__retry-btn">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && messages.length === 0 && (
          <div className="cp-center">
            <p className="cp-center__title">No messages yet</p>
            <p className="cp-center__sub">
              Say hello or make an offer to start!
            </p>
          </div>
        )}

        {!loading &&
          !error &&
          messages.length > 0 &&
          grouped.map((item: any, i: number) =>
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
                    ? msgMap.get(item.data.reply_to_id) || null
                    : null
                }
              />
            )
          )}

        {isTyping && <TypingBubble />}

        {/* Upload progress banner */}
        {uploadingImages && (
          <div className="cp-upload-banner">
            <div className="cp-spinner cp-spinner--sm" />
            <span>Uploading photos…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* ── Context Menu ───────────────────────────────────── */}
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

      {/* ── Toolbar ────────────────────────────────────────── */}
      <div className="cp-toolbar">
        {isBuyerUser && (
          <button
            className="cp-toolbar__btn cp-toolbar__btn--offer"
            onClick={openOfferModal}
          >
            {Icon.offer} Make Offer
          </button>
        )}
        {product && (
          <button
            className="cp-toolbar__btn cp-toolbar__btn--share"
            onClick={handleShareProduct}
          >
            {Icon.product} Share Product
          </button>
        )}
        {!showSuggestions && (
          <button className="cp-toolbar__btn" onClick={showSuggestionsAgain}>
            {Icon.suggest} Suggestions
          </button>
        )}
      </div>

      {/* ── Suggestions ────────────────────────────────────── */}
      {showSuggestions && (
        <SuggestionsBar
          suggestions={suggestions}
          onSelect={handleSelectSuggestion}
          onDismiss={handleDismissSuggestions}
        />
      )}

      {/* ── Reply Preview ──────────────────────────────────── */}
      {replyTo && (
        <div className="cp-reply-preview">
          {Icon.reply}
          <div className="cp-reply-preview__text">
            <div className="cp-reply-preview__sender">
              {replyTo.sender_id === user?.id ? "You" : otherUser?.name}
            </div>

            {replyMedia ? (
              <div
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                {replyMedia.isVideo ? (
                  <div className="cp-reply-preview__video-thumb">
                    {(Icon as any).video || "▶"}
                  </div>
                ) : (
                  <img
                    src={replyMedia.urls[0]}
                    alt=""
                    className="cp-reply-preview__thumb"
                  />
                )}
                <span className="cp-reply-preview__msg">
                  {replyMedia.isVideo
                    ? replyMedia.urls.length > 1
                      ? `${replyMedia.urls.length} Videos`
                      : "Video"
                    : replyMedia.urls.length > 1
                    ? `${replyMedia.urls.length} Photos`
                    : "Photo"}
                </span>
              </div>
            ) : (
              <div className="cp-reply-preview__msg">
                {truncate(replyTo.message || "")}
              </div>
            )}
          </div>
          <button className="cp-reply-preview__close" onClick={clearReply}>
            {Icon.close}
          </button>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="cp-footer">

        {/* Attach popover */}
        {showAttach && (
          <div className="cp-attach-popover">

            <button className="cp-attach-option" onClick={openCamera}>
              {Icon.camera}
              <span>Camera</span>
            </button>

            <button className="cp-attach-option" onClick={openGallery}>
              {Icon.gallery}
              <span>
                Photo
                <small className="cp-attach-option__hint">
                  max {IMAGE_MAX_COUNT} · 5 MB each
                </small>
              </span>
            </button>

            <button className="cp-attach-option" onClick={openLocationModal}>
              {Icon.location}
              <span>Location</span>
            </button>

          </div>
        )}

        {/* Hidden file inputs */}
        {/* images — gallery, multi-select */}
        <input
          ref={imageFileRef}
          type="file"
          accept="image/*"
          multiple
          className="cp-footer__file-input"
          onChange={handleImageChange}
        />
        {/* camera capture — single */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="cp-footer__file-input"
          onChange={handleImageChange}
        />

        {/* Attach toggle */}
        <button
          className="cp-footer__attach-btn"
          onClick={toggleAttach}
          aria-label="Attach"
        >
          {Icon.plus}
        </button>

        {/* Textarea — Enter = newline, tap Send to send */}
        <textarea
          ref={inputRef}
          className="cp-footer__input"
          value={newMsg}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          enterKeyHint="enter"
          placeholder={replyTo ? "Write a reply…" : "Type a message…"}
          aria-label="Message"
          maxLength={5000}
          rows={1}
        />

        {/* Send button */}
        <button
          className={`cp-footer__send-btn ${
            canSend
              ? "cp-footer__send-btn--active"
              : "cp-footer__send-btn--disabled"
          }`}
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send"
        >
          {sending ? (
            <div className="cp-spinner cp-spinner--sm" />
          ) : (
            Icon.send
          )}
        </button>

      </footer>

      {/* ── Lightbox (multi-image + keyboard nav) ──────────── */}
      {lightbox && lightbox.urls.length > 0 && (
        <div className="cp-lightbox" onClick={closeLightbox}>

          {/* prev */}
          {lightbox.index > 0 && (
            <button
              className="cp-lightbox__nav cp-lightbox__nav--prev"
              onClick={(e) => { e.stopPropagation(); lightboxPrev(); }}
              aria-label="Previous"
            >
              ‹
            </button>
          )}

          {/* media */}
          {isVideoUrl(lightbox.urls[lightbox.index]) ? (
            <video
              src={lightbox.urls[lightbox.index]}
              className="cp-lightbox__img"
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={lightbox.urls[lightbox.index]}
              alt={`Media ${lightbox.index + 1}`}
              className="cp-lightbox__img"
              onClick={(e) => e.stopPropagation()}
            />
          )}

          {/* next */}
          {lightbox.index < lightbox.urls.length - 1 && (
            <button
              className="cp-lightbox__nav cp-lightbox__nav--next"
              onClick={(e) => { e.stopPropagation(); lightboxNext(); }}
              aria-label="Next"
            >
              ›
            </button>
          )}

          {/* counter */}
          {lightbox.urls.length > 1 && (
            <div className="cp-lightbox__counter">
              {lightbox.index + 1} / {lightbox.urls.length}
            </div>
          )}

          <button className="cp-lightbox__close" onClick={closeLightbox}>
            {Icon.close}
          </button>

        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────── */}
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

      {/* ── Delete Chat Confirm ────────────────────────────── */}
      {showDeleteConfirm && (
        <DeleteChatConfirm
          onConfirm={() => {
            setShowDeleteConfirm(false);
            handleDeleteChat();
          }}
          onCancel={closeDeleteConfirm}
        />
      )}

      {/* ── Report Modal ───────────────────────────────────── */}
      {showReportModal && (
        <ReportModal
          threadId={threadId}
          userId={user?.id}
          otherUserName={otherUser?.name || "Seller"}
          onClose={closeReportModal}
          onSuccess={() => {}}
        />
      )}

      {/* ── Delete Message Confirm (custom themed) ─────────── */}
      {deleteMsgTarget && (
        <DeleteMessageConfirm
          onConfirm={confirmDeleteMessage}
          onCancel={cancelDeleteMessage}
        />
      )}

    </div>
  );
};

export default ChatPanel;
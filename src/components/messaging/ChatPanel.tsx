import {
  useEffect,
  useState,
  useCallback,
  useRef,
  useReducer,
  useMemo,
  FC,
  KeyboardEvent,
  ChangeEvent,
} from "react";
import { io, Socket } from "socket.io-client";
import axios from "axios";

import { User, Message, Product } from "./types";
import "../../styles/chat-panel.css";

/* ─────────────────────────────────────────
   Constants
───────────────────────────────────────── */
const BASE       = import.meta.env.VITE_API_BASE_URL as string;
const API        = `${BASE}/api`;
const SOCKET_URL = BASE;

/* ─────────────────────────────────────────
   Auth
───────────────────────────────────────── */
const getToken = (): string =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  sessionStorage.getItem("token") ||
  "";

const authH = (): Record<string, string> => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
const dedupe = (msgs: Message[]): Message[] => {
  const seen = new Set<string | number>();
  return msgs.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
};

const formatTime = (dateStr?: string): string => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return "";
  const d   = new Date(dateStr);
  const now = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d >= today)     return "Today";
  if (d >= yesterday) return "Yesterday";
  return d.toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

interface GroupedItem {
  type:   "date" | "message";
  label?: string;
  data?:  Message;
}

const groupByDate = (msgs: Message[]): GroupedItem[] => {
  const out: GroupedItem[] = [];
  let lastDate = "";
  for (const m of msgs) {
    const label = formatDate(m.created_at);
    if (label && label !== lastDate) {
      out.push({ type: "date", label });
      lastDate = label;
    }
    out.push({ type: "message", data: m });
  }
  return out;
};

/* ─────────────────────────────────────────
   Reducer
───────────────────────────────────────── */
type MsgAction =
  | { type: "SET";         payload: Message[] }
  | { type: "APPEND";      payload: Message }
  | { type: "REPLACE";     tempId: string | number; payload: Message }
  | { type: "PATCH";       id: string | number; patch: Partial<Message> }
  | { type: "SOFT_DELETE"; id: string | number }
  | { type: "MARK_READ";   myId: string | number }
  | { type: "REMOVE";      id: string | number };

function msgsReducer(state: Message[], action: MsgAction): Message[] {
  switch (action.type) {
    case "SET":
      return dedupe(action.payload);

    case "APPEND":
      if (state.some((m) => m.id === action.payload.id)) return state;
      return dedupe([...state, action.payload]);

    case "REPLACE": {
      let replaced = false;
      const next = state.map((m) => {
        if (m.id === action.tempId) {
          replaced = true;
          return action.payload;
        }
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
        if (state.some((m) => m.id === action.payload.id)) return state;
        return dedupe([...state, action.payload]);
      }
      return next;
    }

    case "PATCH":
      return state.map((m) =>
        m.id === action.id ? { ...m, ...action.patch } : m
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

/* ─────────────────────────────────────────
   Sub-components
───────────────────────────────────────── */
const DateSep: FC<{ label: string }> = ({ label }) => (
  <div className="cp-date-sep">
    <div className="cp-date-sep__line" />
    <span className="cp-date-sep__label">{label}</span>
    <div className="cp-date-sep__line" />
  </div>
);

const TypingIndicator: FC = () => (
  <div className="cp-typing">
    <div className="cp-typing__bubble">
      <span className="cp-typing__dot" />
      <span className="cp-typing__dot" />
      <span className="cp-typing__dot" />
    </div>
  </div>
);

interface BubbleProps {
  msg:        Message;
  mine:       boolean;
  onLightbox: (url: string) => void;
}

const Bubble: FC<BubbleProps> = ({ msg, mine, onLightbox }) => {
  if (msg._deleted) {
    return (
      <div className={`cp-bubble--deleted${mine ? " cp-bubble--deleted--mine" : ""}`}>
        <span className="cp-bubble__deleted-text">Message deleted</span>
      </div>
    );
  }

  const hasMedia = !!msg.media_url;

  return (
    <div className={`cp-bubble-row${mine ? " cp-bubble-row--mine" : ""}`}>
      <div
        className={`cp-bubble ${mine ? "cp-bubble--mine" : "cp-bubble--theirs"}${
          hasMedia ? " cp-bubble--media" : ""
        }`}
      >
        {/* Media */}
        {hasMedia && (
          <img
            className="cp-bubble__media"
            src={msg.media_url!}
            alt="Attachment"
            onClick={() => onLightbox(msg.media_url!)}
          />
        )}

        {/* Text */}
        {!hasMedia && msg.message && (
          <span className="cp-bubble__text">{msg.message}</span>
        )}

        {/* Failed indicator */}
        {(msg._failed || msg._timedOut) && (
          <div className="cp-bubble__failed">
            {msg._timedOut ? "⚠ Timed out" : "⚠ Failed to send"}
          </div>
        )}

        {/* Time */}
        <div className="cp-bubble__time">
          {msg.status === "sending" && !msg._failed && !msg._timedOut
            ? "Sending…"
            : formatTime(msg.created_at)}
          {mine && msg.status === "read" && (
            <span className="cp-bubble__read"> ✓✓</span>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   Props
───────────────────────────────────────── */
interface ChatPanelProps {
  threadId: string;
  user:     User;
}

/* ─────────────────────────────────────────
   Component
───────────────────────────────────────── */
const ChatPanel: FC<ChatPanelProps> = ({ threadId, user }) => {
  const [messages,  dispatch]     = useReducer(msgsReducer, []);
  const [newMsg,    setNewMsg]    = useState("");
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [product,   setProduct]   = useState<Product | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const [isTyping,  setIsTyping]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [lightbox,  setLightbox]  = useState<string | null>(null);

  const socketRef     = useRef<Socket | null>(null);
  const bottomRef     = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLInputElement>(null);
  const typingTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyLoaded = useRef(false);
  const pendingMsgs   = useRef<Message[]>([]);
  const mounted       = useRef(true);
  const fileRef       = useRef<HTMLInputElement>(null);
  const newMsgRef     = useRef("");

  useEffect(() => { newMsgRef.current = newMsg; }, [newMsg]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const safe = useCallback((fn: () => void) => {
    if (mounted.current) fn();
  }, []);

  const grouped = useMemo(() => groupByDate(messages), [messages]);
  const canSend = newMsg.trim().length > 0 && !sending;

  /* ── Thread meta ── */
  useEffect(() => {
    if (!threadId || !user?.id) return;
    const ctrl = new AbortController();

    axios
      .get(`${API}/conversations/${threadId}`, {
        headers: authH(),
        signal: ctrl.signal,
      })
      .then(({ data }) => {
        const oid =
          data.other_user_id ||
          (data.buyer_id === user.id ? data.seller_id : data.buyer_id);

        safe(() =>
          setOtherUser({
            id:            oid,
            name:          data.other_user_name || "User",
            profile_image: data.other_user_image || null,
            is_online:     data.other_user_online || false,
          })
        );

        if (data.product_title) {
          safe(() =>
            setProduct({
              id:     data.product_id,
              slug:   data.product_slug || data.product_id,
              title:  data.product_title,
              price:  data.product_price,
              images: data.product_image ? [data.product_image] : [],
            })
          );
        }
      })
      .catch(() => {});

    return () => ctrl.abort();
  }, [threadId, user?.id, safe]);

  /* ── Socket ── */
  useEffect(() => {
    if (!user?.id || !threadId) return;

    const sock = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      query: { userId: String(user.id) },
      reconnection: true,
      reconnectionAttempts: 10,
    });
    socketRef.current = sock;

    sock.on("connect", () => {
      sock.emit("joinThread", { threadId, userId: user.id });
    });

    sock.on("receiveMessage", (msg: Message) => {
      if (!msg?.id || msg.sender_id === user.id) return;
      if (!historyLoaded.current) {
        pendingMsgs.current.push(msg);
        return;
      }
      safe(() => dispatch({ type: "APPEND", payload: msg }));
      sock.emit("markRead", { threadId, userId: user.id });
    });

    sock.on("messagesRead", ({ userId: uid }: { userId: string | number }) => {
      if (uid !== user.id)
        safe(() => dispatch({ type: "MARK_READ", myId: user.id }));
    });

    sock.on("userTyping", () => safe(() => setIsTyping(true)));
    sock.on("userStopTyping", () => safe(() => setIsTyping(false)));

    sock.on(
      "messageDeleted",
      ({ messageId }: { messageId: string | number }) =>
        safe(() => dispatch({ type: "SOFT_DELETE", id: messageId }))
    );

    sock.on("userOnline", ({ userId: uid }: { userId: string | number }) => {
      if (String(uid) !== String(user.id))
        safe(() =>
          setOtherUser((p) => (p ? { ...p, is_online: true } : p))
        );
    });

    sock.on("userOffline", ({ userId: uid }: { userId: string | number }) => {
      if (String(uid) !== String(user.id))
        safe(() =>
          setOtherUser((p) => (p ? { ...p, is_online: false } : p))
        );
    });

    return () => {
      sock.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, threadId, safe]);

  /* ── Load history ── */
  const loadHistory = useCallback(async () => {
    if (!user?.id || !threadId) return;
    historyLoaded.current = false;
    pendingMsgs.current   = [];
    safe(() => {
      setLoading(true);
      setError(null);
    });

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

      safe(() => dispatch({ type: "SET", payload: all }));

      socketRef.current?.emit("markRead", { threadId, userId: user.id });
      axios
        .patch(
          `${API}/conversations/${threadId}/read`,
          { userId: user.id },
          { headers: authH() }
        )
        .catch(() => {});
    } catch (err: any) {
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

  /* ── Auto-scroll ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  /* ── Focus input ── */
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [threadId]);

  /* ── Typing ── */
  const handleTyping = useCallback(() => {
    socketRef.current?.emit("typing", { threadId, userId: user?.id });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit("stopTyping", { threadId, userId: user?.id });
    }, 1500);
  }, [threadId, user?.id]);

  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }, []);

  /* ── Send text ── */
  const doSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !user?.id || !threadId) return;

      const clientMsgId = `${user.id}_${Date.now()}`;
      const tempId      = `temp_${clientMsgId}`;

      const temp: Message = {
        id:                tempId,
        client_message_id: clientMsgId,
        thread_id:         threadId,
        sender_id:         user.id,
        message:           trimmed,
        message_type:      "text",
        created_at:        new Date().toISOString(),
        status:            "sending",
        _temp:             true,
      };

      dispatch({ type: "APPEND", payload: temp });
      setNewMsg("");
      setSending(true);

      if (typingTimer.current) clearTimeout(typingTimer.current);
      socketRef.current?.emit("stopTyping", { threadId, userId: user.id });

      try {
        const { data: saved } = await axios.post(
          `${API}/messages`,
          {
            threadId,
            senderId:        user.id,
            message:         trimmed,
            messageType:     "text",
            clientMessageId: clientMsgId,
          },
          { headers: authH(), timeout: 15_000 }
        );

        if (mounted.current)
          dispatch({ type: "REPLACE", tempId, payload: saved });

        socketRef.current?.emit("sendMessage", saved);
      } catch {
        if (mounted.current)
          dispatch({
            type: "PATCH",
            id: tempId,
            patch: { _temp: false, _failed: true },
          });
        setNewMsg(trimmed);
      } finally {
        if (mounted.current) setSending(false);
        inputRef.current?.focus();
      }
    },
    [threadId, user?.id]
  );

  const handleSend = useCallback(() => {
    doSend(newMsgRef.current);
  }, [doSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setNewMsg(e.target.value);
      handleTyping();
    },
    [handleTyping]
  );

  /* ── Image upload ── */
  const handleImageChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";

      if (!file.type.startsWith("image/")) {
        alert("Only images are allowed.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert("Image too large. Maximum is 10 MB.");
        return;
      }

      const clientMsgId = `${user.id}_${Date.now()}`;
      const tempId      = `temp_${clientMsgId}`;
      const localUrl    = URL.createObjectURL(file);

      dispatch({
        type: "APPEND",
        payload: {
          id:                tempId,
          client_message_id: clientMsgId,
          thread_id:         threadId,
          sender_id:         user.id,
          message:           "Photo",
          message_type:      "media",
          media_url:         localUrl,
          created_at:        new Date().toISOString(),
          status:            "sending",
          _temp:             true,
        },
      });

      try {
        const form = new FormData();
        form.append("file",            file);
        form.append("threadId",        threadId);
        form.append("senderId",        String(user.id));
        form.append("messageType",     "media");
        form.append("clientMessageId", clientMsgId);

        const { data: saved } = await axios.post(
          `${API}/messages/upload`,
          form,
          {
            headers: { ...authH(), "Content-Type": "multipart/form-data" },
            timeout: 30_000,
          }
        );

        URL.revokeObjectURL(localUrl);
        if (mounted.current)
          dispatch({ type: "REPLACE", tempId, payload: saved });
        socketRef.current?.emit("sendMessage", saved);
      } catch {
        URL.revokeObjectURL(localUrl);
        if (mounted.current)
          dispatch({
            type: "PATCH",
            id: tempId,
            patch: { _temp: false, _failed: true },
          });
      }
    },
    [threadId, user?.id]
  );

  /* ── Lightbox handlers ── */
  const openLightbox  = useCallback((url: string) => setLightbox(url), []);
  const closeLightbox = useCallback(() => setLightbox(null), []);

  /* ── Avatar fallback ── */
  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    otherUser?.name || "U"
  )}&background=FF5C00&color=fff&size=84`;

  /* ─────────────────────────────────────────
     Render
  ───────────────────────────────────────── */
  return (
    <div className="cp-panel">
      {/* ── Header ── */}
      <div className="cp-header">
        {otherUser ? (
          <>
            <div className="cp-header__avatar-wrap">
              <img
                className="cp-header__avatar"
                src={otherUser.profile_image || avatarFallback}
                alt={otherUser.name || "User"}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = avatarFallback;
                }}
              />
              {otherUser.is_online && (
                <span className="cp-header__online-dot" />
              )}
            </div>

            <div className="cp-header__info">
              <div className="cp-header__name">
                {otherUser.name || "User"}
              </div>
              <div
                className={`cp-header__status ${
                  isTyping
                    ? "cp-header__status--typing"
                    : otherUser.is_online
                    ? "cp-header__status--online"
                    : "cp-header__status--offline"
                }`}
              >
                {isTyping
                  ? "typing…"
                  : otherUser.is_online
                  ? "Online"
                  : "Offline"}
              </div>
            </div>

            {/* Product chip */}
            {product && (
              <div className="cp-header__product">
                {product.images?.[0] && (
                  <img
                    className="cp-header__product-img"
                    src={product.images[0]}
                    alt=""
                  />
                )}
                <div>
                  <div className="cp-header__product-title">
                    {product.title}
                  </div>
                  {product.price !== undefined && (
                    <div className="cp-header__product-price">
                      ${Number(product.price).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="cp-header__skeleton" />
        )}
      </div>

      {/* ── Messages Body ── */}
      <div className="cp-body">
        {/* Loading */}
        {loading && (
          <div className="cp-center">
            <div className="cp-spinner" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="cp-center">
            <p className="cp-center__title">Failed to load messages</p>
            <p className="cp-center__error-code">{error}</p>
            <button
              className="cp-center__retry-btn"
              onClick={loadHistory}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && messages.length === 0 && (
          <div className="cp-center">
            <p className="cp-center__title">No messages yet</p>
            <p className="cp-center__sub">
              Say hello to get started! 👋
            </p>
          </div>
        )}

        {/* Messages */}
        {!loading &&
          !error &&
          grouped.map((item, i) =>
            item.type === "date" ? (
              <DateSep key={`d_${i}`} label={item.label!} />
            ) : (
              <Bubble
                key={item.data!.id}
                msg={item.data!}
                mine={item.data!.sender_id === user.id}
                onLightbox={openLightbox}
              />
            )
          )}

        {/* Typing */}
        {isTyping && <TypingIndicator />}

        <div ref={bottomRef} />
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div className="cp-lightbox" onClick={closeLightbox}>
          <img
            className="cp-lightbox__img"
            src={lightbox}
            alt="Full size"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="cp-lightbox__close"
            onClick={closeLightbox}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="cp-footer">
        {/* Hidden file input */}
        <input
          ref={fileRef}
          className="cp-footer__file-input"
          type="file"
          accept="image/*"
          onChange={handleImageChange}
        />

        {/* Attach */}
        <button
          className="cp-footer__attach-btn"
          onClick={() => fileRef.current?.click()}
          aria-label="Attach image"
        >
          <svg
            width="20"
            height="20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586
                 a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
            />
          </svg>
        </button>

        {/* Text input */}
        <input
          ref={inputRef}
          className="cp-footer__input"
          type="text"
          value={newMsg}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          maxLength={5000}
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
            <svg
              width="18"
              height="18"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 12h14M12 5l7 7-7 7"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;
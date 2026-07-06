import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useReducer,
  useMemo,
  FC,
  KeyboardEvent,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import axios from "axios";

import ConversationsSidebar from "../components/messaging/ConversationsSidebar";
import { Thread, User, Message, Product, OfferMeta } from "../components/messaging/types";

/* ─────────────────────────────────────────────
   ENV
───────────────────────────────────────────── */
const BASE       = import.meta.env.VITE_API_BASE_URL as string;
const API        = `${BASE}/api`;
const SOCKET_URL = BASE;

/* ─────────────────────────────────────────────
   Auth
───────────────────────────────────────────── */
const getToken = (): string =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  sessionStorage.getItem("token") ||
  "";

const authH = (): Record<string, string> => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
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
  return d.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
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

/* ─────────────────────────────────────────────
   Messages Reducer
───────────────────────────────────────────── */
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

    case "APPEND": {
      if (state.some((m) => m.id === action.payload.id)) return state;
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

/* ─────────────────────────────────────────────
   Spinner
───────────────────────────────────────────── */
const Spinner: FC<{ size?: number }> = ({ size = 28 }) => (
  <div style={{
    width: size, height: size,
    border: "3px solid #eee",
    borderTop: "3px solid #111",
    borderRadius: "50%",
    animation: "spin .75s linear infinite",
  }} />
);

/* ─────────────────────────────────────────────
   Avatar (compact)
───────────────────────────────────────────── */
const Avatar: FC<{ src?: string | null; name?: string; size?: number }> = ({
  src, name, size = 36,
}) => {
  const fb = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "U"
  )}&background=111&color=fff&size=${size * 2}`;
  return (
    <img
      src={src || fb}
      alt={name || "User"}
      onError={(e) => { (e.currentTarget as HTMLImageElement).src = fb; }}
      style={{
        width: size, height: size,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
        background: "#eee",
      }}
    />
  );
};

/* ─────────────────────────────────────────────
   Message Bubble
───────────────────────────────────────────── */
interface BubbleProps {
  msg:  Message;
  mine: boolean;
}

const Bubble: FC<BubbleProps> = ({ msg, mine }) => {
  if (msg._deleted) {
    return (
      <div style={{
        display: "flex",
        justifyContent: mine ? "flex-end" : "flex-start",
        padding: "2px 20px",
      }}>
        <span style={{
          fontSize: 12, color: "#bbb",
          fontStyle: "italic", padding: "6px 10px",
        }}>
          Message deleted
        </span>
      </div>
    );
  }

  const bubbleBg   = mine ? "#111" : "#f0f0f0";
  const bubbleText = mine ? "#fff" : "#111";

  return (
    <div style={{
      display: "flex",
      flexDirection: mine ? "row-reverse" : "row",
      alignItems: "flex-end",
      gap: 8,
      padding: "3px 20px",
    }}>
      <div style={{
        maxWidth: "65%",
        background: bubbleBg,
        color: bubbleText,
        borderRadius: mine
          ? "18px 18px 4px 18px"
          : "18px 18px 18px 4px",
        padding: msg.media_url ? "4px" : "10px 14px",
        position: "relative",
        wordBreak: "break-word",
      }}>
        {/* Media */}
        {msg.media_url && (
          <img
            src={msg.media_url}
            alt="Attachment"
            style={{
              maxWidth: 240, maxHeight: 200,
              borderRadius: 14,
              display: "block",
              objectFit: "cover",
            }}
          />
        )}

        {/* Text */}
        {!msg.media_url && (
          <span style={{ fontSize: 14, lineHeight: 1.45 }}>
            {msg.message}
          </span>
        )}

        {/* Failed / timed-out overlay */}
        {(msg._failed || msg._timedOut) && (
          <div style={{
            fontSize: 10, color: mine ? "#fca5a5" : "#ef4444",
            marginTop: 4,
          }}>
            {msg._timedOut ? "⚠ Timed out" : "⚠ Failed to send"}
          </div>
        )}

        {/* Timestamp */}
        <div style={{
          fontSize: 10,
          color: mine ? "rgba(255,255,255,.55)" : "#aaa",
          marginTop: 4,
          textAlign: "right",
        }}>
          {msg.status === "sending" && !msg._failed && !msg._timedOut
            ? "Sending…"
            : formatTime(msg.created_at)}
          {mine && msg.status === "read" && " ✓✓"}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Date Separator
───────────────────────────────────────────── */
const DateSep: FC<{ label: string }> = ({ label }) => (
  <div style={{
    display: "flex", alignItems: "center",
    gap: 12, padding: "10px 20px",
  }}>
    <div style={{ flex: 1, height: 1, background: "#f0f0f0" }} />
    <span style={{ fontSize: 11, color: "#bbb", fontWeight: 600, whiteSpace: "nowrap" }}>
      {label}
    </span>
    <div style={{ flex: 1, height: 1, background: "#f0f0f0" }} />
  </div>
);

/* ─────────────────────────────────────────────
   Typing Indicator
───────────────────────────────────────────── */
const TypingIndicator: FC = () => (
  <div style={{
    display: "flex", alignItems: "center",
    gap: 4, padding: "6px 20px",
  }}>
    <div style={{
      display: "flex", alignItems: "center",
      gap: 3, background: "#f0f0f0",
      borderRadius: "18px 18px 18px 4px",
      padding: "10px 14px",
    }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 6, height: 6,
          borderRadius: "50%",
          background: "#aaa",
          display: "inline-block",
          animation: `typing 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  </div>
);

/* ─────────────────────────────────────────────
   Empty Chat Pane
───────────────────────────────────────────── */
const NoChatSelected: FC = () => (
  <div style={{
    flex: 1, display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    background: "#fafafa",
  }}>
    <svg width="72" height="72" fill="none" viewBox="0 0 24 24"
      stroke="#ddd" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03
           8-9 8a9.77 9.77 0 01-4-.85L3 20l1.09-3.27C3.4
           15.56 3 13.82 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
    <p style={{ fontSize: 16, fontWeight: 700, color: "#ccc", margin: 0 }}>
      Select a conversation
    </p>
    <p style={{
      fontSize: 13, color: "#ddd", margin: 0,
      textAlign: "center", maxWidth: 260, lineHeight: 1.5,
    }}>
      Choose from your conversations on the left
      to start chatting.
    </p>
  </div>
);

/* ─────────────────────────────────────────────
   Chat Panel (right side)
───────────────────────────────────────────── */
interface ChatPanelProps {
  threadId: string;
  user:     User;
}

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

  const safe = useCallback(<T,>(fn: () => T) => {
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
            name:          data.other_user_name  || "User",
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
  }, [threadId, user?.id]); // eslint-disable-line

  /* ── Socket ── */
  useEffect(() => {
    if (!user?.id || !threadId) return;

    const sock = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      query: { userId: user.id },
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

    sock.on("messagesRead",   ({ userId: uid }: { userId: string }) => {
      if (uid !== user.id) safe(() => dispatch({ type: "MARK_READ", myId: user.id }));
    });
    sock.on("userTyping",     () => safe(() => setIsTyping(true)));
    sock.on("userStopTyping", () => safe(() => setIsTyping(false)));
    sock.on("messageDeleted", ({ messageId }: { messageId: string | number }) =>
      safe(() => dispatch({ type: "SOFT_DELETE", id: messageId }))
    );
    sock.on("userOnline",  ({ userId: uid }: { userId: string }) => {
      if (uid !== String(user.id))
        safe(() => setOtherUser((p) => p ? { ...p, is_online: true }  : p));
    });
    sock.on("userOffline", ({ userId: uid }: { userId: string }) => {
      if (uid !== String(user.id))
        safe(() => setOtherUser((p) => p ? { ...p, is_online: false } : p));
    });

    return () => {
      sock.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, threadId]); // eslint-disable-line

  /* ── Load history ── */
  const loadHistory = useCallback(async () => {
    if (!user?.id || !threadId) return;
    historyLoaded.current = false;
    pendingMsgs.current   = [];
    safe(() => { setLoading(true); setError(null); });

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
        .patch(`${API}/conversations/${threadId}/read`,
          { userId: user.id }, { headers: authH() })
        .catch(() => {});
    } catch (err: any) {
      safe(() => setError(
        `${err.response?.status ?? "Network"} — ${
          err.response?.data?.message ?? err.message
        }`
      ));
    } finally {
      safe(() => setLoading(false));
    }
  }, [user?.id, threadId, safe]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  /* ── Focus input when thread changes ── */
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [threadId]);

  /* ── Typing ── */
  const handleTyping = useCallback(() => {
    socketRef.current?.emit("typing", { threadId, userId: user?.id });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit("stopTyping", { threadId, userId: user?.id });
    }, 1500);
  }, [threadId, user?.id]);

  /* ── Send ── */
  const doSend = useCallback(async (text: string) => {
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
        dispatch({ type: "PATCH", id: tempId,
          patch: { _temp: false, _failed: true } });
      setNewMsg(trimmed);
    } finally {
      if (mounted.current) setSending(false);
      inputRef.current?.focus();
    }
  }, [threadId, user?.id]);

  const handleSend = useCallback(() => {
    doSend(newMsgRef.current);
  }, [doSend]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  /* ── Image upload ── */
  const handleImageChange = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!file.type.startsWith("image/")) { alert("Images only."); return; }
    if (file.size > 10 * 1024 * 1024)   { alert("Max 10 MB."); return; }

    const clientMsgId = `${user.id}_${Date.now()}`;
    const tempId      = `temp_${clientMsgId}`;
    const localUrl    = URL.createObjectURL(file);

    dispatch({
      type: "APPEND", payload: {
        id: tempId, client_message_id: clientMsgId,
        thread_id: threadId, sender_id: user.id,
        message: "Photo", message_type: "media",
        media_url: localUrl,
        created_at: new Date().toISOString(),
        status: "sending", _temp: true,
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
        `${API}/messages/upload`, form,
        { headers: { ...authH(), "Content-Type": "multipart/form-data" }, timeout: 30_000 }
      );

      URL.revokeObjectURL(localUrl);
      if (mounted.current) dispatch({ type: "REPLACE", tempId, payload: saved });
      socketRef.current?.emit("sendMessage", saved);
    } catch {
      URL.revokeObjectURL(localUrl);
      if (mounted.current)
        dispatch({ type: "PATCH", id: tempId,
          patch: { _temp: false, _failed: true } });
    }
  }, [threadId, user?.id]);

  /* ─────────────────────────────────────────────
     RENDER — Chat Panel
  ───────────────────────────────────────────── */
  return (
    <div style={{
      flex: 1, display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "#fff",
      minWidth: 0,
    }}>
      {/* ── Chat Header ── */}
      <div style={{
        display: "flex", alignItems: "center",
        gap: 12, padding: "14px 20px",
        borderBottom: "1px solid #f0f0f0",
        background: "#fff",
        flexShrink: 0,
      }}>
        {otherUser ? (
          <>
            <div style={{ position: "relative" }}>
              <Avatar
                src={otherUser.profile_image}
                name={otherUser.name}
                size={40}
              />
              {otherUser.is_online && (
                <span style={{
                  position: "absolute", bottom: 1, right: 1,
                  width: 10, height: 10,
                  background: "#22c55e",
                  borderRadius: "50%",
                  border: "2px solid #fff",
                }} />
              )}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: 700, fontSize: 15, color: "#111",
              }}>
                {otherUser.name || "User"}
              </div>
              <div style={{ fontSize: 12, color: "#aaa", marginTop: 1 }}>
                {isTyping
                  ? "typing…"
                  : otherUser.is_online
                  ? "Online"
                  : "Offline"}
              </div>
            </div>

            {/* Product chip */}
            {product && (
              <div style={{
                display: "flex", alignItems: "center",
                gap: 8, padding: "6px 12px",
                background: "#f8f8f8",
                borderRadius: 10,
                border: "1px solid #eee",
              }}>
                {product.images?.[0] && (
                  <img
                    src={product.images[0]}
                    alt=""
                    style={{
                      width: 28, height: 28,
                      borderRadius: 6, objectFit: "cover",
                    }}
                  />
                )}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#111" }}>
                    {product.title}
                  </div>
                  {product.price !== undefined && (
                    <div style={{ fontSize: 10, color: "#aaa" }}>
                      ${Number(product.price).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{
            height: 40, width: 160,
            background: "#f0f0f0",
            borderRadius: 8,
            animation: "pulse 1.5s ease infinite",
          }} />
        )}
      </div>

      {/* ── Messages Body ── */}
      <div style={{
        flex: 1, overflowY: "auto",
        padding: "10px 0",
        display: "flex", flexDirection: "column",
      }}>
        {loading && (
          <div style={{
            display: "flex", justifyContent: "center",
            alignItems: "center", flex: 1,
          }}>
            <Spinner />
          </div>
        )}

        {!loading && error && (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            flex: 1, gap: 12, padding: 24,
          }}>
            <p style={{ margin: 0, fontSize: 14, color: "#888" }}>
              Failed to load messages
            </p>
            <p style={{
              margin: 0, fontSize: 11, color: "#f87171",
              fontFamily: "monospace",
              background: "#fef2f2",
              padding: "4px 10px", borderRadius: 6,
            }}>
              {error}
            </p>
            <button
              onClick={loadHistory}
              style={{
                padding: "9px 28px", borderRadius: 20,
                border: "none", background: "#111",
                color: "#fff", fontSize: 13, fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && messages.length === 0 && (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            flex: 1, gap: 8,
          }}>
            <p style={{ fontSize: 14, color: "#bbb", margin: 0 }}>
              No messages yet
            </p>
            <p style={{ fontSize: 12, color: "#ddd", margin: 0 }}>
              Say hello to get started!
            </p>
          </div>
        )}

        {!loading && !error && grouped.map((item, i) =>
          item.type === "date" ? (
            <DateSep key={`d_${i}`} label={item.label!} />
          ) : (
            <Bubble
              key={item.data!.id}
              msg={item.data!}
              mine={item.data!.sender_id === user.id}
            />
          )
        )}

        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <img
            src={lightbox}
            alt="Full size"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw", maxHeight: "90vh",
              borderRadius: 12, objectFit: "contain",
            }}
          />
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: "absolute", top: 20, right: 24,
              background: "rgba(255,255,255,.15)",
              border: "none", borderRadius: "50%",
              width: 36, height: 36, cursor: "pointer",
              color: "#fff", fontSize: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Footer / Input ── */}
      <div style={{
        display: "flex", alignItems: "center",
        gap: 10, padding: "12px 16px",
        borderTop: "1px solid #f0f0f0",
        background: "#fff", flexShrink: 0,
      }}>
        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleImageChange}
        />

        {/* Attach button */}
        <button
          onClick={() => fileRef.current?.click()}
          aria-label="Attach image"
          style={{
            background: "none", border: "none",
            cursor: "pointer", padding: 8,
            borderRadius: "50%",
            display: "flex", alignItems: "center",
            color: "#aaa", transition: "background .15s, color .15s",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f5f5f5";
            e.currentTarget.style.color = "#555";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
            e.currentTarget.style.color = "#aaa";
          }}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586
                 a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={newMsg}
          onChange={(e) => { setNewMsg(e.target.value); handleTyping(); }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          maxLength={5000}
          style={{
            flex: 1,
            padding: "10px 16px",
            borderRadius: 24,
            border: "1.5px solid #eee",
            fontSize: 14,
            outline: "none",
            fontFamily: "inherit",
            background: "#f9f9f9",
            transition: "border-color .15s",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#ccc")}
          onBlur={(e)  => (e.currentTarget.style.borderColor = "#eee")}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send"
          style={{
            width: 40, height: 40,
            borderRadius: "50%", border: "none",
            background: canSend ? "#111" : "#e5e5e5",
            color: canSend ? "#fff" : "#aaa",
            cursor: canSend ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            transition: "background .2s, color .2s",
          }}
        >
          {sending ? (
            <Spinner size={16} />
          ) : (
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   MessagingDesktop — main export
───────────────────────────────────────────── */
interface MessagingDesktopProps {
  user: User;
}

const MessagingDesktop: FC<MessagingDesktopProps> = ({ user }) => {
  const navigate               = useNavigate();
  const { threadId: urlThread } = useParams<{ threadId?: string }>();

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    urlThread ?? null
  );
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);

  /* Sync URL → selected */
  useEffect(() => {
    if (urlThread) setSelectedThreadId(urlThread);
  }, [urlThread]);

  const handleSelectThread = useCallback((tid: string, thread: Thread) => {
    setSelectedThreadId(tid);
    setSelectedThread(thread);
    // Push URL without full navigation so sidebar stays mounted
    navigate(`/messages/${tid}`, { replace: true });
  }, [navigate]);

  /* ── Not logged in ── */
  if (!user?.id) {
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        height: "100vh", gap: 16,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: 24, textAlign: "center",
      }}>
        <svg width="56" height="56" fill="none" viewBox="0 0 24 24"
          stroke="#ccc" strokeWidth={1.2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03
               8-9 8a9.77 9.77 0 01-4-.85L3 20l1.09-3.27C3.4
               15.56 3 13.82 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p style={{ fontSize: 16, fontWeight: 700, color: "#555" }}>
          Log in to see your messages
        </p>
        <button
          onClick={() => navigate("/auth")}
          style={{
            padding: "11px 32px", borderRadius: 24,
            border: "none", background: "#111",
            color: "#fff", fontSize: 14, fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Log in
        </button>
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     MAIN LAYOUT
  ───────────────────────────────────────────── */
  return (
    <>
      {/* Global keyframes */}
      <style>{`
        * { box-sizing: border-box; }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes typing {
          0%, 100% { transform: translateY(0);    opacity: .4; }
          50%       { transform: translateY(-4px); opacity: 1;  }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: .5; }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb {
          background: #e0e0e0;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover { background: #ccc; }
      `}</style>

      <div style={{
        display: "flex",
        height: "100dvh",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#fff",
        overflow: "hidden",
      }}>
        {/* ── Left: Conversations Sidebar ── */}
        <ConversationsSidebar
          user={user}
          selectedThreadId={selectedThreadId}
          onSelectThread={handleSelectThread}
        />

        {/* ── Right: Chat Pane or placeholder ── */}
        {selectedThreadId ? (
          /*
           * Key prop forces a full remount when thread changes,
           * which resets all state (messages, socket, etc.) cleanly.
           */
          <ChatPanel
            key={selectedThreadId}
            threadId={selectedThreadId}
            user={user}
          />
        ) : (
          <NoChatSelected />
        )}
      </div>
    </>
  );
};

export default MessagingDesktop;
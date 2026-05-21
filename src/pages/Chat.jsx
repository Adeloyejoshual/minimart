import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import axios from "axios";

/* ─────────────────────────────────────────
   CONFIG
───────────────────────────────────────── */
const BASE       = "https://minimart-ivrm.onrender.com";
const API        = `${BASE}/api`;
const SOCKET_URL = BASE;

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], {
    hour:   "2-digit",
    minute: "2-digit",
  });
}

function formatDateLabel(dateStr) {
  const d         = new Date(dateStr);
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString())     return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });
}

function groupByDate(msgs) {
  const groups  = [];
  let lastLabel = null;
  for (const m of msgs) {
    const label = formatDateLabel(m.created_at);
    if (label !== lastLabel) {
      groups.push({ type: "date", label });
      lastLabel = label;
    }
    groups.push({ type: "message", data: m });
  }
  return groups;
}

function mergeMessages(existing, incoming) {
  const map = new Map(existing.map((m) => [m.id, m]));
  for (const m of incoming) {
    if (!map.has(m.id)) map.set(m.id, m);
  }
  return [...map.values()].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
}

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

/* ─────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────── */

/* Double-tick SVG */
function Tick({ status }) {
  const color =
    status === "read"
      ? "#60a5fa"
      : status === "delivered"
      ? "rgba(255,255,255,0.7)"
      : "rgba(255,255,255,0.35)";

  return (
    <svg
      width="14"
      height="10"
      viewBox="0 0 16 10"
      fill="none"
      aria-label={status}
    >
      <path
        d="M1 5l3 3L10 1"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 5l3 3 6-7"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Animated typing dots */
function TypingBubble() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 6 }}>
      <style>{`
        @keyframes tdot {
          0%, 60%, 100% { transform: translateY(0);    opacity: 0.35; }
          30%            { transform: translateY(-5px); opacity: 1;    }
        }
      `}</style>
      <div
        style={{
          background:   "#fff",
          border:       "1px solid #e8e8e8",
          borderRadius: "18px 18px 18px 4px",
          padding:      "10px 16px",
          display:      "flex",
          gap:          5,
          alignItems:   "center",
          boxShadow:    "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        {[0, 1, 2].map((n) => (
          <div
            key={n}
            style={{
              width:        7,
              height:       7,
              borderRadius: "50%",
              background:   "#bbb",
              animation:    `tdot 1.1s ease-in-out ${n * 0.18}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* Single message bubble */
function MessageBubble({ message, mine }) {
  const isSending = message._temp;
  const isFailed  = message._failed;

  return (
    <div
      style={{
        display:        "flex",
        justifyContent: mine ? "flex-end" : "flex-start",
        marginBottom:   2,
        paddingLeft:    mine ? 48 : 0,
        paddingRight:   mine ? 0  : 48,
      }}
    >
      <div
        style={{
          maxWidth:     "100%",
          background:   isFailed ? "#fee2e2" : mine ? "#111" : "#fff",
          color:        isFailed ? "#dc2626"  : mine ? "#fff" : "#111",
          border:       mine && !isFailed ? "none" : "1px solid #e8e8e8",
          padding:      "9px 13px 6px",
          borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          fontSize:     14,
          lineHeight:   1.5,
          wordBreak:    "break-word",
          boxShadow:    "0 1px 3px rgba(0,0,0,0.07)",
          opacity:      isSending ? 0.6 : 1,
          transition:   "opacity 0.2s",
        }}
      >
        {/* Message text */}
        <div style={{ whiteSpace: "pre-wrap" }}>{message.message}</div>

        {/* Media */}
        {message.media_url && (
          <img
            src={message.media_url}
            alt="attachment"
            style={{
              marginTop:    6,
              maxWidth:     220,
              borderRadius: 8,
              display:      "block",
            }}
          />
        )}

        {/* Edited badge */}
        {message.edited && (
          <span
            style={{
              fontSize: 10,
              opacity:  0.55,
              marginRight: 4,
            }}
          >
            edited
          </span>
        )}

        {/* Timestamp row */}
        <div
          style={{
            fontSize:       10,
            color:          mine ? "rgba(255,255,255,0.5)" : "#bbb",
            marginTop:      3,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "flex-end",
            gap:            4,
          }}
        >
          {isFailed ? (
            <span style={{ color: "#dc2626", fontSize: 11 }}>
              Failed — tap to retry
            </span>
          ) : isSending ? (
            <>
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" strokeLinecap="round" />
              </svg>
              Sending…
            </>
          ) : (
            <>
              {formatTime(message.created_at)}
              {mine && <Tick status={message.status} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* Date separator */
function DateLabel({ label }) {
  return (
    <div
      style={{
        textAlign:  "center",
        fontSize:   11,
        color:      "#aaa",
        margin:     "12px 0 8px",
        userSelect: "none",
      }}
    >
      <span
        style={{
          background:   "#e9e9e9",
          borderRadius: 12,
          padding:      "2px 12px",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* Spinner */
function Spinner() {
  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          width:        28,
          height:       28,
          border:       "3px solid #eee",
          borderTop:    "3px solid #111",
          borderRadius: "50%",
          animation:    "spin 0.75s linear infinite",
        }}
      />
    </>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function Chat({ user }) {
  const { threadId } = useParams();
  const navigate     = useNavigate();

  /* ── State ── */
  const [messages,   setMessages]   = useState([]);
  const [newMsg,     setNewMsg]     = useState("");
  const [otherUser,  setOtherUser]  = useState(null);
  const [product,    setProduct]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [sending,    setSending]    = useState(false);
  const [isTyping,   setIsTyping]   = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const [error,      setError]      = useState(null);

  /* ── Refs ── */
  const socketRef          = useRef(null);
  const messagesEndRef     = useRef(null);
  const inputRef           = useRef(null);
  const typingTimerRef     = useRef(null);
  const historyLoadedRef   = useRef(false);
  const pendingSocketMsgs  = useRef([]);
  const isMountedRef       = useRef(true);

  /* ── Unmount guard ── */
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const safeSet = useCallback((setter) => {
    if (isMountedRef.current) setter();
  }, []);

  /* ── Auth headers ── */
  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${getToken()}` }),
    []
  );

  /* ══════════════════════════════════════
     1. LOAD THREAD METADATA
  ══════════════════════════════════════ */
  useEffect(() => {
    if (!threadId || !user?.id) return;
    const controller = new AbortController();

    axios
      .get(`${API}/conversations`, {
        params:  { userId: user.id },
        headers: authHeaders,
        signal:  controller.signal,
      })
      .then(({ data }) => {
        const thread = Array.isArray(data)
          ? data.find((t) => t.thread_id === threadId)
          : null;

        if (!thread) return;

        /* Other user */
        const otherId =
          thread.other_user_id ||
          (thread.buyer_id === user.id ? thread.seller_id : thread.buyer_id);

        if (otherId) {
          axios
            .get(`${API}/users/${otherId}`, {
              headers: authHeaders,
              signal:  controller.signal,
            })
            .then(({ data: u }) => safeSet(() => setOtherUser(u)))
            .catch(() => {});
        }

        /* Inline data from conversations list */
        if (thread.other_user_name && !otherUser) {
          safeSet(() =>
            setOtherUser({
              id:            otherId,
              name:          thread.other_user_name,
              profile_image: thread.other_user_image,
              is_online:     thread.other_user_online,
              store_name:    thread.other_user_store,
            })
          );
        }

        /* Product */
        if (thread.product_id) {
          axios
            .get(`${API}/product/${thread.product_id}`, {
              headers: authHeaders,
              signal:  controller.signal,
            })
            .then(({ data: p }) => safeSet(() => setProduct(p)))
            .catch(() =>
              axios
                .get(`${API}/products/${thread.product_id}`, {
                  headers: authHeaders,
                  signal:  controller.signal,
                })
                .then(({ data: p }) => safeSet(() => setProduct(p)))
                .catch(() => {})
            );
        }

        /* Use inline product snapshot if full fetch fails */
        if (thread.product_title) {
          safeSet(() =>
            setProduct((prev) =>
              prev ?? {
                title:  thread.product_title,
                images: [thread.product_image],
                price:  thread.product_price,
              }
            )
          );
        }
      })
      .catch((e) => {
        if (!axios.isCancel(e))
          console.error("Thread metadata:", e.message);
      });

    return () => controller.abort();
  }, [threadId, user?.id]); // eslint-disable-line

  /* ══════════════════════════════════════
     2. SOCKET CONNECTION
  ══════════════════════════════════════ */
  useEffect(() => {
    if (!user?.id || !threadId) return;

    const socket = io(SOCKET_URL, {
      transports:      ["websocket", "polling"],
      withCredentials: false,
      query:           { userId: user.id },
      reconnection:    true,
      reconnectionAttempts: 5,
      reconnectionDelay:    1000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket:", socket.id);
      socket.emit("joinThread", { threadId, userId: user.id });
      safeSet(() => setSocketReady(true));
    });

    socket.on("disconnect", () => {
      safeSet(() => setSocketReady(false));
    });

    socket.on("connect_error", (e) => {
      console.error("❌ Socket error:", e.message);
    });

    /* Incoming message from the other person */
    socket.on("receiveMessage", (msg) => {
      if (!msg?.id || msg.sender_id === user.id) return;

      if (!historyLoadedRef.current) {
        pendingSocketMsgs.current.push(msg);
        return;
      }

      safeSet(() =>
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg].sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
          );
        })
      );

      /* Auto mark-read since the chat is open */
      socket.emit("markRead", { threadId, userId: user.id });
      axios
        .patch(
          `${API}/conversations/${threadId}/read`,
          { userId: user.id },
          { headers: authHeaders }
        )
        .catch(() => {});
    });

    /* Blue ticks */
    socket.on("messagesRead", ({ userId: uid }) => {
      if (uid === user.id) return;
      safeSet(() =>
        setMessages((prev) =>
          prev.map((m) =>
            m.sender_id === user.id && m.status !== "read"
              ? { ...m, status: "read" }
              : m
          )
        )
      );
    });

    /* Typing */
    socket.on("userTyping",     () => safeSet(() => setIsTyping(true)));
    socket.on("userStopTyping", () => safeSet(() => setIsTyping(false)));

    /* Real-time edit */
    socket.on("messageEdited", ({ messageId, message }) => {
      safeSet(() =>
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, message, edited: true } : m
          )
        )
      );
    });

    /* Real-time delete */
    socket.on("messageDeleted", ({ messageId }) => {
      safeSet(() =>
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
      );
    });

    /* Online/offline presence */
    socket.on("userOnline", ({ userId: uid }) => {
      if (uid !== user.id) {
        safeSet(() =>
          setOtherUser((prev) => prev ? { ...prev, is_online: true } : prev)
        );
      }
    });
    socket.on("userOffline", ({ userId: uid }) => {
      if (uid !== user.id) {
        safeSet(() =>
          setOtherUser((prev) => prev ? { ...prev, is_online: false } : prev)
        );
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current  = null;
      safeSet(() => setSocketReady(false));
    };
  }, [user?.id, threadId]); // eslint-disable-line

  /* ══════════════════════════════════════
     3. LOAD MESSAGE HISTORY
  ══════════════════════════════════════ */
  useEffect(() => {
    if (!user?.id || !threadId) return;

    historyLoadedRef.current = false;
    pendingSocketMsgs.current = [];
    safeSet(() => {
      setLoading(true);
      setError(null);
    });

    const controller = new AbortController();

    axios
      .get(`${API}/messages`, {
        params:  { threadId, userId: user.id },
        headers: authHeaders,
        signal:  controller.signal,
      })
      .then(({ data }) => {
        const combined = mergeMessages(
          Array.isArray(data) ? data : [],
          pendingSocketMsgs.current
        );
        pendingSocketMsgs.current    = [];
        historyLoadedRef.current     = true;

        safeSet(() => setMessages(combined));

        /* Mark as read */
        socketRef.current?.emit("markRead", { threadId, userId: user.id });
        axios
          .patch(
            `${API}/conversations/${threadId}/read`,
            { userId: user.id },
            { headers: authHeaders }
          )
          .catch(() => {});
      })
      .catch((e) => {
        if (axios.isCancel(e)) return;
        console.error("History:", e.message);
        safeSet(() => setError("Failed to load messages. Tap to retry."));
      })
      .finally(() => safeSet(() => setLoading(false)));

    return () => controller.abort();
  }, [user?.id, threadId]); // eslint-disable-line

  /* ══════════════════════════════════════
     4. AUTO-SCROLL
  ══════════════════════════════════════ */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  /* ══════════════════════════════════════
     5. TYPING INDICATOR
  ══════════════════════════════════════ */
  const handleTyping = useCallback(() => {
    socketRef.current?.emit("typing", { threadId, userId: user?.id });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socketRef.current?.emit("stopTyping", { threadId, userId: user?.id });
    }, 1500);
  }, [threadId, user?.id]);

  useEffect(() => () => clearTimeout(typingTimerRef.current), []);

  /* ══════════════════════════════════════
     6. SEND MESSAGE
  ══════════════════════════════════════ */
  const sendMessage = useCallback(async () => {
    const text = newMsg.trim();
    if (!text || sending) return;

    const clientMessageId = `${user.id}_${Date.now()}`;
    const tempId          = `temp_${clientMessageId}`;

    const temp = {
      id:               tempId,
      thread_id:        threadId,
      sender_id:        user.id,
      message:          text,
      message_type:     "text",
      created_at:       new Date().toISOString(),
      status:           "sending",
      _temp:            true,
      _failed:          false,
    };

    safeSet(() => setMessages((prev) => [...prev, temp]));
    safeSet(() => setNewMsg(""));
    safeSet(() => setSending(true));

    clearTimeout(typingTimerRef.current);
    socketRef.current?.emit("stopTyping", { threadId, userId: user.id });

    try {
      const { data: saved } = await axios.post(
        `${API}/messages`,
        {
          threadId,
          senderId:        user.id,
          message:         text,
          messageType:     "text",
          clientMessageId,
        },
        { headers: authHeaders }
      );

      /* Swap temp → confirmed */
      safeSet(() =>
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? saved : m))
        )
      );

      /* Notify other participant */
      socketRef.current?.emit("sendMessage", saved);

    } catch (err) {
      console.error("Send failed:", err.message);
      /* Mark as failed so user can see */
      safeSet(() =>
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, _temp: false, _failed: true } : m
          )
        )
      );
      safeSet(() => setNewMsg(text)); // restore input
    } finally {
      safeSet(() => setSending(false));
      inputRef.current?.focus();
    }
  }, [newMsg, sending, threadId, user?.id, authHeaders]); // eslint-disable-line

  /* Retry a failed message */
  const retryMessage = useCallback(
    (failedMsg) => {
      setMessages((prev) => prev.filter((m) => m.id !== failedMsg.id));
      setNewMsg(failedMsg.message);
      inputRef.current?.focus();
    },
    []
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  /* ── Derived ── */
  const isMine  = useCallback((m) => m.sender_id === user?.id, [user?.id]);
  const grouped = useMemo(() => groupByDate(messages), [messages]);

  const canSend = newMsg.trim().length > 0 && !sending;

  /* ══════════════════════════════════════
     RENDER
  ══════════════════════════════════════ */
  return (
    <div
      style={{
        display:       "flex",
        flexDirection: "column",
        height:        "100dvh",
        maxWidth:      700,
        margin:        "0 auto",
        background:    "#fff",
        fontFamily:    "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >

      {/* ════════ HEADER ════════ */}
      <header
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          10,
          padding:      "10px 14px",
          borderBottom: "1px solid #f0f0f0",
          background:   "#fff",
          position:     "sticky",
          top:          0,
          zIndex:       20,
          boxShadow:    "0 1px 6px rgba(0,0,0,0.06)",
        }}
      >
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          style={{
            background: "none",
            border:     "none",
            cursor:     "pointer",
            padding:    6,
            display:    "flex",
            alignItems: "center",
            flexShrink: 0,
            borderRadius: "50%",
          }}
        >
          <svg
            width="20"
            height="20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="#111"
            strokeWidth={2.2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* Avatar + online dot */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <img
            src={
              otherUser?.profile_image ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                otherUser?.name || "U"
              )}&background=111&color=fff&size=80`
            }
            alt={otherUser?.name || "User"}
            style={{
              width:        42,
              height:       42,
              borderRadius: "50%",
              objectFit:    "cover",
              background:   "#eee",
            }}
          />
          {otherUser?.is_online && (
            <span
              style={{
                position:     "absolute",
                bottom:       1,
                right:        1,
                width:        10,
                height:       10,
                background:   "#22c55e",
                borderRadius: "50%",
                border:       "2px solid #fff",
              }}
            />
          )}
        </div>

        {/* Name + subtitle */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight:   700,
              fontSize:     15,
              lineHeight:   1.3,
              whiteSpace:   "nowrap",
              overflow:     "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {otherUser?.name || "…"}
          </div>

          <div style={{ fontSize: 11, marginTop: 1 }}>
            {isTyping ? (
              <span style={{ color: "#22c55e" }}>typing…</span>
            ) : otherUser?.is_online ? (
              <span style={{ color: "#22c55e" }}>Online</span>
            ) : product?.title ? (
              <span
                style={{
                  color:        "#888",
                  whiteSpace:   "nowrap",
                  overflow:     "hidden",
                  textOverflow: "ellipsis",
                  display:      "block",
                }}
              >
                re: {product.title}
              </span>
            ) : (
              <span style={{ color: "#aaa" }}>
                {otherUser?.store_name || ""}
              </span>
            )}
          </div>
        </div>

        {/* Product thumbnail */}
        {product?.images?.[0] && (
          <img
            src={product.images[0]}
            alt={product.title || "product"}
            style={{
              width:        40,
              height:       40,
              borderRadius: 8,
              objectFit:    "cover",
              flexShrink:   0,
              border:       "1px solid #eee",
            }}
          />
        )}

        {/* Socket status dot */}
        <div
          title={socketReady ? "Connected" : "Connecting…"}
          style={{
            width:        8,
            height:       8,
            borderRadius: "50%",
            background:   socketReady ? "#22c55e" : "#f59e0b",
            flexShrink:   0,
          }}
        />
      </header>

      {/* ════════ MESSAGE LIST ════════ */}
      <main
        style={{
          flex:          1,
          overflowY:     "auto",
          padding:       "14px 12px",
          display:       "flex",
          flexDirection: "column",
          gap:           1,
          background:    "#f8f8f8",
        }}
      >
        {/* Loading */}
        {loading ? (
          <div
            style={{
              flex:           1,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              paddingTop:     80,
            }}
          >
            <Spinner />
          </div>

        /* Error */
        ) : error ? (
          <div
            style={{
              flex:           1,
              display:        "flex",
              flexDirection:  "column",
              alignItems:     "center",
              justifyContent: "center",
              gap:            12,
              paddingTop:     80,
            }}
          >
            <svg
              width="40"
              height="40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="#f87171"
              strokeWidth={1.5}
            >
              <circle cx="12" cy="12" r="10" />
              <path
                strokeLinecap="round"
                d="M12 8v4m0 4h.01"
              />
            </svg>
            <p style={{ margin: 0, fontSize: 14, color: "#888" }}>{error}</p>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                axios
                  .get(`${API}/messages`, {
                    params:  { threadId, userId: user.id },
                    headers: authHeaders,
                  })
                  .then(({ data }) => {
                    setMessages(Array.isArray(data) ? data : []);
                    historyLoadedRef.current = true;
                  })
                  .catch(() => setError("Still failing. Check your connection."))
                  .finally(() => setLoading(false));
              }}
              style={{
                padding:      "8px 20px",
                borderRadius: 20,
                border:       "1px solid #111",
                background:   "#111",
                color:        "#fff",
                fontSize:     13,
                cursor:       "pointer",
              }}
            >
              Retry
            </button>
          </div>

        /* Empty */
        ) : messages.length === 0 ? (
          <div
            style={{
              flex:           1,
              display:        "flex",
              flexDirection:  "column",
              alignItems:     "center",
              justifyContent: "center",
              gap:            10,
              paddingTop:     80,
            }}
          >
            <svg
              width="56"
              height="56"
              fill="none"
              viewBox="0 0 24 24"
              stroke="#ddd"
              strokeWidth={1.2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03
                   8-9 8a9.77 9.77 0 01-4-.85L3 20l1.09-3.27C3.4
                   15.56 3 13.82 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#bbb" }}>
              No messages yet
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#ccc" }}>
              Say hello to start the conversation!
            </p>
          </div>

        /* Messages */
        ) : (
          <>
            {grouped.map((item, i) =>
              item.type === "date" ? (
                <DateLabel key={`date_${i}`} label={item.label} />
              ) : (
                <div
                  key={item.data.id}
                  onClick={() =>
                    item.data._failed ? retryMessage(item.data) : undefined
                  }
                  style={{ cursor: item.data._failed ? "pointer" : "default" }}
                >
                  <MessageBubble
                    message={item.data}
                    mine={isMine(item.data)}
                  />
                </div>
              )
            )}

            {isTyping && <TypingBubble />}
          </>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* ════════ INPUT BAR ════════ */}
      <footer
        style={{
          display:    "flex",
          alignItems: "flex-end",
          gap:        10,
          padding:    "10px 12px",
          borderTop:  "1px solid #f0f0f0",
          background: "#fff",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={newMsg}
          onChange={(e) => {
            setNewMsg(e.target.value);
            handleTyping();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          aria-label="Message input"
          maxLength={5000}
          style={{
            flex:         1,
            padding:      "11px 16px",
            borderRadius: 24,
            border:       "1.5px solid #e5e5e5",
            fontSize:     14,
            background:   "#f8f8f8",
            outline:      "none",
            resize:       "none",
            lineHeight:   1.4,
            transition:   "border-color 0.15s",
          }}
          onFocus={(e)  => (e.target.style.borderColor = "#999")}
          onBlur={(e)   => (e.target.style.borderColor = "#e5e5e5")}
        />

        <button
          onClick={sendMessage}
          disabled={!canSend}
          aria-label="Send message"
          style={{
            width:          44,
            height:         44,
            borderRadius:   "50%",
            flexShrink:     0,
            background:     canSend ? "#111" : "#e5e5e5",
            border:         "none",
            cursor:         canSend ? "pointer" : "default",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            transition:     "background 0.15s, transform 0.1s",
            transform:      canSend ? "scale(1)" : "scale(0.95)",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={canSend ? "#fff" : "#aaa"}
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"
            />
          </svg>
        </button>
      </footer>

    </div>
  );
}
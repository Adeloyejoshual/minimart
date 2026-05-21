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

/* ─────────────────────────────────────
   CONFIG
───────────────────────────────────── */
const BASE       = "https://minimart-ivrm.onrender.com";
const API        = `${BASE}/api`;
const SOCKET_URL = BASE;

/* ─────────────────────────────────────
   HELPERS
───────────────────────────────────── */
function getToken() {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

function authH() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDateLabel(dateStr) {
  const d         = new Date(dateStr);
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function groupByDate(msgs) {
  const out = [];
  let last  = null;
  for (const m of msgs) {
    const lbl = formatDateLabel(m.created_at);
    if (lbl !== last) { out.push({ type: "date", label: lbl }); last = lbl; }
    out.push({ type: "msg", data: m });
  }
  return out;
}

function dedupe(arr) {
  const map = new Map();
  for (const m of arr) map.set(m.id, m);
  return [...map.values()].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
}

/* ─────────────────────────────────────
   FETCH MESSAGES  — tries 3 strategies
───────────────────────────────────── */
async function fetchMessages(threadId, userId) {
  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  console.log("📡 fetchMessages", { threadId, userId, hasToken: !!token });

  // Strategy 1 — authenticated with JWT userId
  try {
    const { data } = await axios.get(`${API}/messages`, {
      params:  { threadId, userId },
      headers,
      timeout: 10_000,
    });
    if (Array.isArray(data)) {
      console.log("✅ Strategy 1 success:", data.length, "msgs");
      return data;
    }
  } catch (e) {
    console.warn("⚠️ Strategy 1 failed:", e.response?.status, e.response?.data || e.message);
  }

  // Strategy 2 — no userId param (let server use JWT)
  try {
    const { data } = await axios.get(`${API}/messages`, {
      params:  { threadId },
      headers,
      timeout: 10_000,
    });
    if (Array.isArray(data)) {
      console.log("✅ Strategy 2 success:", data.length, "msgs");
      return data;
    }
  } catch (e) {
    console.warn("⚠️ Strategy 2 failed:", e.response?.status, e.response?.data || e.message);
  }

  // Strategy 3 — no auth header (public fallback)
  try {
    const { data } = await axios.get(`${API}/messages`, {
      params:  { threadId, userId },
      timeout: 10_000,
    });
    if (Array.isArray(data)) {
      console.log("✅ Strategy 3 success:", data.length, "msgs");
      return data;
    }
  } catch (e) {
    console.warn("⚠️ Strategy 3 failed:", e.response?.status, e.response?.data || e.message);
    throw e; // all 3 failed
  }

  return [];
}

/* ─────────────────────────────────────
   TICK
───────────────────────────────────── */
function Tick({ status }) {
  const color =
    status === "read"      ? "#60a5fa" :
    status === "delivered" ? "rgba(255,255,255,0.65)" :
                             "rgba(255,255,255,0.3)";
  return (
    <svg width="14" height="10" viewBox="0 0 16 10" fill="none">
      <path d="M1 5l3 3L10 1" stroke={color}
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 5l3 3 6-7" stroke={color}
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ─────────────────────────────────────
   TYPING BUBBLE
───────────────────────────────────── */
function TypingBubble() {
  return (
    <div style={{ display:"flex", justifyContent:"flex-start", margin:"4px 0" }}>
      <style>{`
        @keyframes tdot {
          0%,60%,100%{transform:translateY(0);opacity:.35}
          30%{transform:translateY(-5px);opacity:1}
        }
      `}</style>
      <div style={{
        background:"#fff", border:"1px solid #e8e8e8",
        borderRadius:"18px 18px 18px 4px",
        padding:"10px 16px", display:"flex", gap:5, alignItems:"center",
        boxShadow:"0 1px 2px rgba(0,0,0,.06)",
      }}>
        {[0,1,2].map(n=>(
          <div key={n} style={{
            width:7,height:7,borderRadius:"50%",background:"#bbb",
            animation:`tdot 1.1s ease-in-out ${n*.18}s infinite`,
          }}/>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────
   MESSAGE BUBBLE
───────────────────────────────────── */
function Bubble({ msg, mine, onRetry }) {
  const failed  = msg._failed;
  const sending = msg._temp;

  return (
    <div
      onClick={() => failed && onRetry(msg)}
      style={{
        display:"flex",
        justifyContent: mine ? "flex-end" : "flex-start",
        marginBottom: 3,
        paddingLeft:  mine ? 52 : 0,
        paddingRight: mine ? 0  : 52,
        cursor: failed ? "pointer" : "default",
      }}
    >
      <div style={{
        maxWidth:"100%",
        background: failed ? "#fee2e2" : mine ? "#111" : "#fff",
        color:      failed ? "#dc2626"  : mine ? "#fff" : "#111",
        border:     (mine && !failed) ? "none" : "1px solid #e8e8e8",
        padding:    "9px 13px 6px",
        borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        fontSize:14, lineHeight:1.5, wordBreak:"break-word",
        boxShadow:"0 1px 3px rgba(0,0,0,.07)",
        opacity: sending ? 0.55 : 1,
        transition:"opacity .2s",
      }}>
        <div style={{ whiteSpace:"pre-wrap" }}>{msg.message}</div>

        {msg.media_url && (
          <img src={msg.media_url} alt="media"
            style={{ marginTop:6, maxWidth:200, borderRadius:8, display:"block" }}/>
        )}

        {msg.edited && (
          <span style={{ fontSize:10, opacity:.5 }}> · edited</span>
        )}

        <div style={{
          fontSize:10,
          color: mine ? "rgba(255,255,255,.45)" : "#bbb",
          marginTop:4, display:"flex", alignItems:"center",
          justifyContent:"flex-end", gap:4,
        }}>
          {failed ? (
            <span style={{ color:"#ef4444", fontSize:11 }}>
              ✕ Failed — tap to retry
            </span>
          ) : sending ? (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2" strokeLinecap="round"/>
              </svg>
              Sending…
            </>
          ) : (
            <>
              {formatTime(msg.created_at)}
              {mine && <Tick status={msg.status}/>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────
   DATE SEPARATOR
───────────────────────────────────── */
function DateSep({ label }) {
  return (
    <div style={{
      textAlign:"center", fontSize:11, color:"#aaa",
      margin:"12px 0 6px", userSelect:"none",
    }}>
      <span style={{
        background:"#e9e9e9", borderRadius:12, padding:"2px 12px",
      }}>{label}</span>
    </div>
  );
}

/* ─────────────────────────────────────
   SPINNER
───────────────────────────────────── */
function Spinner() {
  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{
        width:32, height:32,
        border:"3px solid #eee", borderTop:"3px solid #111",
        borderRadius:"50%", animation:"spin .75s linear infinite",
      }}/>
    </>
  );
}

/* ═══════════════════════════════════════
   CHAT COMPONENT
═══════════════════════════════════════ */
export default function Chat({ user }) {
  const { threadId } = useParams();
  const navigate     = useNavigate();

  const [messages,    setMessages]    = useState([]);
  const [newMsg,      setNewMsg]      = useState("");
  const [otherUser,   setOtherUser]   = useState(null);
  const [product,     setProduct]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [isTyping,    setIsTyping]    = useState(false);
  const [sockReady,   setSockReady]   = useState(false);
  const [error,       setError]       = useState(null);
  const [debugInfo,   setDebugInfo]   = useState("");

  const socketRef         = useRef(null);
  const bottomRef         = useRef(null);
  const inputRef          = useRef(null);
  const typingTimer       = useRef(null);
  const historyLoaded     = useRef(false);
  const pendingMsgs       = useRef([]);
  const mounted           = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const safe = useCallback((fn) => { if (mounted.current) fn(); }, []);

  /* ══════════════════════════════
     LOAD THREAD META
  ══════════════════════════════ */
  useEffect(() => {
    if (!threadId || !user?.id) return;
    const ctrl = new AbortController();

    console.log("🔍 Loading thread meta for", threadId);

    axios
      .get(`${API}/conversations`, {
        params:  { userId: user.id },
        headers: authH(),
        signal:  ctrl.signal,
        timeout: 10_000,
      })
      .then(({ data }) => {
        const list   = Array.isArray(data) ? data : [];
        const thread = list.find(
          (t) => t.thread_id === threadId || t.id === threadId
        );

        console.log("🧵 Thread found:", thread ?? "NOT FOUND in list of", list.length);

        if (!thread) return;

        const otherId =
          thread.other_user_id ||
          (thread.buyer_id === user.id ? thread.seller_id : thread.buyer_id);

        /* Set from inline data immediately */
        if (thread.other_user_name) {
          safe(() => setOtherUser({
            id:            otherId,
            name:          thread.other_user_name,
            profile_image: thread.other_user_image,
            is_online:     thread.other_user_online,
            store_name:    thread.other_user_store,
          }));
        }

        if (thread.product_title) {
          safe(() => setProduct({
            title:  thread.product_title,
            images: thread.product_image ? [thread.product_image] : [],
            price:  thread.product_price,
          }));
        }

        /* Fetch full user profile */
        if (otherId) {
          axios
            .get(`${API}/users/${otherId}`, {
              headers: authH(),
              signal:  ctrl.signal,
            })
            .then(({ data: u }) => safe(() => setOtherUser(u)))
            .catch(() => {});
        }

        /* Fetch full product */
        if (thread.product_id) {
          axios
            .get(`${API}/product/${thread.product_id}`, {
              headers: authH(),
              signal:  ctrl.signal,
            })
            .then(({ data: p }) => safe(() => setProduct(p)))
            .catch(() => {});
        }
      })
      .catch((e) => {
        if (!axios.isCancel(e))
          console.warn("Meta fetch:", e.response?.status, e.message);
      });

    return () => ctrl.abort();
  }, [threadId, user?.id]); // eslint-disable-line

  /* ══════════════════════════════
     SOCKET
  ══════════════════════════════ */
  useEffect(() => {
    if (!user?.id || !threadId) return;

    const sock = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      withCredentials: false,
      query: { userId: user.id },
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1500,
    });
    socketRef.current = sock;

    sock.on("connect", () => {
      console.log("🔌 Socket connected:", sock.id);
      sock.emit("joinThread", { threadId, userId: user.id });
      safe(() => setSockReady(true));
    });

    sock.on("disconnect", (reason) => {
      console.log("🔌 Socket disconnected:", reason);
      safe(() => setSockReady(false));
    });

    sock.on("connect_error", (e) =>
      console.error("Socket error:", e.message)
    );

    sock.on("receiveMessage", (msg) => {
      if (!msg?.id || msg.sender_id === user.id) return;
      if (!historyLoaded.current) {
        pendingMsgs.current.push(msg);
        return;
      }
      safe(() =>
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return dedupe([...prev, msg]);
        })
      );
      sock.emit("markRead", { threadId, userId: user.id });
      axios
        .patch(`${API}/conversations/${threadId}/read`,
          { userId: user.id }, { headers: authH() })
        .catch(() => {});
    });

    sock.on("messagesRead", ({ userId: uid }) => {
      if (uid === user.id) return;
      safe(() =>
        setMessages((prev) =>
          prev.map((m) =>
            m.sender_id === user.id && m.status !== "read"
              ? { ...m, status: "read" } : m
          )
        )
      );
    });

    sock.on("userTyping",     () => safe(() => setIsTyping(true)));
    sock.on("userStopTyping", () => safe(() => setIsTyping(false)));

    sock.on("messageEdited", ({ messageId, message }) =>
      safe(() =>
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, message, edited: true } : m
          )
        )
      )
    );

    sock.on("messageDeleted", ({ messageId }) =>
      safe(() => setMessages((prev) => prev.filter((m) => m.id !== messageId)))
    );

    sock.on("userOnline",  ({ userId: uid }) => {
      if (uid !== user.id)
        safe(() => setOtherUser((p) => p ? { ...p, is_online: true  } : p));
    });
    sock.on("userOffline", ({ userId: uid }) => {
      if (uid !== user.id)
        safe(() => setOtherUser((p) => p ? { ...p, is_online: false } : p));
    });

    return () => {
      sock.disconnect();
      socketRef.current = null;
      safe(() => setSockReady(false));
    };
  }, [user?.id, threadId]); // eslint-disable-line

  /* ══════════════════════════════
     LOAD HISTORY
  ══════════════════════════════ */
  const loadHistory = useCallback(async () => {
    if (!user?.id || !threadId) return;

    historyLoaded.current   = false;
    pendingMsgs.current     = [];
    safe(() => { setLoading(true); setError(null); setDebugInfo(""); });

    try {
      const data = await fetchMessages(threadId, user.id);
      const all  = dedupe([...data, ...pendingMsgs.current]);
      pendingMsgs.current   = [];
      historyLoaded.current = true;

      safe(() => setMessages(all));

      /* Mark read */
      socketRef.current?.emit("markRead", { threadId, userId: user.id });
      axios
        .patch(`${API}/conversations/${threadId}/read`,
          { userId: user.id }, { headers: authH() })
        .catch(() => {});

    } catch (err) {
      const status = err.response?.status;
      const body   = err.response?.data;
      const info   = `HTTP ${status ?? "network"} — ${
        typeof body === "object" ? JSON.stringify(body) : (body ?? err.message)
      }`;
      console.error("❌ loadHistory final error:", info);
      safe(() => {
        setError("Failed to load messages.");
        setDebugInfo(info);
      });
    } finally {
      safe(() => setLoading(false));
    }
  }, [user?.id, threadId, safe]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  /* ══════════════════════════════
     AUTO-SCROLL
  ══════════════════════════════ */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  /* ══════════════════════════════
     TYPING
  ══════════════════════════════ */
  const handleTyping = useCallback(() => {
    socketRef.current?.emit("typing", { threadId, userId: user?.id });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit("stopTyping", { threadId, userId: user?.id });
    }, 1500);
  }, [threadId, user?.id]);

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  /* ══════════════════════════════
     SEND
  ══════════════════════════════ */
  const sendMessage = useCallback(async () => {
    const text = newMsg.trim();
    if (!text || sending) return;

    const clientMessageId = `${user.id}_${Date.now()}`;
    const tempId          = `temp_${clientMessageId}`;
    const temp = {
      id: tempId, thread_id: threadId, sender_id: user.id,
      message: text, message_type: "text",
      created_at: new Date().toISOString(),
      status: "sending", _temp: true, _failed: false,
    };

    safe(() => { setMessages((p) => [...p, temp]); setNewMsg(""); setSending(true); });
    clearTimeout(typingTimer.current);
    socketRef.current?.emit("stopTyping", { threadId, userId: user.id });

    try {
      const { data: saved } = await axios.post(
        `${API}/messages`,
        {
          threadId, senderId: user.id, message: text,
          messageType: "text", clientMessageId,
        },
        { headers: authH(), timeout: 10_000 }
      );

      safe(() =>
        setMessages((p) => p.map((m) => (m.id === tempId ? saved : m)))
      );
      socketRef.current?.emit("sendMessage", saved);

    } catch (err) {
      console.error("Send failed:", err.response?.data ?? err.message);
      safe(() => {
        setMessages((p) =>
          p.map((m) =>
            m.id === tempId ? { ...m, _temp: false, _failed: true } : m
          )
        );
        setNewMsg(text);
      });
    } finally {
      safe(() => setSending(false));
      inputRef.current?.focus();
    }
  }, [newMsg, sending, threadId, user?.id, safe]); // eslint-disable-line

  const retryMessage = useCallback((failedMsg) => {
    setMessages((p) => p.filter((m) => m.id !== failedMsg.id));
    setNewMsg(failedMsg.message);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const isMine  = useCallback((m) => m.sender_id === user?.id, [user?.id]);
  const grouped = useMemo(() => groupByDate(messages), [messages]);
  const canSend = newMsg.trim().length > 0 && !sending;

  /* ══════════════════════════════
     RENDER
  ══════════════════════════════ */
  return (
    <div style={{
      display:"flex", flexDirection:"column",
      height:"100dvh", maxWidth:700,
      margin:"0 auto", background:"#fff",
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    }}>

      {/* ── HEADER ── */}
      <header style={{
        display:"flex", alignItems:"center", gap:10,
        padding:"10px 14px", borderBottom:"1px solid #f0f0f0",
        background:"#fff", position:"sticky", top:0, zIndex:20,
        boxShadow:"0 1px 6px rgba(0,0,0,.06)",
      }}>

        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          style={{
            background:"none", border:"none", cursor:"pointer",
            padding:6, display:"flex", alignItems:"center", flexShrink:0,
          }}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24"
            stroke="#111" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>

        {/* Avatar */}
        <div style={{ position:"relative", flexShrink:0 }}>
          <img
            src={
              otherUser?.profile_image ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                otherUser?.name || "U"
              )}&background=111&color=fff&size=80`
            }
            alt={otherUser?.name || "User"}
            style={{
              width:42, height:42, borderRadius:"50%",
              objectFit:"cover", background:"#eee",
            }}
          />
          {otherUser?.is_online && (
            <span style={{
              position:"absolute", bottom:1, right:1,
              width:10, height:10, background:"#22c55e",
              borderRadius:"50%", border:"2px solid #fff",
            }}/>
          )}
        </div>

        {/* Name / status */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{
            fontWeight:700, fontSize:15, lineHeight:1.3,
            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
          }}>
            {otherUser?.name || "…"}
          </div>
          <div style={{ fontSize:11, marginTop:1 }}>
            {isTyping ? (
              <span style={{ color:"#22c55e" }}>typing…</span>
            ) : otherUser?.is_online ? (
              <span style={{ color:"#22c55e" }}>Online</span>
            ) : product?.title ? (
              <span style={{
                color:"#888", whiteSpace:"nowrap",
                overflow:"hidden", textOverflow:"ellipsis", display:"block",
              }}>
                re: {product.title}
              </span>
            ) : (
              <span style={{ color:"#aaa" }}>{otherUser?.store_name || ""}</span>
            )}
          </div>
        </div>

        {/* Product thumb */}
        {product?.images?.[0] && (
          <img
            src={product.images[0]}
            alt={product.title}
            style={{
              width:40, height:40, borderRadius:8,
              objectFit:"cover", flexShrink:0, border:"1px solid #eee",
            }}
          />
        )}

        {/* Socket dot */}
        <div
          title={sockReady ? "Connected" : "Connecting…"}
          style={{
            width:8, height:8, borderRadius:"50%", flexShrink:0,
            background: sockReady ? "#22c55e" : "#f59e0b",
          }}
        />
      </header>

      {/* ── MESSAGES ── */}
      <main style={{
        flex:1, overflowY:"auto", padding:"14px 12px",
        display:"flex", flexDirection:"column", gap:1,
        background:"#f8f8f8",
      }}>

        {loading ? (
          <div style={{
            flex:1, display:"flex", alignItems:"center",
            justifyContent:"center", paddingTop:80,
          }}>
            <Spinner/>
          </div>

        ) : error ? (
          <div style={{
            flex:1, display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center",
            gap:12, padding:"80px 24px 0",
          }}>
            <svg width="44" height="44" fill="none" viewBox="0 0 24 24"
              stroke="#f87171" strokeWidth={1.5}>
              <circle cx="12" cy="12" r="10"/>
              <path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
            </svg>
            <p style={{ margin:0, fontSize:14, color:"#888", textAlign:"center" }}>
              {error}
            </p>

            {/* Debug info — shows exact HTTP error */}
            {debugInfo ? (
              <p style={{
                margin:0, fontSize:11, color:"#f87171",
                fontFamily:"monospace", textAlign:"center",
                background:"#fef2f2", padding:"6px 12px",
                borderRadius:8, maxWidth:340,
              }}>
                {debugInfo}
              </p>
            ) : null}

            <button
              onClick={loadHistory}
              style={{
                padding:"9px 24px", borderRadius:20,
                border:"none", background:"#111",
                color:"#fff", fontSize:13, cursor:"pointer",
              }}
            >
              Retry
            </button>
          </div>

        ) : messages.length === 0 ? (
          <div style={{
            flex:1, display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center",
            gap:10, paddingTop:80,
          }}>
            <svg width="56" height="56" fill="none" viewBox="0 0 24 24"
              stroke="#ddd" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03
                   8-9 8a9.77 9.77 0 01-4-.85L3 20l1.09-3.27C3.4
                   15.56 3 13.82 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
            <p style={{ margin:0, fontSize:14, fontWeight:600, color:"#bbb" }}>
              No messages yet
            </p>
            <p style={{ margin:0, fontSize:12, color:"#ccc" }}>
              Say hello to start the conversation!
            </p>
          </div>

        ) : (
          <>
            {grouped.map((item, i) =>
              item.type === "date" ? (
                <DateSep key={`d${i}`} label={item.label}/>
              ) : (
                <Bubble
                  key={item.data.id}
                  msg={item.data}
                  mine={isMine(item.data)}
                  onRetry={retryMessage}
                />
              )
            )}
            {isTyping && <TypingBubble/>}
          </>
        )}

        <div ref={bottomRef}/>
      </main>

      {/* ── INPUT ── */}
      <footer style={{
        display:"flex", alignItems:"center", gap:10,
        padding:"10px 12px", borderTop:"1px solid #f0f0f0",
        background:"#fff",
      }}>
        <input
          ref={inputRef}
          type="text"
          value={newMsg}
          onChange={(e) => { setNewMsg(e.target.value); handleTyping(); }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          aria-label="Message"
          maxLength={5000}
          style={{
            flex:1, padding:"11px 16px",
            borderRadius:24, border:"1.5px solid #e5e5e5",
            fontSize:14, background:"#f8f8f8",
            outline:"none", transition:"border-color .15s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#999")}
          onBlur={(e)  => (e.target.style.borderColor = "#e5e5e5")}
        />

        <button
          onClick={sendMessage}
          disabled={!canSend}
          aria-label="Send"
          style={{
            width:44, height:44, borderRadius:"50%", flexShrink:0,
            background: canSend ? "#111" : "#e5e5e5",
            border:"none", cursor: canSend ? "pointer" : "default",
            display:"flex", alignItems:"center", justifyContent:"center",
            transition:"background .15s",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={canSend ? "#fff" : "#aaa"} strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </footer>

    </div>
  );
}
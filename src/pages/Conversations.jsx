import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io }   from "socket.io-client";
import axios    from "axios";

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
function formatTime(d) {
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function formatDateLabel(d) {
  const date      = new Date(d);
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString())     return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}
function groupByDate(msgs) {
  const out = []; let last = null;
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
   FETCH MESSAGES
───────────────────────────────────── */
async function fetchMessages(threadId, userId) {
  const { data } = await axios.get(`${API}/messages`, {
    params:  { threadId, userId },
    headers: authH(),
    timeout: 12_000,
  });
  return Array.isArray(data) ? data : [];
}

/* ─────────────────────────────────────
   COMPONENTS
───────────────────────────────────── */
function Tick({ status }) {
  const color =
    status === "read"      ? "#60a5fa" :
    status === "delivered" ? "rgba(255,255,255,.65)" :
                             "rgba(255,255,255,.3)";
  return (
    <svg width="14" height="10" viewBox="0 0 16 10" fill="none">
      <path d="M1 5l3 3L10 1"  stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 5l3 3 6-7"  stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function TypingBubble() {
  return (
    <div style={{ display:"flex", justifyContent:"flex-start", margin:"4px 0 8px" }}>
      <style>{`
        @keyframes tdot {
          0%,60%,100%{ transform:translateY(0); opacity:.35 }
          30%         { transform:translateY(-5px); opacity:1 }
        }
      `}</style>
      <div style={{
        background:"#fff", border:"1px solid #e8e8e8",
        borderRadius:"18px 18px 18px 4px",
        padding:"10px 16px", display:"flex", gap:5,
        alignItems:"center", boxShadow:"0 1px 3px rgba(0,0,0,.07)",
      }}>
        {[0,1,2].map(n=>(
          <span key={n} style={{
            display:"block", width:7, height:7, borderRadius:"50%",
            background:"#bbb",
            animation:`tdot 1.1s ease-in-out ${n*.18}s infinite`,
          }}/>
        ))}
      </div>
    </div>
  );
}

function Bubble({ msg, mine, onRetry }) {
  const failed  = !!msg._failed;
  const sending = !!msg._temp;

  return (
    <div
      onClick={() => failed && onRetry(msg)}
      style={{
        display:"flex",
        justifyContent: mine ? "flex-end" : "flex-start",
        marginBottom:4,
        paddingLeft:  mine ? 56 : 0,
        paddingRight: mine ? 0  : 56,
        cursor: failed ? "pointer" : "default",
      }}
    >
      <div style={{
        maxWidth:"100%",
        background: failed ? "#fee2e2" : mine ? "#111" : "#fff",
        color:      failed ? "#dc2626"  : mine ? "#fff" : "#111",
        border:     (mine && !failed) ? "none" : "1px solid #e8e8e8",
        padding:"9px 13px 6px",
        borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        fontSize:14, lineHeight:1.5, wordBreak:"break-word",
        boxShadow:"0 1px 3px rgba(0,0,0,.07)",
        opacity: sending ? .55 : 1,
        transition:"opacity .2s",
      }}>
        <div style={{ whiteSpace:"pre-wrap" }}>{msg.message}</div>

        {msg.media_url && (
          <img src={msg.media_url} alt="media"
            style={{ marginTop:6, maxWidth:200, borderRadius:8, display:"block" }}/>
        )}

        {msg.edited && !failed && (
          <span style={{ fontSize:10, opacity:.5 }}> · edited</span>
        )}

        <div style={{
          fontSize:10,
          color: mine ? "rgba(255,255,255,.45)" : "#bbb",
          marginTop:4, display:"flex",
          alignItems:"center", justifyContent:"flex-end", gap:4,
        }}>
          {failed ? (
            <span style={{ color:"#ef4444", fontSize:11 }}>✕ Failed — tap to retry</span>
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

function DateSep({ label }) {
  return (
    <div style={{
      textAlign:"center", fontSize:11, color:"#aaa",
      margin:"14px 0 6px", userSelect:"none",
    }}>
      <span style={{ background:"#e9e9e9", borderRadius:12, padding:"2px 12px" }}>
        {label}
      </span>
    </div>
  );
}

function Spinner({ size = 28 }) {
  return (
    <>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
      <div style={{
        width:size, height:size,
        border:"3px solid #eee", borderTop:"3px solid #111",
        borderRadius:"50%", animation:"sp .75s linear infinite",
        flexShrink:0,
      }}/>
    </>
  );
}

/* ═══════════════════════════════════════
   CHAT
═══════════════════════════════════════ */
export default function Chat({ user }) {
  const { threadId } = useParams();
  const navigate     = useNavigate();

  /* ── state ── */
  const [messages,    setMessages]    = useState([]);
  const [newMsg,      setNewMsg]      = useState("");
  const [otherUser,   setOtherUser]   = useState(null);
  const [product,     setProduct]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [isTyping,    setIsTyping]    = useState(false);
  const [sockReady,   setSockReady]   = useState(false);
  const [error,       setError]       = useState(null);

  /* ── refs ── */
  const socketRef      = useRef(null);
  const bottomRef      = useRef(null);
  const inputRef       = useRef(null);
  const typingTimer    = useRef(null);
  const historyLoaded  = useRef(false);
  const pendingMsgs    = useRef([]);
  const mounted        = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const safe = useCallback((fn) => { if (mounted.current) fn(); }, []);

  /* ══════════════════════════════
     THREAD META
  ══════════════════════════════ */
  useEffect(() => {
    if (!threadId || !user?.id) return;
    const ctrl = new AbortController();

    axios
      .get(`${API}/conversations/${threadId}`, {
        headers: authH(), signal: ctrl.signal, timeout: 8_000,
      })
      .then(({ data }) => {
        const otherId =
          data.other_user_id ||
          (data.buyer_id === user.id ? data.seller_id : data.buyer_id);

        safe(() => setOtherUser({
          id:            otherId,
          name:          data.other_user_name  || "User",
          profile_image: data.other_user_image || null,
          is_online:     data.other_user_online || false,
          store_name:    data.other_user_store  || "",
        }));

        if (data.product_title) {
          safe(() => setProduct({
            title:  data.product_title,
            images: data.product_image ? [data.product_image] : [],
            price:  data.product_price,
          }));
        }

        /* fetch full profile in background */
        if (otherId) {
          axios
            .get(`${API}/users/${otherId}`, { headers: authH() })
            .then(({ data: u }) => safe(() => setOtherUser(u)))
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        console.warn("Thread meta:", err.response?.status, err.message);

        /* fallback — list */
        axios
          .get(`${API}/conversations`, {
            params: { userId: user.id }, headers: authH(), signal: ctrl.signal,
          })
          .then(({ data: list }) => {
            const t = (Array.isArray(list) ? list : [])
              .find((t) => t.thread_id === threadId || t.id === threadId);
            if (!t) return;
            const otherId = t.other_user_id ||
              (t.buyer_id === user.id ? t.seller_id : t.buyer_id);
            safe(() => setOtherUser({
              id:            otherId,
              name:          t.other_user_name  || "User",
              profile_image: t.other_user_image || null,
              is_online:     t.other_user_online || false,
            }));
            if (t.product_title) {
              safe(() => setProduct({
                title:  t.product_title,
                images: t.product_image ? [t.product_image] : [],
                price:  t.product_price,
              }));
            }
          })
          .catch(() => {});
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
      sock.emit("joinThread", { threadId, userId: user.id });
      safe(() => setSockReady(true));
    });
    sock.on("disconnect", () => safe(() => setSockReady(false)));

    sock.on("receiveMessage", (msg) => {
      if (!msg?.id || msg.sender_id === user.id) return;
      if (!historyLoaded.current) { pendingMsgs.current.push(msg); return; }
      safe(() => setMessages((p) => {
        if (p.some((m) => m.id === msg.id)) return p;
        return dedupe([...p, msg]);
      }));
      sock.emit("markRead", { threadId, userId: user.id });
      axios.patch(`${API}/conversations/${threadId}/read`,
        { userId: user.id }, { headers: authH() }).catch(() => {});
    });

    sock.on("messagesRead", ({ userId: uid }) => {
      if (uid === user.id) return;
      safe(() => setMessages((p) =>
        p.map((m) =>
          m.sender_id === user.id && m.status !== "read"
            ? { ...m, status: "read" } : m
        )
      ));
    });

    sock.on("userTyping",     () => safe(() => setIsTyping(true)));
    sock.on("userStopTyping", () => safe(() => setIsTyping(false)));

    sock.on("messageEdited", ({ messageId, message }) =>
      safe(() => setMessages((p) =>
        p.map((m) => m.id === messageId ? { ...m, message, edited: true } : m)
      ))
    );
    sock.on("messageDeleted", ({ messageId }) =>
      safe(() => setMessages((p) => p.filter((m) => m.id !== messageId)))
    );
    sock.on("userOnline",  ({ userId: uid }) => {
      if (uid !== user.id)
        safe(() => setOtherUser((p) => p ? { ...p, is_online: true  } : p));
    });
    sock.on("userOffline", ({ userId: uid }) => {
      if (uid !== user.id)
        safe(() => setOtherUser((p) => p ? { ...p, is_online: false } : p));
    });

    return () => { sock.disconnect(); socketRef.current = null; safe(() => setSockReady(false)); };
  }, [user?.id, threadId]); // eslint-disable-line

  /* ══════════════════════════════
     LOAD HISTORY
  ══════════════════════════════ */
  const loadHistory = useCallback(async () => {
    if (!user?.id || !threadId) return;
    historyLoaded.current  = false;
    pendingMsgs.current    = [];
    safe(() => { setLoading(true); setError(null); });

    try {
      const data = await fetchMessages(threadId, user.id);
      const all  = dedupe([...data, ...pendingMsgs.current]);
      pendingMsgs.current   = [];
      historyLoaded.current = true;
      safe(() => setMessages(all));
      socketRef.current?.emit("markRead", { threadId, userId: user.id });
      axios.patch(`${API}/conversations/${threadId}/read`,
        { userId: user.id }, { headers: authH() }).catch(() => {});
    } catch (err) {
      const status = err.response?.status;
      const body   = err.response?.data;
      const info   = `HTTP ${status ?? "network"} — ${
        typeof body === "object" ? JSON.stringify(body) : (body ?? err.message)
      }`;
      console.error("❌ loadHistory:", info);
      safe(() => setError(info));
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
        { threadId, senderId: user.id, message: text,
          messageType: "text", clientMessageId },
        { headers: authH(), timeout: 12_000 }
      );
      safe(() => setMessages((p) => p.map((m) => m.id === tempId ? saved : m)));
      socketRef.current?.emit("sendMessage", saved);
    } catch (err) {
      console.error("Send failed:", err.response?.data ?? err.message);
      safe(() => {
        setMessages((p) =>
          p.map((m) => m.id === tempId ? { ...m, _temp: false, _failed: true } : m)
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
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }, [sendMessage]);

  const isMine  = useCallback((m) => m.sender_id === user?.id, [user?.id]);
  const grouped = useMemo(() => groupByDate(messages), [messages]);
  const canSend = newMsg.trim().length > 0 && !sending;

  /* ══════════════════════════════
     RENDER
  ══════════════════════════════ */
  return (
    <>
      <style>{`
        .chat-wrap {
          display:flex; flex-direction:column;
          height:100dvh; max-width:700px;
          margin:0 auto; background:#fff;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        }

        /* ── header ── */
        .chat-header {
          display:flex; align-items:center; gap:10px;
          padding:10px 14px;
          border-bottom:1px solid #f0f0f0;
          background:#fff;
          position:sticky; top:0; z-index:20;
          box-shadow:0 1px 8px rgba(0,0,0,.07);
        }
        .chat-back {
          background:none; border:none; cursor:pointer;
          padding:6px; display:flex; align-items:center;
          flex-shrink:0; border-radius:50%;
          transition:background .15s;
        }
        .chat-back:hover { background:#f5f5f5; }
        .chat-avatar-wrap { position:relative; flex-shrink:0; }
        .chat-avatar {
          width:42px; height:42px; border-radius:50%;
          object-fit:cover; background:#eee; display:block;
        }
        .chat-online-dot {
          position:absolute; bottom:1px; right:1px;
          width:10px; height:10px; background:#22c55e;
          border-radius:50%; border:2px solid #fff;
        }
        .chat-header-info { flex:1; min-width:0; }
        .chat-header-name {
          font-weight:700; font-size:15px; line-height:1.3;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .chat-header-sub {
          font-size:11px; margin-top:1px;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .chat-product-thumb {
          width:40px; height:40px; border-radius:8px;
          object-fit:cover; flex-shrink:0; border:1px solid #eee;
        }
        .chat-sock-dot {
          width:8px; height:8px; border-radius:50%; flex-shrink:0;
          transition:background .3s;
        }

        /* ── messages ── */
        .chat-body {
          flex:1; overflow-y:auto; padding:14px 12px;
          display:flex; flex-direction:column; gap:1px;
          background:#f8f8f8;
        }
        .chat-center {
          flex:1; display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          gap:12px; padding:80px 24px 0;
        }

        /* ── input ── */
        .chat-footer {
          display:flex; align-items:center; gap:10px;
          padding:10px 12px;
          border-top:1px solid #f0f0f0;
          background:#fff;
        }
        .chat-input {
          flex:1; padding:11px 16px;
          border-radius:24px; border:1.5px solid #e5e5e5;
          font-size:14px; background:#f8f8f8;
          outline:none; transition:border-color .15s;
          font-family:inherit;
        }
        .chat-input:focus { border-color:#999; }
        .chat-send-btn {
          width:44px; height:44px; border-radius:50%;
          flex-shrink:0; border:none;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; transition:background .15s, transform .1s;
        }
        .chat-send-btn:active { transform:scale(.92); }
        .chat-send-btn:disabled { cursor:default; }

        /* ── error box ── */
        .chat-err-code {
          font-family:monospace; font-size:11px;
          color:#f87171; background:#fef2f2;
          padding:6px 12px; border-radius:8px;
          text-align:center; max-width:320px;
          word-break:break-all;
        }

        /* ── empty ── */
        .chat-empty-icon { opacity:.25; }

        @keyframes btn-spin { to { transform:rotate(360deg); } }
      `}</style>

      <div className="chat-wrap">

        {/* ════ HEADER ════ */}
        <header className="chat-header">

          <button className="chat-back" onClick={() => navigate(-1)} aria-label="Back">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24"
              stroke="#111" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>

          <div className="chat-avatar-wrap">
            <img
              className="chat-avatar"
              src={
                otherUser?.profile_image ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  otherUser?.name || "U"
                )}&background=111&color=fff&size=80`
              }
              alt={otherUser?.name || "User"}
            />
            {otherUser?.is_online && <span className="chat-online-dot"/>}
          </div>

          <div className="chat-header-info">
            <div className="chat-header-name">
              {otherUser?.name || "…"}
            </div>
            <div className="chat-header-sub">
              {isTyping ? (
                <span style={{ color:"#22c55e" }}>typing…</span>
              ) : otherUser?.is_online ? (
                <span style={{ color:"#22c55e" }}>Online</span>
              ) : product?.title ? (
                <span style={{ color:"#888" }}>re: {product.title}</span>
              ) : otherUser?.store_name ? (
                <span style={{ color:"#aaa" }}>{otherUser.store_name}</span>
              ) : null}
            </div>
          </div>

          {product?.images?.[0] && (
            <img
              className="chat-product-thumb"
              src={product.images[0]}
              alt={product.title}
            />
          )}

          <div
            className="chat-sock-dot"
            title={sockReady ? "Connected" : "Connecting…"}
            style={{ background: sockReady ? "#22c55e" : "#f59e0b" }}
          />
        </header>

        {/* ════ BODY ════ */}
        <main className="chat-body">

          {/* Loading */}
          {loading && (
            <div className="chat-center">
              <Spinner/>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="chat-center">
              <svg width="44" height="44" fill="none" viewBox="0 0 24 24"
                stroke="#f87171" strokeWidth={1.5} className="chat-empty-icon"
                style={{ opacity:1 }}>
                <circle cx="12" cy="12" r="10"/>
                <path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
              </svg>
              <p style={{ margin:0, fontSize:14, color:"#888", textAlign:"center" }}>
                Failed to load messages
              </p>
              <p className="chat-err-code">{error}</p>
              <button
                onClick={loadHistory}
                style={{
                  padding:"9px 28px", borderRadius:20,
                  border:"none", background:"#111",
                  color:"#fff", fontSize:13, fontWeight:700,
                  cursor:"pointer",
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && messages.length === 0 && (
            <div className="chat-center">
              <svg width="56" height="56" fill="none" viewBox="0 0 24 24"
                stroke="#ccc" strokeWidth={1.2} className="chat-empty-icon">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03
                     8-9 8a9.77 9.77 0 01-4-.85L3 20l1.09-3.27C3.4
                     15.56 3 13.82 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
              <p style={{ margin:0, fontSize:15, fontWeight:700, color:"#bbb" }}>
                No messages yet
              </p>
              <p style={{ margin:0, fontSize:12, color:"#ccc" }}>
                Say hello to start the conversation!
              </p>
            </div>
          )}

          {/* Messages */}
          {!loading && !error && messages.length > 0 && (
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

        {/* ════ FOOTER ════ */}
        <footer className="chat-footer">
          <input
            ref={inputRef}
            className="chat-input"
            type="text"
            value={newMsg}
            onChange={(e) => { setNewMsg(e.target.value); handleTyping(); }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            aria-label="Message"
            maxLength={5000}
          />

          <button
            className="chat-send-btn"
            onClick={sendMessage}
            disabled={!canSend}
            aria-label="Send"
            style={{ background: canSend ? "#111" : "#e5e5e5" }}
          >
            {sending ? (
              <div style={{
                width:18, height:18,
                border:"2px solid rgba(255,255,255,.3)",
                borderTop:"2px solid #fff",
                borderRadius:"50%",
                animation:"btn-spin .7s linear infinite",
              }}/>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke={canSend ? "#fff" : "#aaa"} strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
              </svg>
            )}
          </button>
        </footer>

      </div>
    </>
  );
}
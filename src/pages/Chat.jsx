// pages/Chat.jsx
import React, {
  useEffect, useState, useRef, useCallback, useMemo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io }   from "socket.io-client";
import axios    from "axios";

const BASE       = "https://minimart-ivrm.onrender.com";
const API        = `${BASE}/api`;
const SOCKET_URL = BASE;

/* ─────────────────────────────────────
   HELPERS
───────────────────────────────────── */
function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}
function authH() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
function formatTime(d) {
  return new Date(d).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
}
function formatDateLabel(d) {
  const date      = new Date(d);
  const now       = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString())       return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday:"short", month:"short", day:"numeric", year:"numeric" });
}
function lastSeenText(lastLogin, isOnline) {
  if (isOnline) return "Online";
  if (!lastLogin) return "Offline";
  const diff = Math.floor((Date.now() - new Date(lastLogin)) / 1000);
  if (diff < 60)      return "last seen just now";
  if (diff < 3600)    return `last seen ${Math.floor(diff/60)}m ago`;
  if (diff < 86400)   return `last seen ${Math.floor(diff/3600)}h ago`;
  if (diff < 172800)  return "last seen yesterday";
  return `last seen ${new Date(lastLogin).toLocaleDateString([], { month:"short", day:"numeric" })}`;
}
function groupByDate(msgs) {
  const out = []; let last = null;
  for (const m of msgs) {
    const lbl = formatDateLabel(m.created_at);
    if (lbl !== last) { out.push({ type:"date", label:lbl }); last = lbl; }
    out.push({ type:"msg", data:m });
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
   TICK (read receipts)
───────────────────────────────────── */
function Tick({ status }) {
  if (status === "sending") return null;
  const isRead      = status === "read";
  const isDelivered = status === "delivered";
  const color = isRead ? "#60a5fa" : isDelivered ? "rgba(255,255,255,.65)" : "rgba(255,255,255,.3)";
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
      {(isRead || isDelivered) ? (
        <>
          <path d="M1 5.5l3 3L10.5 1" stroke={color} strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M5.5 5.5l3 3L15 1" stroke={color} strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round"/>
        </>
      ) : (
        <path d="M1 5.5l3 3L10.5 1" stroke={color} strokeWidth="1.6"
          strokeLinecap="round" strokeLinejoin="round"/>
      )}
    </svg>
  );
}

/* ─────────────────────────────────────
   TYPING BUBBLE
───────────────────────────────────── */
function TypingBubble() {
  return (
    <div className="chat-typing-wrap">
      <div className="chat-typing-bubble">
        {[0,1,2].map(n => (
          <span key={n} className="chat-typing-dot" style={{ animationDelay:`${n*.18}s` }}/>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────
   MESSAGE BUBBLE
───────────────────────────────────── */
function Bubble({ msg, mine, onRetry }) {
  const failed   = !!msg._failed;
  const sending  = !!msg._temp;
  const timedOut = !!msg._timedOut;

  return (
    <div
      onClick={() => (failed || timedOut) && onRetry(msg)}
      className={`chat-bubble-row ${mine ? "mine" : "theirs"}`}
    >
      <div className={`chat-bubble ${mine ? "mine" : "theirs"} ${failed ? "failed" : ""} ${sending ? "sending" : ""}`}>
        <div className="chat-bubble-text">{msg.message}</div>

        {msg.media_url && (
          <img src={msg.media_url} alt="media" className="chat-bubble-media"/>
        )}

        {msg.edited && !failed && (
          <span className="chat-bubble-edited">edited</span>
        )}

        <div className={`chat-bubble-meta ${mine ? "mine" : "theirs"}`}>
          {failed ? (
            <span className="chat-bubble-failed">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2.5}>
                <circle cx="12" cy="12" r="10"/>
                <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round"/>
              </svg>
              Not sent · Tap to retry
            </span>
          ) : timedOut ? (
            <span className="chat-bubble-failed">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2" strokeLinecap="round"/>
              </svg>
              Timed out · Tap to retry
            </span>
          ) : sending ? (
            <span className="chat-bubble-sending">
              <span className="chat-sending-spinner"/>
              Sending
            </span>
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
    <div className="chat-date-sep">
      <span>{label}</span>
    </div>
  );
}

/* ─────────────────────────────────────
   3-DOT MENU
───────────────────────────────────── */
function HeaderMenu({ otherUser, onClose, navigate }) {
  return (
    <>
      <div className="chat-menu-overlay" onClick={onClose}/>
      <div className="chat-menu">
        {otherUser?.id && (
          <button className="chat-menu-item" onClick={() => {
            onClose();
            navigate(`/seller/${otherUser.id}`);
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2}>
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            View Profile
          </button>
        )}
        <button className="chat-menu-item" onClick={() => {
          onClose();
          alert("Report submitted. We'll review this conversation.");
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2}>
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
            <line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
          Report Seller
        </button>
        <button className="chat-menu-item chat-menu-danger" onClick={() => {
          onClose();
          alert("This conversation has been flagged as spam.");
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0
                     001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Mark as Spam
        </button>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════
   MAIN CHAT COMPONENT
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
  const [showMenu,    setShowMenu]    = useState(false);

  const socketRef      = useRef(null);
  const bottomRef      = useRef(null);
  const inputRef       = useRef(null);
  const typingTimer    = useRef(null);
  const historyLoaded  = useRef(false);
  const pendingMsgs    = useRef([]);
  const mounted        = useRef(true);
  const sendTimers     = useRef(new Map()); // track send timeouts

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
        headers:authH(), signal:ctrl.signal, timeout:8000,
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
          last_login:    data.last_login || null,
        }));

        if (data.product_title) {
          safe(() => setProduct({
            title:  data.product_title,
            images: data.product_image ? [data.product_image] : [],
            price:  data.product_price,
          }));
        }

        if (otherId) {
          axios.get(`${API}/users/${otherId}`, { headers:authH() })
            .then(({ data:u }) => safe(() => setOtherUser(u)))
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        axios.get(`${API}/conversations`, {
          params:{ userId:user.id }, headers:authH(), signal:ctrl.signal,
        })
        .then(({ data:list }) => {
          const t = (Array.isArray(list)?list:[]).find(
            t => t.thread_id === threadId || t.id === threadId
          );
          if (!t) return;
          const otherId = t.other_user_id ||
            (t.buyer_id === user.id ? t.seller_id : t.buyer_id);
          safe(() => setOtherUser({
            id:otherId, name:t.other_user_name||"User",
            profile_image:t.other_user_image, is_online:t.other_user_online||false,
          }));
        }).catch(() => {});
      });

    return () => ctrl.abort();
  }, [threadId, user?.id]); // eslint-disable-line

  /* ══════════════════════════════
     SOCKET
  ══════════════════════════════ */
  useEffect(() => {
    if (!user?.id || !threadId) return;
    const sock = io(SOCKET_URL, {
      transports:["websocket","polling"], withCredentials:false,
      query:{ userId:user.id }, reconnection:true,
      reconnectionAttempts:8, reconnectionDelay:1500,
    });
    socketRef.current = sock;

    sock.on("connect", () => {
      sock.emit("joinThread", { threadId, userId:user.id });
      safe(() => setSockReady(true));
    });
    sock.on("disconnect", () => safe(() => setSockReady(false)));

    sock.on("receiveMessage", (msg) => {
      if (!msg?.id || msg.sender_id === user.id) return;
      if (!historyLoaded.current) { pendingMsgs.current.push(msg); return; }
      safe(() => setMessages(p => {
        if (p.some(m => m.id === msg.id)) return p;
        return dedupe([...p, msg]);
      }));
      sock.emit("markRead", { threadId, userId:user.id });
      axios.patch(`${API}/conversations/${threadId}/read`,
        { userId:user.id }, { headers:authH() }).catch(() => {});
    });

    sock.on("messagesRead", ({ userId:uid }) => {
      if (uid === user.id) return;
      safe(() => setMessages(p =>
        p.map(m => m.sender_id === user.id && m.status !== "read"
          ? { ...m, status:"read" } : m)
      ));
    });

    sock.on("userTyping",     () => safe(() => setIsTyping(true)));
    sock.on("userStopTyping", () => safe(() => setIsTyping(false)));

    sock.on("messageEdited", ({ messageId, message }) =>
      safe(() => setMessages(p =>
        p.map(m => m.id === messageId ? { ...m, message, edited:true } : m)
      ))
    );
    sock.on("messageDeleted", ({ messageId }) =>
      safe(() => setMessages(p => p.filter(m => m.id !== messageId)))
    );

    sock.on("userOnline",  ({ userId:uid }) => {
      if (uid !== user.id)
        safe(() => setOtherUser(p => p ? { ...p, is_online:true } : p));
    });
    sock.on("userOffline", ({ userId:uid }) => {
      if (uid !== user.id)
        safe(() => setOtherUser(p => p ? { ...p, is_online:false } : p));
    });

    return () => { sock.disconnect(); socketRef.current = null; };
  }, [user?.id, threadId]); // eslint-disable-line

  /* ══════════════════════════════
     LOAD HISTORY
  ══════════════════════════════ */
  const loadHistory = useCallback(async () => {
    if (!user?.id || !threadId) return;
    historyLoaded.current = false; pendingMsgs.current = [];
    safe(() => { setLoading(true); setError(null); });
    try {
      const { data } = await axios.get(`${API}/messages`, {
        params:{ threadId, userId:user.id }, headers:authH(), timeout:12000,
      });
      const all = dedupe([...(Array.isArray(data)?data:[]), ...pendingMsgs.current]);
      pendingMsgs.current = []; historyLoaded.current = true;
      safe(() => setMessages(all));
      socketRef.current?.emit("markRead", { threadId, userId:user.id });
      axios.patch(`${API}/conversations/${threadId}/read`,
        { userId:user.id }, { headers:authH() }).catch(() => {});
    } catch (err) {
      const info = `${err.response?.status ?? "Network"} — ${
        err.response?.data?.message ?? err.message}`;
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
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages, isTyping]);

  /* ══════════════════════════════
     TYPING
  ══════════════════════════════ */
  const handleTyping = useCallback(() => {
    socketRef.current?.emit("typing", { threadId, userId:user?.id });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit("stopTyping", { threadId, userId:user?.id });
    }, 1500);
  }, [threadId, user?.id]);

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  /* ══════════════════════════════
     SEND with timeout
  ══════════════════════════════ */
  const SEND_TIMEOUT = 15000; // 15 seconds

  const sendMessage = useCallback(async () => {
    const text = newMsg.trim();
    if (!text || sending) return;

    const clientMessageId = `${user.id}_${Date.now()}`;
    const tempId          = `temp_${clientMessageId}`;
    const temp = {
      id:tempId, thread_id:threadId, sender_id:user.id,
      message:text, message_type:"text",
      created_at:new Date().toISOString(),
      status:"sending", _temp:true, _failed:false, _timedOut:false,
    };

    safe(() => { setMessages(p => [...p,temp]); setNewMsg(""); setSending(true); });
    clearTimeout(typingTimer.current);
    socketRef.current?.emit("stopTyping", { threadId, userId:user.id });

    // Set timeout timer
    const timer = setTimeout(() => {
      safe(() => setMessages(p =>
        p.map(m => m.id === tempId && m._temp
          ? { ...m, _temp:false, _timedOut:true } : m)
      ));
      safe(() => setSending(false));
    }, SEND_TIMEOUT);

    sendTimers.current.set(tempId, timer);

    try {
      const { data:saved } = await axios.post(
        `${API}/messages`,
        { threadId, senderId:user.id, message:text,
          messageType:"text", clientMessageId },
        { headers:authH(), timeout:SEND_TIMEOUT }
      );
      clearTimeout(sendTimers.current.get(tempId));
      sendTimers.current.delete(tempId);
      safe(() => setMessages(p => p.map(m => m.id === tempId ? saved : m)));
      socketRef.current?.emit("sendMessage", saved);
    } catch (err) {
      clearTimeout(sendTimers.current.get(tempId));
      sendTimers.current.delete(tempId);
      console.error("Send failed:", err.response?.data ?? err.message);
      safe(() => {
        setMessages(p =>
          p.map(m => m.id === tempId
            ? { ...m, _temp:false, _failed:true, _timedOut:false } : m)
        );
        setNewMsg(text);
      });
    } finally {
      safe(() => setSending(false));
      inputRef.current?.focus();
    }
  }, [newMsg, sending, threadId, user?.id, safe]); // eslint-disable-line

  const retryMessage = useCallback((failedMsg) => {
    setMessages(p => p.filter(m => m.id !== failedMsg.id));
    setNewMsg(failedMsg.message);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }, [sendMessage]);

  const isMine  = useCallback((m) => m.sender_id === user?.id, [user?.id]);
  const grouped = useMemo(() => groupByDate(messages), [messages]);
  const canSend = newMsg.trim().length > 0 && !sending;

  // Clean up timers on unmount
  useEffect(() => () => {
    sendTimers.current.forEach(t => clearTimeout(t));
  }, []);

  /* ══════════════════════════════
     RENDER
  ══════════════════════════════ */
  return (
    <>
      <style>{`
        /* ── Layout ── */
        .chat-wrap {
          display:flex; flex-direction:column;
          height:100dvh; max-width:700px;
          margin:0 auto; background:#fff;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
          position:relative;
        }

        /* ── Header ── */
        .chat-header {
          display:flex; align-items:center; gap:10px;
          padding:10px 14px;
          background:#fff;
          position:sticky; top:0; z-index:20;
          border-bottom:1px solid #f0f0f0;
          box-shadow:0 1px 8px rgba(0,0,0,.06);
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
          border-radius:50%; border:2.5px solid #fff;
        }
        .chat-header-info { flex:1; min-width:0; cursor:pointer; }
        .chat-header-name {
          font-weight:700; font-size:15px; line-height:1.3;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
          color:#111;
        }
        .chat-header-status {
          font-size:11px; margin-top:1px;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .chat-header-status.online  { color:#22c55e; }
        .chat-header-status.typing  { color:#22c55e; font-style:italic; }
        .chat-header-status.offline { color:#999; }

        .chat-product-thumb {
          width:40px; height:40px; border-radius:8px;
          object-fit:cover; flex-shrink:0; border:1px solid #eee;
        }

        /* ── 3 dot menu button ── */
        .chat-more-btn {
          background:none; border:none; cursor:pointer;
          padding:6px; display:flex; align-items:center;
          border-radius:50%; transition:background .15s;
          flex-shrink:0;
        }
        .chat-more-btn:hover { background:#f5f5f5; }

        /* ── Dropdown Menu ── */
        .chat-menu-overlay {
          position:fixed; inset:0; z-index:30;
          background:transparent;
        }
        .chat-menu {
          position:absolute; top:56px; right:12px; z-index:31;
          background:#fff; border:1px solid #eee;
          border-radius:12px; box-shadow:0 8px 30px rgba(0,0,0,.12);
          min-width:200px; overflow:hidden;
          animation:menuSlide .15s ease-out;
        }
        @keyframes menuSlide {
          from { opacity:0; transform:translateY(-8px) scale(.96); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .chat-menu-item {
          display:flex; align-items:center; gap:10px;
          width:100%; padding:13px 16px;
          border:none; background:none;
          font-size:14px; color:#333;
          cursor:pointer; text-align:left;
          transition:background .12s;
          font-family:inherit;
        }
        .chat-menu-item:hover { background:#f8f8f8; }
        .chat-menu-item:not(:last-child) { border-bottom:1px solid #f5f5f5; }
        .chat-menu-danger { color:#dc2626; }
        .chat-menu-danger:hover { background:#fef2f2; }

        /* ── Messages area ── */
        .chat-body {
          flex:1; overflow-y:auto; padding:12px 12px 8px;
          display:flex; flex-direction:column; gap:2px;
          background:#f7f7f8;
        }
        .chat-center {
          flex:1; display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          gap:12px; padding:60px 24px 0;
          text-align:center;
        }

        /* ── Date separator ── */
        .chat-date-sep {
          text-align:center; margin:14px 0 8px;
          user-select:none;
        }
        .chat-date-sep span {
          font-size:11px; font-weight:600; color:#999;
          background:#eaeaea; border-radius:12px;
          padding:3px 14px; letter-spacing:.2px;
        }

        /* ── Bubbles ── */
        .chat-bubble-row {
          display:flex; margin-bottom:3px;
        }
        .chat-bubble-row.mine  { justify-content:flex-end; padding-left:52px; }
        .chat-bubble-row.theirs { justify-content:flex-start; padding-right:52px; }
        .chat-bubble-row.mine:has(+ .chat-bubble-row.theirs),
        .chat-bubble-row.theirs:has(+ .chat-bubble-row.mine) {
          margin-bottom:8px;
        }

        .chat-bubble {
          max-width:100%; padding:9px 13px 5px;
          font-size:14px; line-height:1.5;
          word-break:break-word;
          box-shadow:0 1px 2px rgba(0,0,0,.06);
          position:relative;
        }
        .chat-bubble.mine {
          background:#111; color:#fff;
          border-radius:18px 18px 4px 18px;
        }
        .chat-bubble.theirs {
          background:#fff; color:#111;
          border:1px solid #e8e8e8;
          border-radius:18px 18px 18px 4px;
        }
        .chat-bubble.failed {
          background:#fef2f2 !important; color:#dc2626 !important;
          border:1px solid #fecaca !important;
          cursor:pointer;
        }
        .chat-bubble.sending { opacity:.6; }

        .chat-bubble-text { white-space:pre-wrap; }
        .chat-bubble-media {
          margin-top:6px; max-width:220px;
          border-radius:10px; display:block;
        }
        .chat-bubble-edited {
          font-size:10px; opacity:.45; margin-left:4px;
          font-style:italic;
        }

        .chat-bubble-meta {
          font-size:10px; margin-top:4px;
          display:flex; align-items:center;
          justify-content:flex-end; gap:4px;
        }
        .chat-bubble-meta.mine  { color:rgba(255,255,255,.45); }
        .chat-bubble-meta.theirs { color:#bbb; }

        .chat-bubble-failed {
          color:#ef4444; font-size:11px; font-weight:600;
          display:flex; align-items:center; gap:4px;
        }
        .chat-bubble-sending {
          display:flex; align-items:center; gap:5px;
          color:rgba(255,255,255,.5);
        }

        /* ── Sending spinner ── */
        @keyframes chat-spin { to { transform:rotate(360deg); } }
        .chat-sending-spinner {
          display:inline-block; width:10px; height:10px;
          border:1.5px solid rgba(255,255,255,.25);
          border-top-color:rgba(255,255,255,.7);
          border-radius:50%;
          animation:chat-spin .7s linear infinite;
        }

        /* ── Typing ── */
        .chat-typing-wrap {
          display:flex; justify-content:flex-start;
          margin:4px 0 8px;
        }
        .chat-typing-bubble {
          background:#fff; border:1px solid #e8e8e8;
          border-radius:18px 18px 18px 4px;
          padding:12px 18px; display:flex; gap:5px;
          align-items:center;
          box-shadow:0 1px 3px rgba(0,0,0,.06);
        }
        @keyframes tdot {
          0%,60%,100%{ transform:translateY(0); opacity:.3 }
          30%{ transform:translateY(-5px); opacity:1 }
        }
        .chat-typing-dot {
          display:block; width:7px; height:7px;
          border-radius:50%; background:#bbb;
          animation:tdot 1.1s ease-in-out infinite;
        }

        /* ── Footer ── */
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
        .chat-send-btn:disabled { cursor:default; transform:none; }

        /* ── Error ── */
        .chat-err-code {
          font-family:monospace; font-size:11px;
          color:#f87171; background:#fef2f2;
          padding:6px 14px; border-radius:8px;
          text-align:center; max-width:320px;
          word-break:break-all;
        }

        /* ── Socket dot ── */
        .chat-sock-dot {
          width:7px; height:7px; border-radius:50%;
          flex-shrink:0; transition:background .3s;
        }

        /* ── Spinner ── */
        @keyframes spin { to { transform:rotate(360deg); } }
        .chat-spinner {
          width:28px; height:28px;
          border:3px solid #eee; border-top:3px solid #111;
          border-radius:50%; animation:spin .75s linear infinite;
        }

        /* ── Send button spinner ── */
        @keyframes btn-spin { to { transform:rotate(360deg); } }
        .chat-btn-spinner {
          width:18px; height:18px;
          border:2px solid rgba(255,255,255,.3);
          border-top:2px solid #fff;
          border-radius:50%;
          animation:btn-spin .7s linear infinite;
        }
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
            <img className="chat-avatar"
              src={otherUser?.profile_image ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  otherUser?.name || "U"
                )}&background=111&color=fff&size=80`}
              alt={otherUser?.name || "User"}
            />
            {otherUser?.is_online && <span className="chat-online-dot"/>}
          </div>

          <div className="chat-header-info"
            onClick={() => otherUser?.id && navigate(`/seller/${otherUser.id}`)}>
            <div className="chat-header-name">{otherUser?.name || "…"}</div>
            <div className={`chat-header-status ${
              isTyping ? "typing" :
              otherUser?.is_online ? "online" : "offline"
            }`}>
              {isTyping
                ? "typing…"
                : otherUser?.is_online
                  ? "Online"
                  : lastSeenText(otherUser?.last_login, false)
              }
            </div>
          </div>

          {product?.images?.[0] && (
            <img className="chat-product-thumb"
              src={product.images[0]} alt={product.title}/>
          )}

          <div className="chat-sock-dot"
            title={sockReady ? "Connected" : "Connecting…"}
            style={{ background: sockReady ? "#22c55e" : "#f59e0b" }}/>

          {/* 3-dot menu */}
          <button className="chat-more-btn" onClick={() => setShowMenu(v => !v)}
            aria-label="More options">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#555">
              <circle cx="12" cy="5" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="12" cy="19" r="2"/>
            </svg>
          </button>
        </header>

        {/* Menu dropdown */}
        {showMenu && (
          <HeaderMenu
            otherUser={otherUser}
            onClose={() => setShowMenu(false)}
            navigate={navigate}
          />
        )}

        {/* ════ BODY ════ */}
        <main className="chat-body">

          {loading && (
            <div className="chat-center">
              <div className="chat-spinner"/>
            </div>
          )}

          {!loading && error && (
            <div className="chat-center">
              <svg width="44" height="44" fill="none" viewBox="0 0 24 24"
                stroke="#f87171" strokeWidth={1.5}>
                <circle cx="12" cy="12" r="10"/>
                <path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
              </svg>
              <p style={{ margin:0, fontSize:14, color:"#888" }}>
                Failed to load messages
              </p>
              <p className="chat-err-code">{error}</p>
              <button onClick={loadHistory} style={{
                padding:"9px 28px", borderRadius:20,
                border:"none", background:"#111", color:"#fff",
                fontSize:13, fontWeight:700, cursor:"pointer",
              }}>Retry</button>
            </div>
          )}

          {!loading && !error && messages.length === 0 && (
            <div className="chat-center">
              <svg width="56" height="56" fill="none" viewBox="0 0 24 24"
                stroke="#ddd" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03
                     8-9 8a9.77 9.77 0 01-4-.85L3 20l1.09-3.27C3.4
                     15.56 3 13.82 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
              <p style={{ margin:0, fontSize:15, fontWeight:700, color:"#bbb" }}>
                No messages yet
              </p>
              <p style={{ margin:0, fontSize:13, color:"#ccc" }}>
                Say hello to start the conversation!
              </p>
            </div>
          )}

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
            onChange={e => { setNewMsg(e.target.value); handleTyping(); }}
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
              <div className="chat-btn-spinner"/>
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
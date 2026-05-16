import React, { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import axios from "axios";

const SOCKET_URL = "https://minimart-ivrm.onrender.com";
const API        = "https://minimart-ivrm.onrender.com/api";

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(dateStr) {
  const d     = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString())     return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

// Group messages by date
function groupByDate(messages) {
  const groups = [];
  let lastDate  = null;

  for (const m of messages) {
    const label = formatDateLabel(m.created_at || new Date());
    if (label !== lastDate) {
      groups.push({ type: "date", label });
      lastDate = label;
    }
    groups.push({ type: "message", data: m });
  }
  return groups;
}

export default function Chat({ user }) {
  const { productId }    = useParams();
  const [searchParams]   = useSearchParams();
  const navigate         = useNavigate();
  const receiverId       = searchParams.get("receiver");

  const [messages,    setMessages]    = useState([]);
  const [newMsg,      setNewMsg]      = useState("");
  const [otherUser,   setOtherUser]   = useState(null);
  const [product,     setProduct]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);

  const messagesEndRef = useRef(null);
  const socketRef      = useRef();
  const inputRef       = useRef();

  // Fetch other user info + product info
  useEffect(() => {
    if (!receiverId || !productId) return;
    Promise.all([
      axios.get(`${API}/users/${receiverId}`).catch(() => null),
      axios.get(`${API}/products/${productId}`).catch(() => null),
    ]).then(([userRes, productRes]) => {
      if (userRes)    setOtherUser(userRes.data);
      if (productRes) setProduct(productRes.data);
    });
  }, [receiverId, productId]);

  // Socket setup
  useEffect(() => {
    if (!user) return;

    socketRef.current = io(SOCKET_URL, { transports: ["websocket"] });

    socketRef.current.emit("joinRoom", {
      senderId: user.id, receiverId, productId,
    });

    socketRef.current.on("receiveMessage", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => socketRef.current.disconnect();
  }, [user, receiverId, productId]);

  // Fetch message history
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    axios
      .get(`${API}/messages`, {
        params: { senderId: user.id, receiverId, productId },
      })
      .then((res) => setMessages(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, receiverId, productId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = newMsg.trim();
    if (!text || sending) return;

    const msgObj = {
      sender_id:   user.id,
      receiver_id: receiverId,
      product_id:  productId,
      message:     text,
      created_at:  new Date().toISOString(),
      id:          Date.now(),
      _pending:    true,
    };

    setMessages((prev) => [...prev, msgObj]);
    setNewMsg("");
    setSending(true);

    try {
      const { data } = await axios.post(`${API}/messages`, {
        senderId:   user.id,
        receiverId,
        productId,
        message:    text,
      });

      // Replace the optimistic message with the real one
      setMessages((prev) =>
        prev.map((m) => (m.id === msgObj.id ? data : m))
      );

      // Emit to socket so the other person receives it
      socketRef.current.emit("sendMessage", data);
    } catch (err) {
      console.error("Send failed", err);
      // Remove the failed optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== msgObj.id));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const grouped = groupByDate(messages);
  const isMine  = (m) => (m.sender_id || m.senderId) === user?.id;

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100dvh", maxWidth: 700,
      margin: "auto", background: "#fff",
    }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px", borderBottom: "1px solid #f0f0f0",
        background: "#fff", position: "sticky", top: 0, zIndex: 10,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 4, display: "flex", alignItems: "center",
          }}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24"
            stroke="#000" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Avatar */}
        <div style={{ position: "relative" }}>
          <img
            src={
              otherUser?.profile_image ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser?.name || "U")}&background=000&color=fff`
            }
            alt={otherUser?.name}
            style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
          />
          {otherUser?.is_online && (
            <span style={{
              position: "absolute", bottom: 1, right: 1,
              width: 9, height: 9, background: "#22c55e",
              borderRadius: "50%", border: "2px solid white",
            }} />
          )}
        </div>

        {/* Name + product */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {otherUser?.name || "Loading…"}
          </div>
          {product && (
            <div style={{
              fontSize: 11, color: "#888",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              re: {product.title}
            </div>
          )}
        </div>

        {/* Product thumbnail */}
        {product?.images?.[0] && (
          <img
            src={product.images[0]}
            alt={product.title}
            style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
          />
        )}
      </div>

      {/* ── Messages ── */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "16px 12px",
        display: "flex", flexDirection: "column", gap: 4,
        background: "#fafafa",
      }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
            <div style={{
              width: 28, height: 28, border: "3px solid #eee",
              borderTop: "3px solid #000", borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : messages.length === 0 ? (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 10, color: "#bbb", paddingTop: 60,
          }}>
            <svg width="48" height="48" fill="none" viewBox="0 0 24 24"
              stroke="#ddd" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.85L3 20l1.09-3.27C3.4 15.56 3 13.82 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p style={{ margin: 0, fontSize: 14, color: "#999" }}>No messages yet</p>
            <p style={{ margin: 0, fontSize: 12, color: "#bbb" }}>
              Say hello to start the conversation!
            </p>
          </div>
        ) : (
          grouped.map((item, i) =>
            item.type === "date" ? (
              <div key={i} style={{
                textAlign: "center", fontSize: 11, color: "#aaa",
                margin: "10px 0 4px",
              }}>
                {item.label}
              </div>
            ) : (
              <div
                key={item.data.id}
                style={{
                  display: "flex",
                  justifyContent: isMine(item.data) ? "flex-end" : "flex-start",
                  marginBottom: 2,
                }}
              >
                <div style={{
                  maxWidth: "70%",
                  background:    isMine(item.data) ? "#000" : "#fff",
                  color:         isMine(item.data) ? "#fff" : "#111",
                  border:        isMine(item.data) ? "none" : "1px solid #ececec",
                  padding:       "9px 13px",
                  borderRadius:  isMine(item.data)
                    ? "18px 18px 4px 18px"
                    : "18px 18px 18px 4px",
                  fontSize:      14,
                  lineHeight:    1.45,
                  wordBreak:     "break-word",
                  opacity:       item.data._pending ? 0.6 : 1,
                  boxShadow:     "0 1px 2px rgba(0,0,0,0.04)",
                }}>
                  {item.data.message}
                  <div style={{
                    fontSize: 10,
                    color: isMine(item.data) ? "rgba(255,255,255,0.55)" : "#bbb",
                    marginTop: 4,
                    textAlign: "right",
                  }}>
                    {item.data._pending ? "Sending…" : formatTime(item.data.created_at)}
                  </div>
                </div>
              </div>
            )
          )
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 16px", borderTop: "1px solid #f0f0f0",
        background: "#fff",
      }}>
        <input
          ref={inputRef}
          type="text"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 24,
            border: "1px solid #e5e5e5", fontSize: 14,
            background: "#fafafa", outline: "none",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!newMsg.trim() || sending}
          style={{
            width: 42, height: 42, borderRadius: "50%",
            background: newMsg.trim() ? "#000" : "#e5e5e5",
            border: "none", cursor: newMsg.trim() ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.2s", flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={newMsg.trim() ? "#fff" : "#aaa"} strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>

    </div>
  );
}
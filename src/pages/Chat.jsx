import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import axios from "axios";

const BASE       = "https://minimart-ivrm.onrender.com";
const API        = `${BASE}/api`;
const SOCKET_URL = BASE;

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDateLabel(dateStr) {
  const d         = new Date(dateStr);
  const today     = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], {
    month: "short", day: "numeric", year: "numeric",
  });
}

function groupByDate(messages) {
  const groups  = [];
  let lastLabel = null;
  for (const m of messages) {
    const label = formatDateLabel(m.created_at);
    if (label !== lastLabel) {
      groups.push({ type: "date", label });
      lastLabel = label;
    }
    groups.push({ type: "message", data: m });
  }
  return groups;
}

export default function Chat({ user }) {
  const { threadId } = useParams();   // /chat/:threadId
  const navigate     = useNavigate();

  const [messages,    setMessages]    = useState([]);
  const [newMsg,      setNewMsg]      = useState("");
  const [thread,      setThread]      = useState(null); // thread meta
  const [otherUser,   setOtherUser]   = useState(null);
  const [product,     setProduct]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [isTyping,    setIsTyping]    = useState(false);
  const [typingTimer, setTypingTimer] = useState(null);

  const messagesEndRef = useRef(null);
  const socketRef      = useRef(null);
  const inputRef       = useRef(null);

  // Fetch thread metadata → other user + product
  useEffect(() => {
    if (!threadId || !user?.id) return;
    axios
      .get(`${API}/conversations`, { params: { userId: user.id } })
      .then(({ data }) => {
        const t = data.find((x) => x.thread_id === threadId);
        if (!t) return;
        setThread(t);

        // Fetch full other user profile
        axios.get(`${API}/users/${t.other_user_id}`).then(({ data: u }) => setOtherUser(u)).catch(() => {});

        // Fetch product
        if (t.product_id) {
          axios.get(`${API}/product/${t.product_id}`)
            .catch(() => axios.get(`${API}/products/${t.product_id}`).catch(() => null))
            .then((r) => r && setProduct(r.data));
        }
      })
      .catch(console.error);
  }, [threadId, user?.id]);

  // Socket
  useEffect(() => {
    if (!user?.id || !threadId) return;

    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      withCredentials: false,
    });

    socketRef.current.on("connect", () => {
      socketRef.current.emit("joinThread", {
        threadId, userId: user.id,
      });
    });

    // Message from the other person
    socketRef.current.on("receiveMessage", (msg) => {
      if (!msg?.id) return;
      if (msg.sender_id === user.id) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Mark as read immediately since chat is open
      socketRef.current.emit("markRead", { threadId, userId: user.id });
      axios.patch(`${API}/conversations/${threadId}/read`, { userId: user.id }).catch(() => {});
    });

    // Other person read our messages → update ticks
    socketRef.current.on("messagesRead", ({ userId }) => {
      if (userId === user.id) return;
      setMessages((prev) =>
        prev.map((m) => m.sender_id === user.id && m.status !== "read"
          ? { ...m, status: "read" }
          : m
        )
      );
    });

    // Typing
    socketRef.current.on("userTyping",     () => setIsTyping(true));
    socketRef.current.on("userStopTyping", () => setIsTyping(false));

    socketRef.current.on("connect_error", (err) => {
      console.error("Socket error:", err.message);
    });

    return () => socketRef.current?.disconnect();
  }, [user?.id, threadId]);

  // Fetch message history
  useEffect(() => {
    if (!user?.id || !threadId) return;
    setLoading(true);
    axios
      .get(`${API}/messages`, {
        params: { threadId, userId: user.id },
      })
      .then(({ data }) => {
        setMessages(data);
        // Mark as read on open
        axios.patch(`${API}/conversations/${threadId}/read`, { userId: user.id }).catch(() => {});
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.id, threadId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Typing handler
  const handleTyping = () => {
    socketRef.current?.emit("typing", { threadId, userId: user.id });
    clearTimeout(typingTimer);
    setTypingTimer(setTimeout(() => {
      socketRef.current?.emit("stopTyping", { threadId, userId: user.id });
    }, 1500));
  };

  const sendMessage = useCallback(async () => {
    const text = newMsg.trim();
    if (!text || sending) return;

    const clientMessageId = `${user.id}_${Date.now()}`;
    const temp = {
      id:               `temp_${clientMessageId}`,
      thread_id:        threadId,
      sender_id:        user.id,
      message:          text,
      message_type:     "text",
      created_at:       new Date().toISOString(),
      status:           "sending",
      client_message_id: clientMessageId,
      _temp:            true,
    };

    setMessages((prev) => [...prev, temp]);
    setNewMsg("");
    setSending(true);
    socketRef.current?.emit("stopTyping", { threadId, userId: user.id });

    try {
      // Save to DB
      const { data: saved } = await axios.post(`${API}/messages`, {
        threadId,
        senderId:        user.id,
        message:         text,
        clientMessageId,
      });

      // Swap temp with real
      setMessages((prev) =>
        prev.map((m) => m.id === temp.id ? saved : m)
      );

      // Notify other person via socket
      socketRef.current?.emit("sendMessage", saved);

    } catch (err) {
      console.error("Send failed:", err.message);
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      setNewMsg(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [newMsg, sending, threadId, user?.id]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isMine  = (m) => m.sender_id === user?.id;
  const grouped = groupByDate(messages);

  const statusTick = (status) => {
    if (status === "read") {
      return (
        <svg width="14" height="10" viewBox="0 0 16 10" fill="none">
          <path d="M1 5l3 3L10 1" stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M6 5l3 3 6-7" stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    }
    return (
      <svg width="14" height="10" viewBox="0 0 16 10" fill="none">
        <path d="M1 5l3 3L10 1" stroke="rgba(255,255,255,0.5)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6 5l3 3 6-7" stroke="rgba(255,255,255,0.5)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  };

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
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 4, display: "flex", alignItems: "center", flexShrink: 0,
          }}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24"
            stroke="#000" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>

        <div style={{ position: "relative", flexShrink: 0 }}>
          <img
            src={
              otherUser?.profile_image ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser?.name || "U")}&background=000&color=fff`
            }
            alt={otherUser?.name || "User"}
            style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
          />
          {otherUser?.is_online && (
            <span style={{
              position: "absolute", bottom: 1, right: 1,
              width: 9, height: 9, background: "#22c55e",
              borderRadius: "50%", border: "2px solid white",
            }}/>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>
            {otherUser?.name || "…"}
          </div>
          {isTyping ? (
            <div style={{ fontSize: 11, color: "#22c55e" }}>typing…</div>
          ) : product?.title ? (
            <div style={{
              fontSize: 11, color: "#888", marginTop: 1,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              re: {product.title}
            </div>
          ) : (
            otherUser?.is_online && (
              <div style={{ fontSize: 11, color: "#22c55e" }}>Online</div>
            )
          )}
        </div>

        {product?.images?.[0] && (
          <img
            src={product.images[0]}
            alt={product.title}
            style={{
              width: 38, height: 38, borderRadius: 6,
              objectFit: "cover", flexShrink: 0,
              border: "1px solid #f0f0f0",
            }}
          />
        )}
      </div>

      {/* ── Messages ── */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "16px 12px",
        display: "flex", flexDirection: "column", gap: 2,
        background: "#f7f7f7",
      }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
            <div style={{
              width: 28, height: 28, border: "3px solid #eee",
              borderTop: "3px solid #000", borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}/>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>

        ) : messages.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            flex: 1, gap: 10, paddingTop: 80,
          }}>
            <svg width="52" height="52" fill="none" viewBox="0 0 24 24"
              stroke="#ddd" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.85L3 20l1.09-3.27C3.4 15.56 3 13.82 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#999" }}>
              No messages yet
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#bbb" }}>
              Say hello to start the conversation!
            </p>
          </div>

        ) : (
          <>
            {grouped.map((item, i) =>
              item.type === "date" ? (
                <div key={`d_${i}`} style={{
                  textAlign: "center", fontSize: 11, color: "#aaa",
                  margin: "10px 0 6px", userSelect: "none",
                }}>
                  <span style={{
                    background: "#e8e8e8", borderRadius: 10, padding: "2px 10px",
                  }}>
                    {item.label}
                  </span>
                </div>
              ) : (
                <div key={item.data.id} style={{
                  display: "flex",
                  justifyContent: isMine(item.data) ? "flex-end" : "flex-start",
                  marginBottom: 2,
                }}>
                  <div style={{
                    maxWidth:     "72%",
                    background:   isMine(item.data) ? "#000" : "#fff",
                    color:        isMine(item.data) ? "#fff" : "#111",
                    border:       isMine(item.data) ? "none" : "1px solid #e8e8e8",
                    padding:      "9px 13px 7px",
                    borderRadius: isMine(item.data)
                      ? "18px 18px 4px 18px"
                      : "18px 18px 18px 4px",
                    fontSize:     14, lineHeight: 1.45,
                    wordBreak:    "break-word",
                    boxShadow:    "0 1px 2px rgba(0,0,0,0.06)",
                    opacity:      item.data._temp ? 0.6 : 1,
                    transition:   "opacity 0.2s",
                  }}>
                    {item.data.message}
                    <div style={{
                      fontSize: 10,
                      color: isMine(item.data) ? "rgba(255,255,255,0.5)" : "#bbb",
                      marginTop: 4, textAlign: "right",
                      display: "flex", alignItems: "center",
                      justifyContent: "flex-end", gap: 4,
                    }}>
                      {item.data._temp ? (
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
                          {formatTime(item.data.created_at)}
                          {isMine(item.data) && statusTick(item.data.status)}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            )}

            {/* Typing indicator */}
            {isTyping && (
              <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 4 }}>
                <div style={{
                  background: "#fff", border: "1px solid #e8e8e8",
                  borderRadius: "18px 18px 18px 4px",
                  padding: "10px 14px",
                  display: "flex", gap: 4, alignItems: "center",
                }}>
                  {[0, 1, 2].map((n) => (
                    <div key={n} style={{
                      width: 6, height: 6, borderRadius: "50%", background: "#aaa",
                      animation: `bounce 1s ease-in-out ${n * 0.15}s infinite`,
                    }}/>
                  ))}
                  <style>{`
                    @keyframes bounce {
                      0%, 60%, 100% { transform: translateY(0); }
                      30% { transform: translateY(-4px); }
                    }
                  `}</style>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef}/>
      </div>

      {/* ── Input ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", borderTop: "1px solid #f0f0f0",
        background: "#fff",
      }}>
        <input
          ref={inputRef}
          type="text"
          value={newMsg}
          onChange={(e) => { setNewMsg(e.target.value); handleTyping(); }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 24,
            border: "1px solid #e5e5e5", fontSize: 14,
            background: "#f7f7f7", outline: "none",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#aaa")}
          onBlur={(e)  => (e.target.style.borderColor = "#e5e5e5")}
        />
        <button
          onClick={sendMessage}
          disabled={!newMsg.trim() || sending}
          style={{
            width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
            background: newMsg.trim() && !sending ? "#000" : "#e5e5e5",
            border: "none",
            cursor: newMsg.trim() && !sending ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.2s",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={newMsg.trim() && !sending ? "#fff" : "#aaa"} strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>

    </div>
  );
}
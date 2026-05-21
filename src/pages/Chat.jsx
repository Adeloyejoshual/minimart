// pages/ChatTest.jsx
// Route: /chat/:threadId

import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate }       from "react-router-dom";
import axios                            from "axios";

const API = "https://minimart-ivrm.onrender.com/api";

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

export default function ChatTest({ user }) {
  const { threadId } = useParams();
  const navigate     = useNavigate();

  const [messages, setMessages] = useState([]);
  const [newMsg,   setNewMsg]   = useState("");
  const [status,   setStatus]   = useState("Loading…");
  const [error,    setError]    = useState(null);
  const bottomRef  = useRef(null);

  const token   = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  /* ── 1. Load messages ── */
  useEffect(() => {
    if (!threadId || !user?.id) return;

    setStatus("Fetching messages…");
    setError(null);

    axios
      .get(`${API}/messages`, {
        params:  { threadId, userId: user.id },
        headers,
        timeout: 10_000,
      })
      .then(({ data }) => {
        console.log("✅ Messages:", data);
        setMessages(Array.isArray(data) ? data : []);
        setStatus(`Loaded ${Array.isArray(data) ? data.length : 0} messages`);
      })
      .catch((err) => {
        const msg = `${err.response?.status ?? "Network"} — ${
          err.response?.data?.message ?? err.message
        }`;
        console.error("❌ Load failed:", msg);
        setError(msg);
        setStatus("Failed");
      });
  }, [threadId, user?.id]); // eslint-disable-line

  /* ── 2. Auto scroll ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── 3. Send ── */
  const send = async () => {
    const text = newMsg.trim();
    if (!text) return;

    setNewMsg("");

    try {
      const { data } = await axios.post(
        `${API}/messages`,
        {
          threadId,
          senderId:        user.id,
          message:         text,
          messageType:     "text",
          clientMessageId: `${user.id}_${Date.now()}`,
        },
        { headers, timeout: 10_000 }
      );

      console.log("✅ Sent:", data);
      setMessages((p) => [...p, data]);
    } catch (err) {
      const msg = `Send failed: ${err.response?.data?.message ?? err.message}`;
      console.error("❌", msg);
      alert(msg);
    }
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100dvh", maxWidth: 600,
      margin: "0 auto", fontFamily: "monospace",
      background: "#fff",
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: "12px 16px",
        background: "#111", color: "#fff",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none", border: "1px solid #555",
            color: "#fff", padding: "4px 10px",
            borderRadius: 6, cursor: "pointer", fontSize: 12,
          }}
        >
          ← Back
        </button>
        <div style={{ flex: 1, fontSize: 12 }}>
          <div style={{ fontWeight: 700 }}>Chat Test</div>
          <div style={{ color: "#aaa", fontSize: 10 }}>
            Thread: {threadId?.slice(0, 8)}…
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#aaa" }}>
          User: {user?.id?.slice(0, 8)}…
        </div>
      </div>

      {/* ── Debug bar ── */}
      <div style={{
        padding: "6px 16px",
        background: error ? "#fee2e2" : "#f0fdf4",
        fontSize: 11,
        color: error ? "#dc2626" : "#16a34a",
        borderBottom: "1px solid #eee",
      }}>
        {error ? `❌ ${error}` : `✅ ${status}`}
      </div>

      {/* ── Debug info ── */}
      <div style={{
        padding: "6px 16px",
        background: "#f8f8f8",
        fontSize: 10, color: "#888",
        borderBottom: "1px solid #eee",
      }}>
        <div>URL: {API}/messages?threadId={threadId}&userId={user?.id}</div>
        <div>Token: {token ? token.slice(0, 20) + "…" : "❌ MISSING"}</div>
      </div>

      {/* ── Messages ── */}
      <div style={{
        flex: 1, overflowY: "auto",
        padding: 16, display: "flex",
        flexDirection: "column", gap: 8,
        background: "#f8f8f8",
      }}>
        {messages.length === 0 && !error && (
          <div style={{
            textAlign: "center", color: "#aaa",
            fontSize: 13, marginTop: 40,
          }}>
            No messages yet — send one below
          </div>
        )}

        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} style={{
              display: "flex",
              justifyContent: mine ? "flex-end" : "flex-start",
            }}>
              <div style={{
                maxWidth: "70%",
                background: mine ? "#111" : "#fff",
                color:      mine ? "#fff" : "#111",
                border:     mine ? "none" : "1px solid #ddd",
                borderRadius: 12,
                padding: "8px 12px",
                fontSize: 13,
              }}>
                {/* Sender label */}
                <div style={{
                  fontSize: 9, color: mine ? "#aaa" : "#999",
                  marginBottom: 3,
                }}>
                  {mine ? "You" : (m.sender_name || m.sender_id?.slice(0, 8))}
                </div>

                {/* Message */}
                <div>{m.message}</div>

                {/* Time + status */}
                <div style={{
                  fontSize: 9, color: mine ? "#888" : "#bbb",
                  marginTop: 4, textAlign: "right",
                }}>
                  {new Date(m.created_at).toLocaleTimeString([], {
                    hour: "2-digit", minute: "2-digit",
                  })}
                  {mine && ` · ${m.status}`}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div style={{
        display: "flex", gap: 8,
        padding: "10px 12px",
        borderTop: "1px solid #eee",
        background: "#fff",
      }}>
        <input
          type="text"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message and press Enter…"
          style={{
            flex: 1, padding: "10px 14px",
            borderRadius: 8, border: "1px solid #ddd",
            fontSize: 13, outline: "none",
          }}
        />
        <button
          onClick={send}
          disabled={!newMsg.trim()}
          style={{
            padding: "10px 18px",
            borderRadius: 8, border: "none",
            background: newMsg.trim() ? "#111" : "#ddd",
            color: newMsg.trim() ? "#fff" : "#aaa",
            fontWeight: 700, fontSize: 13,
            cursor: newMsg.trim() ? "pointer" : "default",
          }}
        >
          Send
        </button>
      </div>

    </div>
  );
}
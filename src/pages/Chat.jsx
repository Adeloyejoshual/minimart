// pages/ChatTest.jsx — full rewrite with auto-create
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

  const [messages,  setMessages]  = useState([]);
  const [newMsg,    setNewMsg]    = useState("");
  const [status,    setStatus]    = useState("idle");
  const [log,       setLog]       = useState([]);
  const [sellerId,  setSellerId]  = useState("");
  const [creating,  setCreating]  = useState(false);
  const bottomRef = useRef(null);

  const token   = getToken();
  const headers = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const addLog = (msg, ok = true) =>
    setLog((p) => [...p, { msg, ok, t: Date.now() }]);

  /* ── load messages ── */
  useEffect(() => {
    if (!threadId || !user?.id) return;

    setStatus("loading");
    addLog(`GET /messages?threadId=${threadId}&userId=${user.id}`);

    axios
      .get(`${API}/messages`, {
        params:  { threadId, userId: user.id },
        headers,
        timeout: 10_000,
      })
      .then(({ data, status: s }) => {
        addLog(`✅ HTTP ${s} — ${data.length} messages`);
        setMessages(Array.isArray(data) ? data : []);
        setStatus("ok");
      })
      .catch((err) => {
        const s = err.response?.status;
        const m = err.response?.data?.message || err.message;
        addLog(`❌ HTTP ${s} — ${m}`, false);
        setStatus(`error: ${s} ${m}`);
      });
  }, [threadId, user?.id]); // eslint-disable-line

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── send ── */
  const send = async () => {
    const text = newMsg.trim();
    if (!text) return;
    setNewMsg("");
    addLog(`POST /messages: "${text}"`);

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
        { headers: { ...headers, "Content-Type": "application/json" }, timeout: 10_000 }
      );
      addLog(`✅ Sent: id=${data.id}`);
      setMessages((p) => [...p, data]);
    } catch (err) {
      const m = err.response?.data?.message || err.message;
      addLog(`❌ Send failed: ${m}`, false);
      alert("Send failed: " + m);
    }
  };

  /* ── create thread ── */
  const createThread = async () => {
    if (!sellerId.trim()) return alert("Paste a sellerId first");
    setCreating(true);
    addLog(`POST /conversations buyer=${user?.id} seller=${sellerId}`);

    try {
      const { data } = await axios.post(
        `${API}/conversations`,
        { buyerId: user?.id, sellerId: sellerId.trim(), productId: null },
        { headers: { ...headers, "Content-Type": "application/json" }, timeout: 10_000 }
      );
      const tid = data.thread_id || data.id;
      addLog(`✅ Thread: ${tid}`);
      navigate(`/chat/${tid}`);
    } catch (err) {
      const m = err.response?.data?.message || err.message;
      addLog(`❌ Create failed: ${m}`, false);
      alert("Failed: " + m);
    } finally {
      setCreating(false);
    }
  };

  /* ── list threads ── */
  const listThreads = async () => {
    addLog(`GET /conversations?userId=${user?.id}`);
    try {
      const { data } = await axios.get(`${API}/conversations`, {
        params: { userId: user?.id },
        headers,
        timeout: 10_000,
      });
      const list = Array.isArray(data) ? data : [];
      addLog(`✅ ${list.length} conversations found`);
      list.forEach((t) =>
        addLog(`  → ${t.thread_id || t.id} | ${t.other_user_name}`)
      );
      if (list.length > 0) {
        const tid = list[0].thread_id || list[0].id;
        addLog(`Navigating to ${tid}…`);
        setTimeout(() => navigate(`/chat/${tid}`), 800);
      } else {
        addLog("No conversations yet — create one below", false);
      }
    } catch (err) {
      addLog(`❌ ${err.response?.data?.message || err.message}`, false);
    }
  };

  const isOk = status === "ok";

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100dvh", maxWidth: 600,
      margin: "0 auto", fontFamily: "monospace",
      background: "#fff", fontSize: 12,
    }}>

      {/* header */}
      <div style={{
        background: "#111", color: "#fff",
        padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none", border: "1px solid #444",
            color: "#fff", padding: "4px 10px",
            borderRadius: 6, cursor: "pointer", fontSize: 11,
          }}
        >
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>Chat Debug</div>
          <div style={{ color: "#aaa", fontSize: 10 }}>
            Thread: {threadId?.slice(0, 8)}… | User: {user?.id?.slice(0, 8)}…
          </div>
        </div>
      </div>

      {/* status bar */}
      <div style={{
        padding: "6px 14px",
        background: isOk ? "#f0fdf4" : "#fef2f2",
        color: isOk ? "#16a34a" : "#dc2626",
        borderBottom: "1px solid #eee",
        display: "flex", justifyContent: "space-between",
      }}>
        <span>{isOk ? `✅ ${messages.length} messages loaded` : `❌ ${status}`}</span>
        <span style={{ color: "#888" }}>
          Token: {token ? token.slice(0, 15) + "…" : "❌ MISSING"}
        </span>
      </div>

      {/* ── CREATE THREAD panel (shown when 404) ── */}
      {status.includes("404") && (
        <div style={{
          padding: 14, background: "#fff7ed",
          borderBottom: "2px solid #fed7aa",
        }}>
          <div style={{ fontWeight: 700, color: "#c2410c", marginBottom: 8 }}>
            ⚠️ Thread doesn't exist in DB — create it first
          </div>

          {/* Option A — list existing */}
          <button
            onClick={listThreads}
            style={{
              width: "100%", padding: "9px",
              background: "#7c3aed", color: "#fff",
              border: "none", borderRadius: 6,
              fontWeight: 700, cursor: "pointer",
              marginBottom: 8,
            }}
          >
            List my existing conversations (auto-navigate)
          </button>

          {/* Option B — create new */}
          <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>
            — or create a new thread —
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              placeholder="Paste other user's ID…"
              style={{
                flex: 1, padding: "8px 10px",
                border: "1px solid #ddd", borderRadius: 6,
                fontSize: 11,
              }}
            />
            <button
              onClick={createThread}
              disabled={creating}
              style={{
                padding: "8px 14px",
                background: "#111", color: "#fff",
                border: "none", borderRadius: 6,
                fontWeight: 700, cursor: "pointer",
                fontSize: 11,
              }}
            >
              {creating ? "…" : "Create"}
            </button>
          </div>
          <div style={{ fontSize: 10, color: "#aaa", marginTop: 6 }}>
            Your ID: <strong>{user?.id}</strong>
          </div>
        </div>
      )}

      {/* messages */}
      <div style={{
        flex: 1, overflowY: "auto",
        padding: 12, background: "#f8f8f8",
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        {isOk && messages.length === 0 && (
          <div style={{ textAlign: "center", color: "#aaa", marginTop: 40 }}>
            No messages — send one below ↓
          </div>
        )}

        {isOk && messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "70%", padding: "8px 12px",
                borderRadius: 12,
                background: mine ? "#111" : "#fff",
                color:      mine ? "#fff" : "#111",
                border:     mine ? "none" : "1px solid #ddd",
              }}>
                <div style={{ fontSize: 9, opacity: .6, marginBottom: 3 }}>
                  {mine ? "You" : (m.sender_name || m.sender_id?.slice(0, 8))}
                </div>
                <div>{m.message}</div>
                <div style={{ fontSize: 9, opacity: .5, textAlign: "right", marginTop: 3 }}>
                  {new Date(m.created_at).toLocaleTimeString([], {
                    hour: "2-digit", minute: "2-digit",
                  })}
                  {mine && ` · ${m.status}`}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef}/>
      </div>

      {/* log */}
      <div style={{
        background: "#1a1a1a", padding: "8px 12px",
        maxHeight: 100, overflowY: "auto",
      }}>
        {log.slice(-6).map((l, i) => (
          <div key={i} style={{ color: l.ok ? "#4ade80" : "#f87171", fontSize: 10 }}>
            {l.msg}
          </div>
        ))}
      </div>

      {/* input */}
      <div style={{
        display: "flex", gap: 8, padding: "10px 12px",
        borderTop: "1px solid #eee", background: "#fff",
      }}>
        <input
          type="text"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={isOk ? "Type a message…" : "Fix the error above first"}
          disabled={!isOk}
          style={{
            flex: 1, padding: "10px 14px",
            borderRadius: 8, border: "1px solid #ddd",
            fontSize: 13, outline: "none",
            background: isOk ? "#fff" : "#f8f8f8",
          }}
        />
        <button
          onClick={send}
          disabled={!isOk || !newMsg.trim()}
          style={{
            padding: "10px 18px", borderRadius: 8,
            border: "none", fontWeight: 700, fontSize: 13,
            background: isOk && newMsg.trim() ? "#111" : "#ddd",
            color:      isOk && newMsg.trim() ? "#fff" : "#aaa",
            cursor:     isOk && newMsg.trim() ? "pointer" : "default",
          }}
        >
          Send
        </button>
      </div>

    </div>
  );
}
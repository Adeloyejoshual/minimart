import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api";

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Conversations({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // If arriving from a product page with ?userId=&productId=, auto-open that chat
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(location.search);
    const sellerId  = params.get("userId");
    const productId = params.get("productId");

    if (sellerId && productId) {
      axios
        .post(`${API}/conversations/start`, {
          senderId:   user.id,
          receiverId: sellerId,
          productId,
        })
        .then(() => navigate(`/chat/${productId}?receiver=${sellerId}`))
        .catch(console.error);
    }
  }, [location.search, user]);

  // Fetch all conversations for this user
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    axios
      .get(`${API}/conversations`, { params: { userId: user.id } })
      .then((res) => setConversations(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <div style={{
          width: 32, height: 32, border: "3px solid #eee",
          borderTop: "3px solid #000", borderRadius: "50%",
          animation: "spin 0.8s linear infinite"
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#ef4444" }}>
        <p>Failed to load conversations.</p>
        <p style={{ fontSize: 12, color: "#aaa" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: "auto", padding: "20px 0" }}>
      <h2 style={{ padding: "0 16px", marginBottom: 16, fontSize: 18 }}>Messages</h2>

      {conversations.length === 0 ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "60px 20px", gap: 12,
        }}>
          <svg width="56" height="56" fill="none" viewBox="0 0 24 24"
            stroke="#ccc" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.85L3 20l1.09-3.27C3.4 15.56 3 13.82 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p style={{ fontWeight: 600, fontSize: 15, color: "#555", margin: 0 }}>
            No messages yet
          </p>
          <p style={{ fontSize: 13, color: "#aaa", margin: 0, textAlign: "center" }}>
            When you contact a seller or receive a message,<br />it will appear here.
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {conversations.map((c) => (
            <li
              key={c.id}
              onClick={() => navigate(`/chat/${c.product_id}?receiver=${c.other_user_id}`)}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 16px", cursor: "pointer",
                borderBottom: "1px solid #f0f0f0", transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {/* Avatar + online dot */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <img
                  src={
                    c.other_user_avatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(c.other_user_name)}&background=000&color=fff`
                  }
                  alt={c.other_user_name}
                  style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }}
                />
                {c.other_user_online && (
                  <span style={{
                    position: "absolute", bottom: 2, right: 2,
                    width: 10, height: 10, background: "#22c55e",
                    borderRadius: "50%", border: "2px solid white",
                  }} />
                )}
              </div>

              {/* Name, product tag, last message */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <strong style={{ fontSize: 14 }}>{c.other_user_name}</strong>
                  <span style={{ fontSize: 12, color: "#aaa", flexShrink: 0, marginLeft: 8 }}>
                    {timeAgo(c.created_at)}
                  </span>
                </div>
                {c.product_title && (
                  <div style={{
                    display: "inline-block", fontSize: 11, color: "#888",
                    background: "#f3f3f3", borderRadius: 4,
                    padding: "1px 6px", marginBottom: 4,
                  }}>
                    {c.product_title}
                  </div>
                )}
                <div style={{
                  fontSize: 13, color: "#666",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {c.last_message}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
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
    const sellerId = params.get("userId");
    const productId = params.get("productId");

    if (sellerId && productId) {
      axios
        .post(`${API}/conversations/start`, {
          senderId: user.id,
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
    axios
      .get(`${API}/conversations`, { params: { userId: user.id } })
      .then((res) => setConversations(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <p style={{ padding: 20 }}>Loading conversations…</p>;
  if (error)   return <p style={{ padding: 20, color: "red" }}>{error}</p>;

  return (
    <div style={{ maxWidth: 680, margin: "auto", padding: "20px 0" }}>
      <h2 style={{ padding: "0 16px", marginBottom: 16 }}>Messages</h2>

      {conversations.length === 0 && (
        <p style={{ padding: "0 16px", color: "#888" }}>No conversations yet.</p>
      )}

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {conversations.map((c) => (
          <li
            key={c.id}
            onClick={() =>
              navigate(`/chat/${c.product_id}?receiver=${c.other_user_id}`)
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 16px",
              cursor: "pointer",
              borderBottom: "1px solid #f0f0f0",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {/* Avatar */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <img
                src={c.other_user_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.other_user_name)}&background=000&color=fff`}
                alt={c.other_user_name}
                style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }}
              />
              {c.other_user_online && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 2,
                    right: 2,
                    width: 10,
                    height: 10,
                    background: "#22c55e",
                    borderRadius: "50%",
                    border: "2px solid white",
                  }}
                />
              )}
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ fontSize: 14 }}>{c.other_user_name}</strong>
                <span style={{ fontSize: 12, color: "#aaa" }}>
                  {timeAgo(c.created_at)}
                </span>
              </div>
              {c.product_title && (
                <div style={{ fontSize: 12, color: "#888", marginBottom: 2 }}>
                  re: {c.product_title}
                </div>
              )}
              <div
                style={{
                  fontSize: 13,
                  color: "#555",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {c.last_message}
              </div>
            </div>

            {/* Product thumbnail */}
            {c.product_image && (
              <img
                src={c.product_image}
                alt={c.product_title}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 6,
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
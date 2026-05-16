import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr);
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Conversations({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [threads,  setThreads]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  // Auto-start thread if arriving from product page
  useEffect(() => {
    if (!user) return;
    const params   = new URLSearchParams(location.search);
    const sellerId = params.get("userId");
    const productId = params.get("productId");
    if (!sellerId || !productId) return;

    axios
      .post(`${API}/conversations/start`, {
        buyerId:   user.id,
        sellerId,
        productId,
      })
      .then(({ data }) => navigate(`/chat/${data.threadId}`))
      .catch(console.error);
  }, [location.search, user]);

  // Fetch threads
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    axios
      .get(`${API}/conversations`, { params: { userId: user.id } })
      .then(({ data }) => setThreads(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
      <div style={{
        width: 30, height: 30, border: "3px solid #eee",
        borderTop: "3px solid #000", borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ padding: 20, textAlign: "center", color: "#ef4444" }}>
      <p>Failed to load messages.</p>
      <p style={{ fontSize: 12, color: "#aaa" }}>{error}</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 680, margin: "auto", padding: "0" }}>
      <div style={{
        padding: "16px 16px 12px",
        borderBottom: "1px solid #f0f0f0",
        position: "sticky", top: 0, background: "#fff", zIndex: 10,
      }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Messages</h2>
      </div>

      {threads.length === 0 ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "70px 20px", gap: 12,
        }}>
          <svg width="56" height="56" fill="none" viewBox="0 0 24 24"
            stroke="#ddd" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.85L3 20l1.09-3.27C3.4 15.56 3 13.82 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          <p style={{ fontWeight: 600, fontSize: 15, color: "#555", margin: 0 }}>
            No messages yet
          </p>
          <p style={{ fontSize: 13, color: "#aaa", margin: 0, textAlign: "center" }}>
            When you contact a seller or receive a message,<br/>it will appear here.
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {threads.map((t) => (
            <li
              key={t.thread_id}
              onClick={() => navigate(`/chat/${t.thread_id}`)}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 16px", cursor: "pointer",
                borderBottom: "1px solid #f5f5f5",
                transition: "background 0.15s",
                background: t.unread_count > 0 ? "#fafafa" : "transparent",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
              onMouseLeave={(e) => (
                e.currentTarget.style.background =
                  t.unread_count > 0 ? "#fafafa" : "transparent"
              )}
            >
              {/* Avatar */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <img
                  src={
                    t.other_user_avatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(t.other_user_name || "U")}&background=000&color=fff`
                  }
                  alt={t.other_user_name}
                  style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }}
                />
                {t.other_user_online && (
                  <span style={{
                    position: "absolute", bottom: 2, right: 2,
                    width: 10, height: 10, background: "#22c55e",
                    borderRadius: "50%", border: "2px solid white",
                  }}/>
                )}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: 2,
                }}>
                  <strong style={{
                    fontSize: 14,
                    fontWeight: t.unread_count > 0 ? 700 : 500,
                  }}>
                    {t.other_user_name}
                  </strong>
                  <span style={{ fontSize: 11, color: "#aaa", flexShrink: 0, marginLeft: 8 }}>
                    {timeAgo(t.last_message_at)}
                  </span>
                </div>
                {t.product_title && (
                  <div style={{
                    fontSize: 11, color: "#888",
                    background: "#f3f3f3", display: "inline-block",
                    borderRadius: 4, padding: "1px 6px", marginBottom: 3,
                  }}>
                    {t.product_title}
                  </div>
                )}
                <div style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", gap: 6,
                }}>
                  <div style={{
                    fontSize: 13,
                    color: t.unread_count > 0 ? "#111" : "#888",
                    fontWeight: t.unread_count > 0 ? 500 : 400,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    flex: 1,
                  }}>
                    {t.last_message || "Start a conversation"}
                  </div>
                  {t.unread_count > 0 && (
                    <span style={{
                      background: "#000", color: "#fff",
                      borderRadius: "50%", minWidth: 18, height: 18,
                      fontSize: 10, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "0 4px", flexShrink: 0,
                    }}>
                      {t.unread_count > 99 ? "99+" : t.unread_count}
                    </span>
                  )}
                </div>
              </div>

              {/* Product thumbnail */}
              {t.product_images?.[0] && (
                <img
                  src={t.product_images[0]}
                  alt={t.product_title}
                  style={{
                    width: 44, height: 44, borderRadius: 6,
                    objectFit: "cover", flexShrink: 0,
                    border: "1px solid #f0f0f0",
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
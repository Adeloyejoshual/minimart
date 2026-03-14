// src/pages/ConversationsPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import BottomNav from "../components/BottomNav"; // <-- import bottom nav

export default function ConversationsPage() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const API = "https://minimart-ivrm.onrender.com/api";
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) return;
    fetchConversations();
  }, [token]);

  const fetchConversations = async () => {
    try {
      const res = await axios.get(`${API}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConversations(res.data);
    } catch (err) {
      console.error("Failed to fetch conversations", err);
    }
  };

  const openChat = (productId, receiverId) => {
    navigate(`/chat/${productId}?receiver=${receiverId}`);
  };

  return (
    <div style={{ maxWidth: 800, margin: "auto", padding: 20, paddingBottom: 80 }}>
      <h1>Conversations</h1>

      {conversations.length === 0 ? (
        <p>No conversations yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {conversations.map((conv) => (
            <li
              key={conv.product_id + conv.other_user_id}
              onClick={() => openChat(conv.product_id, conv.other_user_id)}
              style={{
                borderBottom: "1px solid #ccc",
                padding: 10,
                cursor: "pointer",
              }}
            >
              <strong>{conv.product_title}</strong> <br />
              <span>With: {conv.other_user_name}</span> <br />
              <span>Messages: {conv.message_count}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
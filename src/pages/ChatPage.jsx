// src/pages/ChatPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import io from "socket.io-client";

export default function ChatPage() {
  const { id: productId } = useParams();
  const [searchParams] = useSearchParams();
  const receiverId = searchParams.get("receiver");
  const token = localStorage.getItem("token");
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const socketRef = useRef();
  const messagesEndRef = useRef();
  const API = "https://minimart-ivrm.onrender.com/api";

  useEffect(() => {
    if (!token) return;
    fetchMessages();
    setupSocket();
  }, [token]);

  const fetchMessages = async () => {
    try {
      const res = await axios.get(
        `${API}/messages?productId=${productId}&receiverId=${receiverId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(res.data);
      scrollToBottom();
    } catch (err) {
      console.error("Failed to fetch messages", err);
    }
  };

  const setupSocket = () => {
    socketRef.current = io(API.replace("/api", ""), {
      auth: { token },
    });

    socketRef.current.emit("joinRoom", { productId, receiverId });

    socketRef.current.on("receiveMessage", (msg) => {
      if (msg.product_id === productId) {
        setMessages((prev) => [...prev, msg]);
        scrollToBottom();
      }
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const msgObj = {
      productId,
      receiverId,
      message: newMessage,
    };

    socketRef.current.emit("sendMessage", msgObj);

    setMessages((prev) => [...prev, { ...msgObj, sender_id: "me", created_at: new Date() }]);
    setNewMessage("");
    scrollToBottom();

    try {
      await axios.post(`${API}/messages`, msgObj, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      console.error("Failed to save message", err);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "auto", padding: 20 }}>
      <h1>Chat about Product</h1>
      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: 8,
          height: 400,
          overflowY: "auto",
          padding: 10,
          marginBottom: 10,
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              textAlign: msg.sender_id === "me" ? "right" : "left",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "6px 12px",
                borderRadius: 12,
                backgroundColor: msg.sender_id === "me" ? "#4f46e5" : "#e5e7eb",
                color: msg.sender_id === "me" ? "#fff" : "#000",
              }}
            >
              {msg.message}
            </span>
            <br />
            <small style={{ color: "#888" }}>{new Date(msg.created_at).toLocaleTimeString()}</small>
          </div>
        ))}
        <div ref={messagesEndRef}></div>
      </div>

      <form onSubmit={sendMessage} style={{ display: "flex" }}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />
        <button type="submit" style={{ marginLeft: 10, padding: "10px 20px" }}>
          Send
        </button>
      </form>
    </div>
  );
}
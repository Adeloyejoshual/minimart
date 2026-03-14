// src/pages/Chat.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import axios from "axios";

const SOCKET_URL = "http://localhost:5000"; // <-- replace with your backend URL
const API = "https://minimart-ivrm.onrender.com/api/messages";

export default function Chat({ user }) {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const receiverId = searchParams.get("receiver");

  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const messagesEndRef = useRef(null);

  // Initialize socket
  const socketRef = useRef();

  useEffect(() => {
    if (!user) return;

    // Connect to socket server
    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket"],
    });

    // Join a room for this product & user pair
    socketRef.current.emit("joinRoom", {
      senderId: user.id,
      receiverId,
      productId,
    });

    // Receive messages
    socketRef.current.on("receiveMessage", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    // Cleanup on unmount
    return () => {
      socketRef.current.disconnect();
    };
  }, [user, receiverId, productId]);

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      if (!user) return;
      try {
        const res = await axios.get(API, {
          params: { senderId: user.id, receiverId, productId },
        });
        setMessages(res.data);
      } catch (err) {
        console.error("Failed to fetch messages", err);
      }
    };
    fetchMessages();
  }, [user, receiverId, productId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!newMsg.trim()) return;
    const msgObj = {
      senderId: user.id,
      receiverId,
      productId,
      message: newMsg,
    };
    socketRef.current.emit("sendMessage", msgObj);
    setMessages((prev) => [...prev, { ...msgObj, id: Date.now() }]);
    setNewMsg("");
  };

  return (
    <div style={{ maxWidth: 700, margin: "auto", padding: 20 }}>
      <h2>Chat</h2>
      <div
        style={{
          border: "1px solid #ccc",
          height: 400,
          overflowY: "auto",
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.senderId === user.id ? "flex-end" : "flex-start",
              background: m.senderId === user.id ? "#000" : "#eee",
              color: m.senderId === user.id ? "#fff" : "#000",
              padding: 8,
              borderRadius: 8,
              maxWidth: "70%",
              wordBreak: "break-word",
            }}
          >
            {m.message}
          </div>
        ))}
        <div ref={messagesEndRef}></div>
      </div>

      <div style={{ display: "flex", marginTop: 10 }}>
        <input
          type="text"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
        />
        <button
          onClick={sendMessage}
          style={{
            marginLeft: 10,
            padding: "10px 20px",
            borderRadius: 6,
            background: "black",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
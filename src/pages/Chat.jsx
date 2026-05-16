// src/pages/Chat.jsx

import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";

const API_BASE = "https://minimart-ivrm.onrender.com";

export default function Chat() {
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  const token = localStorage.getItem("token");
  const userId = localStorage.getItem("userId");

  // -------------------------------
  // Axios instance (auth)
  // -------------------------------
  const api = axios.create({
    baseURL: `${API_BASE}/api/messages`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // -------------------------------
  // INIT SOCKET (IMPORTANT FIX)
  // -------------------------------
  useEffect(() => {
    socketRef.current = io(API_BASE, {
      auth: { userId },
      transports: ["websocket"], // 🔥 important for Render
    });

    socketRef.current.on("connect", () => {
      console.log("Socket connected");
    });

    socketRef.current.on("connect_error", (err) => {
      console.error("Socket error:", err.message);
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  // -------------------------------
  // Load threads
  // -------------------------------
  useEffect(() => {
    fetchThreads();
  }, []);

  const fetchThreads = async () => {
    try {
      const res = await api.get("/threads");
      setThreads(res.data);
    } catch (err) {
      console.error("Threads error:", err.response?.data || err.message);
    }
  };

  // -------------------------------
  // Load messages
  // -------------------------------
  useEffect(() => {
    if (!activeThread) return;

    fetchMessages(activeThread.id);

    socketRef.current.emit("join_thread", activeThread.id);

  }, [activeThread]);

  const fetchMessages = async (threadId) => {
    try {
      const res = await api.get(`/${threadId}`);
      setMessages(res.data);

      socketRef.current.emit("mark_read", { threadId });

    } catch (err) {
      console.error("Messages error:", err.response?.data || err.message);
    }
  };

  // -------------------------------
  // SOCKET EVENTS
  // -------------------------------
  useEffect(() => {
    if (!socketRef.current) return;

    const socket = socketRef.current;

    socket.on("message:new", (msg) => {
      if (msg.thread_id === activeThread?.id) {
        setMessages((prev) => [...prev, msg]);
      }

      fetchThreads();
    });

    socket.on("message:delivered", ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, status: "delivered" } : m
        )
      );
    });

    socket.on("message:read", ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, status: "read" } : m
        )
      );
    });

    return () => {
      socket.off("message:new");
      socket.off("message:delivered");
      socket.off("message:read");
    };
  }, [activeThread]);

  // -------------------------------
  // SEND MESSAGE
  // -------------------------------
  const sendMessage = async () => {
    if (!input.trim() || !activeThread) return;

    const tempId = Date.now().toString();

    const tempMsg = {
      id: tempId,
      thread_id: activeThread.id,
      sender_id: userId,
      message: input,
      status: "sent",
    };

    setMessages((prev) => [...prev, tempMsg]);
    setInput("");

    try {
      const res = await api.post("/send", {
        threadId: activeThread.id,
        message: input,
        clientMessageId: tempId,
      });

      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? res.data : m))
      );

    } catch (err) {
      console.error("Send error:", err.response?.data || err.message);
    }
  };

  // -------------------------------
  // AUTO SCROLL
  // -------------------------------
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // -------------------------------
  // UI
  // -------------------------------
  return (
    <div style={{ display: "flex", height: "100vh" }}>

      {/* Sidebar */}
      <div style={{ width: "30%", borderRight: "1px solid #ddd" }}>
        <h3 style={{ padding: 10 }}>Chats</h3>

        {threads.map((t) => (
          <div
            key={t.id}
            onClick={() => setActiveThread(t)}
            style={{
              padding: 10,
              cursor: "pointer",
              background:
                activeThread?.id === t.id ? "#f0f0f0" : "white",
            }}
          >
            <b>{t.other_user_name}</b>
            <p>{t.last_message}</p>
          </div>
        ))}
      </div>

      {/* Chat */}
      <div style={{ width: "70%", display: "flex", flexDirection: "column" }}>

        {activeThread ? (
          <>
            <div style={{ padding: 10, borderBottom: "1px solid #ddd" }}>
              <b>{activeThread.other_user_name}</b>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    textAlign:
                      msg.sender_id === userId ? "right" : "left",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      display: "inline-block",
                      padding: 10,
                      borderRadius: 10,
                      background:
                        msg.sender_id === userId ? "#DCF8C6" : "#eee",
                    }}
                  >
                    {msg.message}
                  </div>

                  <div style={{ fontSize: 12 }}>
                    {msg.status === "read"
                      ? "✓✓"
                      : msg.status === "delivered"
                      ? "✓✓"
                      : "✓"}
                  </div>
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>

            <div style={{ display: "flex", padding: 10 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                style={{ flex: 1, padding: 10 }}
                placeholder="Type a message..."
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          </>
        ) : (
          <div style={{ padding: 20 }}>Select a chat</div>
        )}
      </div>
    </div>
  );
}
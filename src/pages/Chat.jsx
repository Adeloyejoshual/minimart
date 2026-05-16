// src/pages/Chat.jsx

import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";

const API = "/api/messages";
const socket = io(import.meta.env.VITE_API_URL || "https://minimart-ivrm.onrender.com", {
  withCredentials: true,
});

export default function Chat() {
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef();

  const userId = localStorage.getItem("userId");

  // -------------------------------
  // Load threads
  // -------------------------------
  useEffect(() => {
    fetchThreads();
  }, []);

  const fetchThreads = async () => {
    const res = await axios.get(`${API}/threads`);
    setThreads(res.data);
  };

  // -------------------------------
  // Load messages when thread changes
  // -------------------------------
  useEffect(() => {
    if (!activeThread) return;

    fetchMessages(activeThread.id);

    socket.emit("join_thread", activeThread.id);

  }, [activeThread]);

  const fetchMessages = async (threadId) => {
    const res = await axios.get(`${API}/${threadId}`);
    setMessages(res.data);

    // mark as read
    socket.emit("mark_read", { threadId });
  };

  // -------------------------------
  // Socket listeners
  // -------------------------------
  useEffect(() => {
    socket.on("message:new", (msg) => {
      if (msg.thread_id === activeThread?.id) {
        setMessages((prev) => [...prev, msg]);
      }

      fetchThreads(); // update sidebar
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
  // Send message
  // -------------------------------
  const sendMessage = async () => {
    if (!input.trim()) return;

    const tempId = Date.now().toString();

    const tempMessage = {
      id: tempId,
      thread_id: activeThread.id,
      sender_id: userId,
      message: input,
      status: "sent",
    };

    setMessages((prev) => [...prev, tempMessage]);
    setInput("");

    try {
      const res = await axios.post(`${API}/send`, {
        threadId: activeThread.id,
        message: input,
        clientMessageId: tempId,
      });

      // replace temp message with real one
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? res.data : m))
      );

    } catch (err) {
      console.error(err);
    }
  };

  // -------------------------------
  // Auto scroll
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

      {/* Chat area */}
      <div style={{ width: "70%", display: "flex", flexDirection: "column" }}>
        
        {activeThread ? (
          <>
            {/* Header */}
            <div style={{ padding: 10, borderBottom: "1px solid #ddd" }}>
              <b>{activeThread.other_user_name}</b>
            </div>

            {/* Messages */}
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
                        msg.sender_id === userId
                          ? "#DCF8C6"
                          : "#eee",
                    }}
                  >
                    {msg.message}
                  </div>

                  <div style={{ fontSize: 12 }}>
                    {msg.status === "read"
                      ? "✓✓"
                      : msg.status === "delivered"
                      ? "✓✓ (delivered)"
                      : "✓"}
                  </div>
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
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
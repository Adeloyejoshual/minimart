// pages/Support.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import '../style/Profile.css';
import { FiSend } from "react-icons/fi";

const Support = () => {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Fetch messages from API
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("/api/support/messages", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessages(res.data);
      } catch (err) {
        console.error("Failed to fetch support messages", err);
      }
    };
    fetchMessages();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    const token = localStorage.getItem("token");
    setLoading(true);
    try {
      const res = await axios.post(
        "/api/support/send",
        { message: newMsg },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages([...messages, res.data]);
      setNewMsg("");
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-section p-6 max-w-3xl mx-auto flex flex-col h-screen">
      <h2 className="text-3xl font-bold mb-6">Live Support Chat</h2>

      <div className="support-chat flex-1 overflow-y-auto p-4 bg-white rounded-2xl shadow-xl mb-4">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-center mt-6">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`chat-message ${msg.sender === "user" ? "user" : "support"}`}
            >
              <p>{msg.text}</p>
              <span className="chat-time">{new Date(msg.date).toLocaleTimeString()}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef}></div>
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          placeholder="Type your message..."
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          className="flex-1 p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500 text-lg"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white p-4 rounded-2xl hover:bg-blue-600 transition-all flex items-center justify-center"
          disabled={loading}
        >
          <FiSend />
        </button>
      </form>
    </div>
  );
};

export default Support;
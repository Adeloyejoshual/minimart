// src/pages/Marketplace/ChatPage.jsx
import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useLocation } from "react-router-dom";

export default function MarketplaceChatPage() {
  const { isAuthenticated, loginWithRedirect, logout, user } = useAuth0();
  const location = useLocation();
  const product = location.state?.product || { title: "Unknown Product" };

  const [messages, setMessages] = useState([
    { id: 1, sender: "seller", text: "Welcome! How can I help you?" },
  ]);
  const [newMessage, setNewMessage] = useState("");

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    setMessages([...messages, { id: Date.now(), sender: "user", text: newMessage }]);
    setNewMessage("");
    // Simulate seller reply
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, sender: "seller", text: "Thanks for your message!" },
      ]);
    }, 800);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => window.history.back()}>
          ←
        </button>
        <h2 style={styles.headerTitle}>{product.title} Chat</h2>
        {isAuthenticated ? (
          <button
            style={styles.authBtn}
            onClick={() => logout({ returnTo: window.location.origin })}
          >
            Logout
          </button>
        ) : (
          <button style={styles.authBtn} onClick={() => loginWithRedirect()}>
            Login
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={styles.messagesContainer}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...styles.message,
              alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
              backgroundColor: msg.sender === "user" ? "#0D6EFD" : "#e0e0e0",
              color: msg.sender === "user" ? "#fff" : "#000",
            }}
          >
            {msg.text}
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={styles.inputContainer}>
        <input
          style={styles.input}
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button style={styles.sendBtn} onClick={sendMessage}>
          Send
        </button>
      </div>
    </div>
  );
}

// ===== Inline Styles =====
const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: "#f4f6fa",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    backgroundColor: "#0D6EFD",
    color: "#fff",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  backBtn: {
    background: "rgba(255,255,255,0.25)",
    border: "none",
    borderRadius: "50%",
    width: 36,
    height: 36,
    color: "#fff",
    fontSize: 18,
    cursor: "pointer",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  authBtn: {
    background: "rgba(255,255,255,0.25)",
    color: "#fff",
    padding: "6px 12px",
    borderRadius: 8,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
  },
  messagesContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: 12,
    overflowY: "auto",
    gap: 8,
  },
  message: {
    padding: "8px 12px",
    borderRadius: 12,
    maxWidth: "70%",
  },
  inputContainer: {
    display: "flex",
    padding: 12,
    gap: 8,
    borderTop: "1px solid #ccc",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid #ccc",
    fontSize: 14,
    outline: "none",
  },
  sendBtn: {
    padding: "8px 14px",
    borderRadius: 12,
    border: "none",
    backgroundColor: "#0D6EFD",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
};
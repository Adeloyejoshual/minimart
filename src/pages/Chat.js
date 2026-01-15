// src/pages/Chat.jsx
import { useState, useEffect, useRef } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, query, orderBy, onSnapshot } from "firebase/firestore";
import { useParams, useLocation } from "react-router-dom";

export default function Chat() {
  const { sellerId } = useParams();
  const location = useLocation();
  const chatBoxRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [productName, setProductName] = useState("");

  const userId = auth.currentUser.uid;

  // Get query params: product id and seller name
  const params = new URLSearchParams(location.search);
  const productId = params.get("product");
  const sellerNameParam = params.get("sellerName");
  const productNameParam = params.get("productName");

  if (sellerNameParam) setSellerName(decodeURIComponent(sellerNameParam));
  if (productNameParam) setProductName(decodeURIComponent(productNameParam));

  // Unique chatId for buyer + seller + product
  const chatId = `${userId}_${productId || "general"}_${sellerId}`;

  useEffect(() => {
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((doc) => doc.data()));
    });
    return () => unsub();
  }, [chatId]);

  useEffect(() => {
    // Scroll to bottom whenever messages update
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!text) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    await addDoc(messagesRef, {
      senderId: userId,
      receiverId: sellerId,
      text,
      timestamp: Date.now(),
    });
    setText("");
  };

  return (
    <div style={{ maxWidth: 600, margin: "20px auto", display: "flex", flexDirection: "column", height: "80vh" }}>
      {/* Chat Header */}
      <div
        style={{
          padding: "10px 15px",
          background: "#0D6EFD",
          color: "#fff",
          borderRadius: "8px 8px 0 0",
        }}
      >
        <h3 style={{ margin: 0 }}>{sellerName || "Seller"}</h3>
        {productName && <p style={{ margin: 0, fontSize: "0.9rem" }}>{productName}</p>}
      </div>

      {/* Chat Messages */}
      <div
        ref={chatBoxRef}
        style={{
          flex: 1,
          border: "1px solid #ccc",
          padding: 10,
          overflowY: "auto",
          background: "#f8f9fa",
        }}
      >
        {messages.map((msg, i) => (
          <div key={i} style={{ textAlign: msg.senderId === userId ? "right" : "left", marginBottom: 6 }}>
            <p
              style={{
                display: "inline-block",
                padding: "6px 12px",
                borderRadius: 16,
                background: msg.senderId === userId ? "#0D6EFD" : "#e5e5ea",
                color: msg.senderId === userId ? "#fff" : "#000",
                margin: 0,
                maxWidth: "80%",
                wordWrap: "break-word",
              }}
            >
              {msg.text}
            </p>
          </div>
        ))}
      </div>

      {/* Message Input */}
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1, padding: 10, borderRadius: 5, border: "1px solid #ccc" }}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          onClick={sendMessage}
          style={{
            padding: "10px 20px",
            background: "#0D6EFD",
            color: "#fff",
            border: "none",
            borderRadius: 5,
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
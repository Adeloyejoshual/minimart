import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, query, orderBy, onSnapshot } from "firebase/firestore";
import { useParams, useLocation } from "react-router-dom";

export default function Chat() {
  const { sellerId } = useParams();
  const location = useLocation();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sellerName, setSellerName] = useState("");
  const userId = auth.currentUser.uid;

  const params = new URLSearchParams(location.search);
  const productId = params.get("product");
  const nameFromQuery = params.get("sellerName");
  if (nameFromQuery) setSellerName(decodeURIComponent(nameFromQuery));

  const chatId = `${userId}_${productId || "general"}_${sellerId}`;

  useEffect(() => {
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((doc) => doc.data()));
    });
    return () => unsub();
  }, [chatId]);

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
    <div style={{ maxWidth: 600, margin: "20px auto", padding: 10 }}>
      <h2>Chat with {sellerName || "Seller"}</h2>

      <div
        style={{
          border: "1px solid #ccc",
          padding: 10,
          height: 300,
          overflowY: "auto",
          marginBottom: 10,
          borderRadius: 5,
        }}
      >
        {messages.map((msg, i) => (
          <div key={i} style={{ textAlign: msg.senderId === userId ? "right" : "left" }}>
            <p
              style={{
                display: "inline-block",
                padding: "6px 12px",
                borderRadius: 16,
                background: msg.senderId === userId ? "#0D6EFD" : "#e5e5ea",
                color: msg.senderId === userId ? "#fff" : "#000",
                margin: "4px 0",
                maxWidth: "80%",
                wordWrap: "break-word",
              }}
            >
              {msg.text}
            </p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1, padding: 8, borderRadius: 5, border: "1px solid #ccc" }}
        />
        <button
          onClick={sendMessage}
          style={{
            padding: "8px 16px",
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
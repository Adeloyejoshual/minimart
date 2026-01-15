import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { db, auth } from "../firebase";
import { collection, addDoc, query, orderBy, onSnapshot } from "firebase/firestore";

export default function Chat() {
  const { sellerId } = useParams();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get("productId");

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const userId = auth.currentUser.uid;

  const chatId = `${userId}_${productId}_${sellerId}`;

  useEffect(() => {
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(doc => doc.data()));
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
    <div style={{ maxWidth: "600px", margin: "20px auto" }}>
      <div style={{ maxHeight: "300px", overflowY: "scroll", border: "1px solid #ccc", padding: "10px", borderRadius: "5px" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ textAlign: msg.senderId === userId ? "right" : "left", marginBottom: 5 }}>
            <p style={{ display: "inline-block", padding: "8px 12px", borderRadius: "12px", background: msg.senderId === userId ? "#0d6efd" : "#e4e6eb", color: msg.senderId === userId ? "#fff" : "#000" }}>
              {msg.text}
            </p>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "10px", marginTop: 10 }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1, padding: "8px", borderRadius: "5px", border: "1px solid #ccc" }}
        />
        <button onClick={sendMessage} style={{ padding: "8px 16px", borderRadius: "5px", background: "#0d6efd", color: "#fff", border: "none" }}>
          Send
        </button>
      </div>
    </div>
  );
}
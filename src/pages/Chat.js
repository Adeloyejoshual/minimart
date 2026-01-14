import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, query, orderBy, onSnapshot } from "firebase/firestore";

export default function Chat({ productId, sellerId }) {
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
    <div style={{ border: "1px solid #ccc", padding: "10px", marginTop: "5px" }}>
      <div style={{ maxHeight: "150px", overflowY: "scroll" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ textAlign: msg.senderId === userId ? "right" : "left" }}>
            <p>{msg.text}</p>
          </div>
        ))}
      </div>
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Type a message" />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
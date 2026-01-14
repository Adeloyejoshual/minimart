import { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, addDoc, query, orderBy, onSnapshot } from "firebase/firestore";

export default function Chat({ chatId, userId, receiverId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q, snapshot => {
      setMessages(snapshot.docs.map(doc => doc.data()));
    });

    return () => unsubscribe();
  }, [chatId]);

  const sendMessage = async () => {
    if (!text) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    await addDoc(messagesRef, {
      senderId: userId,
      receiverId: receiverId,
      text: text,
      timestamp: Date.now()
    });
    setText("");
  };

  return (
    <div style={{ border: "1px solid #ccc", padding: "10px", width: "400px" }}>
      <div style={{ maxHeight: "300px", overflowY: "scroll" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ textAlign: msg.senderId === userId ? "right" : "left" }}>
            <p>{msg.text}</p>
          </div>
        ))}
      </div>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type a message..."
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
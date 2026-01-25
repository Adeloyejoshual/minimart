// /src/pages/MessagesPage.jsx
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db, auth } from "../firebase";

export default function MessagesPage() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const messagesRef = collection(db, "messages");
    const q = query(messagesRef, where("toUser", "==", uid), orderBy("timestamp", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>💬 Messages</h2>
      {messages.length === 0 ? (
        <p>No messages yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {messages.map(msg => (
            <li key={msg.id} style={{
              padding: 10,
              marginBottom: 8,
              border: msg.read ? "1px solid #ccc" : "2px solid #4da6ff",
              borderRadius: 8,
              backgroundColor: msg.read ? "#f8fafd" : "#e6f2ff"
            }}>
              <strong>From: {msg.fromUser}</strong>
              <p>{msg.text}</p>
              <small>{new Date(msg.timestamp?.toDate()).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
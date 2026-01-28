import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, updateDoc, doc } from "firebase/firestore";

export default function AdminNotifications({ role }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "adminNotifications"), where("role", "==", role));
    const unsub = onSnapshot(q, snap => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [role]);

  const markAsRead = async (id) => {
    await updateDoc(doc(db, "adminNotifications", id), { read: true });
  };

  return (
    <div>
      <h3>Notifications</h3>
      {notifications.map(n => (
        <div
          key={n.id}
          onClick={() => markAsRead(n.id)}
          style={{
            padding: 10,
            marginBottom: 8,
            background: n.read ? "#f1f1f1" : "#dff0ff",
            cursor: "pointer"
          }}
        >
          {n.message}
        </div>
      ))}
    </div>
  );
}
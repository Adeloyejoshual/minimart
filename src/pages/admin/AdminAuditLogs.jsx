import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "adminLogs"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, snap => {
      setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsub;
  }, []);

  return (
    <div>
      <h2>Admin Activity Logs</h2>
      {logs.map(log => (
        <div key={log.id} style={{ padding: 10, borderBottom: "1px solid #eee" }}>
          <strong>{log.adminEmail}</strong> ({log.role})  
          <br />
          {log.action} → {log.target}
        </div>
      ))}
    </div>
  );
}
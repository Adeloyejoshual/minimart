// src/pages/admin/FlaggedSellers.jsx
import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function FlaggedSellers() {
  const [sellers, setSellers] = useState([]);

  useEffect(() => {
    const loadFlagged = async () => {
      const q = query(collection(db, "sellers"), where("suspicious", "==", true));
      const snapshot = await getDocs(q);
      setSellers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    loadFlagged();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>Suspicious Sellers</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th>Seller ID</th>
            <th>Name</th>
            <th>Flag Reason</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sellers.map(s => (
            <tr key={s.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td>{s.id}</td>
              <td>{s.name}</td>
              <td>{s.flagReason}</td>
              <td style={{ color: "red", fontWeight: "bold" }}>{s.suspicious ? "Suspicious" : "Safe"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
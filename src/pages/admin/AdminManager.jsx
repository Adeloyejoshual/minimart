// src/pages/admin/AdminManager.jsx
import { useEffect, useState } from "react";
import { auth, db } from "../../firebase";
import { collection, getDocs } from "firebase/firestore";

export default function AdminManager() {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSellers = async () => {
      try {
        const snapshot = await getDocs(collection(db, "sellers"));
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSellers(data);
      } catch (err) {
        console.error("Error loading sellers:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSellers();
  }, []);

  if (loading) return <p style={{ padding: 20 }}>Loading sellers...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Manager Dashboard</h1>

      {sellers.length === 0 ? (
        <p>No sellers found.</p>
      ) : (
        <table border="1" cellPadding="10" style={{ marginTop: 20, width: "100%" }}>
          <thead>
            <tr>
              <th>Business Name</th>
              <th>Email</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sellers.map(seller => (
              <tr key={seller.id}>
                <td>{seller.businessName || "N/A"}</td>
                <td>{seller.email || "N/A"}</td>
                <td>{seller.status || "Pending"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
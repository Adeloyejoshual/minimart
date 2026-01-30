// src/pages/admin/AdminManager.jsx
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";

export default function AdminManager() {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadSellers = async () => {
      setLoading(true);
      setError("");

      try {
        const snapshot = await getDocs(collection(db, "sellers"));

        // Debug: log all fetched docs
        console.log("Sellers fetched from Firestore:", snapshot.docs.map(d => d.data()));

        if (snapshot.empty) {
          setSellers([]);
        } else {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            businessName: doc.data().businessName || "N/A",
            email: doc.data().email || "N/A",
            status: doc.data().status || "Pending",
          }));
          setSellers(data);
        }
      } catch (err) {
        console.error("Error loading sellers:", err);
        setError("Failed to load sellers. Check console for details.");
      } finally {
        setLoading(false);
      }
    };

    loadSellers();
  }, []);

  if (loading) return <p style={{ padding: 20 }}>Loading sellers...</p>;
  if (error) return <p style={{ padding: 20, color: "red" }}>{error}</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Manager Dashboard</h1>

      {sellers.length === 0 ? (
        <p>No sellers found.</p>
      ) : (
        <table border="1" cellPadding="10" style={{ marginTop: 20, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f0f0f0" }}>
              <th>Business Name</th>
              <th>Email</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sellers.map(seller => (
              <tr key={seller.id}>
                <td>{seller.businessName}</td>
                <td>{seller.email}</td>
                <td>{seller.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
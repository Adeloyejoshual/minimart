// src/pages/AdminPanel.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";

export default function AdminPanel() {
  const [kycList, setKycList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState(null);

  // --- Initialize Socket.IO ---
  useEffect(() => {
    const s = io(process.env.REACT_APP_API_URL || "http://localhost:3000");
    setSocket(s);

    return () => s.disconnect();
  }, []);

  // --- Load all KYC submissions ---
  const loadKyc = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/admin/kyc");
      setKycList(res.data);
    } catch (err) {
      console.error("Failed to load KYC submissions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKyc();
  }, []);

  // --- Handle Approval/Reject ---
  const updateKycStatus = async (userId, status) => {
    try {
      const res = await axios.put("/api/admin/kyc", { userId, status });
      setKycList(prev => prev.map(k => k.userId === userId ? res.data : k));

      // Emit real-time update to the user
      socket.emit("kycUpdatedAdmin", res.data);

      alert(`KYC ${status.toLowerCase()} successfully!`);
    } catch (err) {
      console.error("Failed to update KYC status:", err);
      alert("❌ Failed to update KYC status.");
    }
  };

  return (
    <div style={{ padding: 30, fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" }}>
      <h2>Admin Panel - KYC Management</h2>

      {loading ? (
        <p>Loading KYC submissions...</p>
      ) : kycList.length === 0 ? (
        <p>No KYC submissions found.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}>
          <thead>
            <tr style={{ background: "#f0f0f0" }}>
              <th style={{ padding: 8 }}>User ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Documents</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {kycList.map(k => (
              <tr key={k.userId} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: 8 }}>{k.userId}</td>
                <td>{k.name}</td>
                <td>{k.email}</td>
                <td style={{ color: k.kycStatus === "Approved" ? "#198754" : k.kycStatus === "Rejected" ? "#dc3545" : "#0d6efd" }}>
                  {k.kycStatus}
                </td>
                <td>
                  {k.kycFiles?.front && <a href={k.kycFiles.front} target="_blank" rel="noreferrer">Front</a>}{" "}
                  {k.kycFiles?.back && <a href={k.kycFiles.back} target="_blank" rel="noreferrer">Back</a>}{" "}
                  {k.kycFiles?.selfie && <a href={k.kycFiles.selfie} target="_blank" rel="noreferrer">Selfie</a>}
                </td>
                <td>
                  {k.kycStatus !== "Approved" && (
                    <>
                      <button
                        onClick={() => updateKycStatus(k.userId, "Approved")}
                        style={{ marginRight: 6, padding: 6, background: "#198754", color: "#fff", borderRadius: 4 }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updateKycStatus(k.userId, "Rejected")}
                        style={{ padding: 6, background: "#dc3545", color: "#fff", borderRadius: 4 }}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {k.kycStatus === "Approved" && <span>Locked</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
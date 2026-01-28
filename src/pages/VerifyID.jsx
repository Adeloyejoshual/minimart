// src/pages/VerifyID.jsx
import { useEffect, useState } from "react";
import { auth } from "../firebase";
import axios from "axios";
import { FaIdCard, FaCamera } from "react-icons/fa";
import { io } from "socket.io-client";

export default function VerifyID() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("Not Submitted");
  const [files, setFiles] = useState({ front: null, back: null, selfie: null });
  const [kycData, setKycData] = useState({});
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState(null);

  // --- Initialize Socket.IO ---
  useEffect(() => {
    const s = io(process.env.REACT_APP_API_URL || "http://localhost:3000");
    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  // --- Load Firebase user ---
  useEffect(() => {
    if (auth.currentUser) setUser(auth.currentUser);
  }, []);

  // --- Load KYC data ---
  const loadKyc = async () => {
    if (!user) return;
    try {
      const res = await axios.get(`/api/kyc?userId=${user.uid}`);
      if (res.data) {
        setKycData(res.data);
        setStatus(res.data.kycStatus || "Not Submitted");

        // Join user-specific socket room
        socket?.emit("joinRoom", user.uid);
      }
    } catch (err) {
      console.error("Failed to load KYC:", err);
    }
  };

  useEffect(() => {
    loadKyc();
  }, [user, socket]);

  // --- Listen for real-time updates ---
  useEffect(() => {
    if (!socket || !user) return;

    socket.on("kycUpdated", (updatedKyc) => {
      if (updatedKyc.userId === user.uid) {
        setKycData(updatedKyc);
        setStatus(updatedKyc.kycStatus);
      }
    });

    return () => {
      socket.off("kycUpdated");
    };
  }, [socket, user]);

  // --- Handle file selection ---
  const handleFile = (type, file) => {
    setFiles(prev => ({ ...prev, [type]: file }));
  };

  // --- Submit KYC ---
  const handleSubmit = async () => {
    if (!files.front && !files.back && !files.selfie) {
      return alert("Please upload at least one document.");
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("userId", user.uid);
    if (files.front) formData.append("front", files.front);
    if (files.back) formData.append("back", files.back);
    if (files.selfie) formData.append("selfie", files.selfie);

    try {
      const res = await axios.post("/api/kyc", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setStatus("Pending");
      setKycData(res.data);
      alert("✅ KYC submitted! Your documents are under review.");
    } catch (err) {
      console.error("KYC submission failed:", err);
      alert("❌ Upload failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // --- Locked status if approved ---
  const isLocked = status === "Approved";

  const statusColor =
    status === "Approved" ? "#198754" :
    status === "Rejected" ? "#dc3545" : "#0d6efd";

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f8", padding: 20 }}>
      <div style={{
        maxWidth: 500,
        margin: "30px auto",
        background: "#fff",
        borderRadius: 16,
        padding: 25,
        boxShadow: "0 6px 25px rgba(0,0,0,0.08)",
        fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif"
      }}>
        <h2 style={{ textAlign: "center", marginBottom: 12 }}>Identity Verification (KYC)</h2>

        {/* Firebase User Info */}
        {user && (
          <div style={{
            background: "#eef5ff",
            padding: 15,
            borderRadius: 12,
            marginBottom: 20,
            fontSize: 14
          }}>
            <p><strong>Name:</strong> {user.displayName || "Not provided"}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Status:</strong> <span style={{ color: statusColor, fontWeight: 600 }}>{status}</span></p>
          </div>
        )}

        {/* Uploaded Files */}
        {(kycData.kycFiles && (status === "Approved" || status === "Rejected")) && (
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: 14, marginBottom: 6 }}>Uploaded Documents:</h4>
            <ul>
              {kycData.kycFiles.front && <li><a href={kycData.kycFiles.front} target="_blank" rel="noreferrer">ID Front</a></li>}
              {kycData.kycFiles.back && <li><a href={kycData.kycFiles.back} target="_blank" rel="noreferrer">ID Back</a></li>}
              {kycData.kycFiles.selfie && <li><a href={kycData.kycFiles.selfie} target="_blank" rel="noreferrer">Selfie</a></li>}
            </ul>
          </div>
        )}

        {/* File Inputs */}
        {!isLocked && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label>
              <FaIdCard /> Upload ID Front
              <input type="file" accept="image/*" onChange={e => handleFile("front", e.target.files[0])} />
            </label>

            <label>
              <FaIdCard /> Upload ID Back
              <input type="file" accept="image/*" onChange={e => handleFile("back", e.target.files[0])} />
            </label>

            <label>
              <FaCamera /> Selfie Holding ID (optional)
              <input type="file" accept="image/*" onChange={e => handleFile("selfie", e.target.files[0])} />
            </label>

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 10,
                border: "none",
                background: "#4da6ff",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              {loading ? "Submitting..." : "Submit for Verification"}
            </button>
          </div>
        )}

        {/* Status Message */}
        {status === "Pending" && <p style={{ marginTop: 15, color: "#0d6efd" }}>Your documents are under review.</p>}
        {status === "Approved" && <p style={{ marginTop: 15, color: "#198754" }}>✅ You are fully verified. Your KYC is locked.</p>}
        {status === "Rejected" && <p style={{ marginTop: 15, color: "#dc3545" }}>❌ Verification failed. You can resubmit documents.</p>}
      </div>
    </div>
  );
}
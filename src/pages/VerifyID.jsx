import { useEffect, useState } from "react";
import { auth, db, storage } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import TopNav from "../components/TopNav";
import { FaIdCard, FaCamera } from "react-icons/fa";

export default function VerifyID() {
  const [userData, setUserData] = useState(null);
  const [status, setStatus] = useState("Not Submitted");
  const [files, setFiles] = useState({ front: null, back: null, selfie: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const uid = auth.currentUser.uid;
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);
        setStatus(data.kycStatus || "Not Submitted");
      }
    };
    loadUser();
  }, []);

  const handleFile = (type, file) => {
    setFiles(prev => ({ ...prev, [type]: file }));
  };

  const handleSubmit = async () => {
    if (!files.front && !files.back && !files.selfie) {
      alert("Please upload at least one document");
      return;
    }

    setLoading(true);
    const uid = auth.currentUser.uid;
    const uploadedUrls = {};

    try {
      for (const key of Object.keys(files)) {
        if (!files[key]) continue;
        const storageRef = ref(storage, `kyc/${uid}/${key}_${Date.now()}`);
        await uploadBytes(storageRef, files[key]);
        uploadedUrls[key] = await getDownloadURL(storageRef);
      }

      await setDoc(doc(db, "users", uid), {
        kycStatus: "Pending",
        kycFiles: uploadedUrls,
        kycSubmittedAt: serverTimestamp()
      }, { merge: true });

      setStatus("Pending");
      alert("KYC submitted successfully. Our team will review it.");
    } catch (err) {
      console.error(err);
      alert("Upload failed. Try again.");
    }

    setLoading(false);
  };

  const statusColor =
    status === "Approved" ? "#198754" :
    status === "Rejected" ? "#dc3545" : "#0d6efd";

  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh" }}>
      <TopNav />

      <div style={{
        maxWidth: 500,
        margin: "30px auto",
        background: "#fff",
        borderRadius: 16,
        padding: 25,
        boxShadow: "0 6px 25px rgba(0,0,0,0.08)",
        fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif"
      }}>
        <h2 style={{ textAlign: "center", marginBottom: 10 }}>Identity Verification</h2>

        {userData && (
          <div style={{
            background: "#eef5ff",
            padding: 15,
            borderRadius: 12,
            marginBottom: 20,
            fontSize: 14
          }}>
            <p><strong>Name:</strong> {userData.fullName || "Not provided"}</p>
            <p><strong>Email:</strong> {userData.email}</p>
            <p><strong>Location:</strong> {userData.state || "—"}, {userData.city || "—"}</p>
            <p><strong>Status:</strong> <span style={{ color: statusColor, fontWeight: 600 }}>{status}</span></p>
          </div>
        )}

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

        {status === "Pending" && <p style={{ marginTop: 15, color: "#0d6efd" }}>Your documents are under review.</p>}
        {status === "Approved" && <p style={{ marginTop: 15, color: "#198754" }}>✅ You are fully verified.</p>}
        {status === "Rejected" && <p style={{ marginTop: 15, color: "#dc3545" }}>❌ Verification failed. Please upload clearer documents.</p>}
      </div>
    </div>
  );
}
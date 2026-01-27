import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import TopNav from "../components/TopNav";
import { FaUserCircle } from "react-icons/fa";

export default function EditProfile() {
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    state: "",
    city: "",
    address: "",
    email: "",
  });

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      if (!auth.currentUser) return;
      const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (snap.exists()) {
        setFormData({ ...formData, ...snap.data(), email: auth.currentUser.email });
      } else {
        setFormData({ ...formData, email: auth.currentUser.email });
      }
    };
    loadUser();
  }, []);

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setLoading(true);
    try {
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        { ...formData, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Failed to save profile.");
    }
    setLoading(false);
    setShowConfirm(false);
  };

  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" }}>
      <TopNav />

      <div style={{ maxWidth: 450, margin: "30px auto", padding: 25, background: "#fff", borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <FaUserCircle size={64} color="#0D6EFD" />
          <h2>Edit Profile</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Inputs */}
          {["fullName","phone","state","city","address"].map(field => (
            <label key={field} style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
              {field.charAt(0).toUpperCase() + field.slice(1)}
              <input
                type="text"
                value={formData[field]}
                onChange={e => handleChange(field, e.target.value)}
                placeholder={`Enter ${field}`}
                style={{ marginTop: 4, padding: 10, borderRadius: 10, border: "1px solid #ced4da" }}
              />
            </label>
          ))}

          <label style={{ display: "flex", flexDirection: "column", fontSize: 14 }}>
            Email (read-only)
            <input type="email" value={formData.email} readOnly style={{ marginTop: 4, padding: 10, borderRadius: 10, border: "1px solid #ced4da", backgroundColor: "#e9ecef" }} />
          </label>

          {/* Save Button */}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={loading}
            style={{ marginTop: 15, padding: 12, borderRadius: 10, background: "#0D6EFD", color: "#fff", fontWeight: 600, fontSize: 16 }}
          >
            Save Changes
          </button>

          {saved && <p style={{ color: "#198754", textAlign: "center" }}>✅ Profile saved successfully!</p>}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000
        }}>
          <div style={{ background: "#fff", padding: 25, borderRadius: 16, width: 350 }}>
            <h3 style={{ marginBottom: 10 }}>Confirm Your Details</h3>
            <p style={{ fontSize: 14, color: "#495057" }}>Please ensure these match your official ID before saving:</p>
            <ul style={{ paddingLeft: 20, marginTop: 10 }}>
              {["fullName","phone","state","city","address"].map(f => (
                <li key={f} style={{ marginBottom: 4 }}>
                  <strong>{f.charAt(0).toUpperCase() + f.slice(1)}:</strong> {formData[f] || "Not Provided"}
                </li>
              ))}
            </ul>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <button onClick={() => setShowConfirm(false)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ced4da" }}>Cancel</button>
              <button onClick={handleSave} style={{ padding: "8px 12px", borderRadius: 8, background: "#0D6EFD", color: "#fff" }}>Confirm & Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
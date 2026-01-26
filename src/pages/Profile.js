import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import TopNav from "../components/TopNav";

export default function Profile() {
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const load = async () => {
      if (!auth.currentUser) return;
      const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
      setUserData(snap.data());
    };
    load();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f8" }}>
      {/* Top Navigation */}
      <TopNav />

      {/* Content respecting TopNav height */}
      <div style={{
        paddingTop: 70, // adjust to TopNav height (~60-70px)
        maxWidth: 500,
        margin: "0 auto",
        paddingLeft: 16,
        paddingRight: 16
      }}>
        <h3>{auth.currentUser?.email}</h3>
        <p>Role: {userData?.role || "N/A"}</p>
        <p>Verified: {userData?.verified ? "Yes" : "No"}</p>
        <button
          onClick={() => signOut(auth)}
          style={{
            marginTop: 20,
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            backgroundColor: "#0D6EFD",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 600
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
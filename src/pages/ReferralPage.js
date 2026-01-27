import { useState, useEffect } from "react";
import { auth } from "../firebase";
import axios from "axios"; // to talk to your MongoDB backend
import TopNav from "../components/TopNav";
import { referralConfig } from "../config/referral";

export default function ReferralPage() {
  const [user, setUser] = useState(null);
  const [friendEmail, setFriendEmail] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- Load current user ---
  useEffect(() => {
    if (auth.currentUser) setUser(auth.currentUser);
  }, []);

  // --- Load referral history ---
  const loadHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/referrals?userId=${user.uid}`);
      setHistory(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [user]);

  // --- Submit referral ---
  const submitReferral = async () => {
    if (!friendEmail) return alert("Enter a friend's email");
    try {
      setLoading(true);
      await axios.post("/api/referrals", {
        userId: user.uid,
        friendEmail,
        reward: referralConfig.bonusAmount
      });
      setFriendEmail("");
      loadHistory();
      alert(`Referral sent! You can earn ₦${referralConfig.bonusAmount} when they join.`);
    } catch (err) {
      console.error(err);
      alert("Error sending referral.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f8", paddingBottom: 50 }}>
      <TopNav />
      <div style={{ maxWidth: 500, margin: "20px auto", padding: "0 12px" }}>
        <h2 style={{ color: "#0D6EFD", fontSize: 18, marginBottom: 10 }}>🎁 Referral Program</h2>
        <p>{referralConfig.message}</p>

        {/* Referral Input */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            type="email"
            placeholder="Friend's email"
            value={friendEmail}
            onChange={e => setFriendEmail(e.target.value)}
            style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #cce0ff" }}
          />
          <button
            onClick={submitReferral}
            disabled={loading}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#0D6EFD",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Send
          </button>
        </div>

        {/* Coupon / Bonus Info */}
        <div style={{
          marginTop: 20,
          padding: 12,
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
        }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Your Referral Bonuses</h3>
          <p style={{ marginTop: 6, fontSize: 14 }}>
            Total Bonus Earned: <strong>₦{history.reduce((acc, h) => acc + h.reward, 0)}</strong>
          </p>
        </div>

        {/* Scrollable history */}
        <div style={{
          marginTop: 20,
          maxHeight: 300,
          overflowY: "auto",
          padding: 8,
          background: "#e9ecef",
          borderRadius: 12
        }}>
          {loading ? (
            <p>Loading...</p>
          ) : history.length ? (
            history.map(h => (
              <div key={h._id} style={{
                padding: 8,
                marginBottom: 6,
                background: "#fff",
                borderRadius: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14 }}>{h.friendEmail}</p>
                  <small style={{ color: "#6c757d" }}>{new Date(h.createdAt).toLocaleDateString()}</small>
                </div>
                <span style={{ fontWeight: 600, color: "#198754" }}>₦{h.reward}</span>
              </div>
            ))
          ) : (
            <p>No referrals yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
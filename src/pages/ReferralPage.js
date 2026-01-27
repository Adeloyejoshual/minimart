// src/pages/ReferralPage.jsx
import { useState, useEffect } from "react";
import { auth } from "../firebase";
import axios from "axios";
import TopNav from "../components/TopNav";
import { FaGift } from "react-icons/fa";

export default function ReferralPage() {
  const [user, setUser] = useState(null);
  const [friendEmail, setFriendEmail] = useState("");
  const [history, setHistory] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load current user
  useEffect(() => {
    if (auth.currentUser) setUser(auth.currentUser);
  }, []);

  // Fetch referral history
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

  // Fetch user coupons
  const loadCoupons = async () => {
    if (!user) return;
    try {
      const res = await axios.get(`/api/coupons?userId=${user.uid}`);
      setCoupons(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) {
      loadHistory();
      loadCoupons();
    }
  }, [user]);

  // Submit referral
  const submitReferral = async () => {
    if (!friendEmail) return alert("Enter your friend's email");
    try {
      setLoading(true);
      const res = await axios.post("/api/referrals", {
        userId: user.uid,
        friendEmail,
        reward: 500, // referral reward
      });
      setFriendEmail("");
      loadHistory();
      loadCoupons();
      alert(`Referral sent! You earned ₦500. Check your coupons!`);
    } catch (err) {
      console.error(err);
      alert("Error sending referral.");
    } finally {
      setLoading(false);
    }
  };

  const totalBonus = coupons.reduce((acc, c) => acc + c.value, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f8", paddingBottom: 50 }}>
      <TopNav />

      <div style={{ maxWidth: 500, margin: "20px auto", padding: "0 12px" }}>
        <h2 style={{ color: "#0D6EFD", fontSize: 18, marginBottom: 8 }}>🎁 Referral Program</h2>
        <p style={{ fontSize: 14, color: "#212529" }}>
          Invite friends and earn ₦500 per successful referral. Rewards are added to your coupon balance.
        </p>

        {/* Referral Input */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            type="email"
            placeholder="Friend's email"
            value={friendEmail}
            onChange={e => setFriendEmail(e.target.value)}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #cce0ff",
              fontSize: 14,
            }}
          />
          <button
            onClick={submitReferral}
            disabled={loading}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: "#0D6EFD",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Send
          </button>
        </div>

        {/* Total Coupon Balance */}
        <div style={{
          marginTop: 20,
          padding: 14,
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FaGift size={20} color="#ffc107" />
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>Coupon Balance</p>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: "#198754" }}>₦{totalBonus}</span>
        </div>

        {/* User Coupons */}
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          {coupons.length ? coupons.map(c => (
            <div key={c._id} style={{
              padding: 12,
              background: "#fff",
              borderRadius: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FaGift color="#ffc107" />
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{c.label}</p>
                  <small style={{ color: "#6c757d" }}>
                    Exp: {new Date(c.expiry).toLocaleDateString()}
                  </small>
                </div>
              </div>
              <span style={{ fontWeight: 600, color: "#198754" }}>₦{c.value}</span>
            </div>
          )) : (
            <p>No coupons yet. Invite friends to earn!</p>
          )}
        </div>

        {/* Referral History */}
        <div style={{
          marginTop: 30,
          maxHeight: 250,
          overflowY: "auto",
          padding: 8,
          background: "#e9ecef",
          borderRadius: 12
        }}>
          <h3 style={{ marginTop: 0, fontSize: 16 }}>Your Referrals</h3>
          {loading ? (
            <p>Loading...</p>
          ) : history.length ? history.map(h => (
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
                <small style={{ color: "#6c757d" }}>
                  {new Date(h.createdAt).toLocaleDateString()}
                </small>
              </div>
              <span style={{ fontWeight: 600, color: "#198754" }}>₦{h.reward}</span>
            </div>
          )) : (
            <p>No referrals yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
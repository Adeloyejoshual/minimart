// src/pages/SpinWheelPage.jsx
import { useState, useEffect } from "react";
import { auth } from "../firebase";
import axios from "axios";
import { spinRewards } from "../config/spinRewards";
import TopNav from "../components/TopNav";
import { FaGift } from "react-icons/fa";

export default function SpinWheelPage() {
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [lastReward, setLastReward] = useState(null);

  // Load user
  useEffect(() => {
    if (auth.currentUser) setUser(auth.currentUser);
  }, []);

  // Load spin history
  const loadHistory = async () => {
    if (!user) return;
    try {
      const res = await axios.get(`/api/spin?userId=${user.uid}`);
      setHistory(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) loadHistory();
  }, [user]);

  // Handle spin
  const spinWheel = async () => {
    if (!user || spinning) return;
    setSpinning(true);

    // Randomly pick reward
    const reward = spinRewards[Math.floor(Math.random() * spinRewards.length)];

    try {
      // Save spin result to MongoDB
      await axios.post("/api/spin", {
        userId: user.uid,
        rewardLabel: reward.label,
        rewardType: reward.type,
        rewardValue: reward.value,
      });

      setLastReward(reward);
      loadHistory(); // refresh history

      alert(`🎉 Congrats! You won: ${reward.label}`);
    } catch (err) {
      console.error(err);
      alert("Error recording spin.");
    } finally {
      setSpinning(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f8", paddingBottom: 50 }}>
      <TopNav />
      <div style={{ maxWidth: 500, margin: "20px auto", padding: "0 12px" }}>
        <h2 style={{ color: "#0D6EFD", fontSize: 18 }}>🎡 Spin Wheel Rewards</h2>
        <p>Spin the wheel and get exciting rewards! All rewards are added to your coupon balance.</p>

        {/* Spin Button */}
        <button
          onClick={spinWheel}
          disabled={spinning}
          style={{
            marginTop: 20,
            width: "100%",
            padding: 16,
            borderRadius: 12,
            border: "none",
            background: "#ffc107",
            fontWeight: 700,
            fontSize: 16,
            cursor: spinning ? "not-allowed" : "pointer",
            color: "#212529",
          }}
        >
          {spinning ? "Spinning..." : "Spin Now!"}
        </button>

        {/* Last Reward */}
        {lastReward && (
          <div style={{
            marginTop: 20,
            padding: 12,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            display: "flex",
            alignItems: "center",
            gap: 10
          }}>
            <FaGift color="#ffc107" size={24} />
            <p style={{ margin: 0, fontWeight: 600 }}>{lastReward.label}</p>
          </div>
        )}

        {/* Scrollable History */}
        <div style={{
          marginTop: 30,
          maxHeight: 300,
          overflowY: "auto",
          padding: 8,
          background: "#e9ecef",
          borderRadius: 12
        }}>
          <h3 style={{ fontSize: 16, marginTop: 0 }}>Your Spin History</h3>
          {history.length ? history.map(h => (
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
              <p style={{ margin: 0 }}>{h.rewardLabel}</p>
              <small style={{ color: "#6c757d" }}>{new Date(h.createdAt).toLocaleDateString()}</small>
            </div>
          )) : <p>No spins yet. Try your luck!</p>}
        </div>
      </div>
    </div>
  );
}
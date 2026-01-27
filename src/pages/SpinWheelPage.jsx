// src/pages/SpinWheelPage.jsx
import { useState, useEffect } from "react";
import { auth } from "../firebase";
import axios from "axios";
import TopNav from "../components/TopNav";
import { spinRewards } from "../config/spinRewards";

export default function SpinWheelPage() {
  const [user, setUser] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- Load current user ---
  useEffect(() => {
    if (auth.currentUser) setUser(auth.currentUser);
  }, []);

  // --- Load spin history ---
  const loadHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/spins?userId=${user.uid}`);
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

  // --- Handle spin ---
  const spinWheel = async () => {
    if (spinning) return;
    setSpinning(true);

    // Pick random reward
    const reward = spinRewards[Math.floor(Math.random() * spinRewards.length)];

    // Simulate spin animation delay
    setTimeout(async () => {
      setResult(reward);

      try {
        // Save spin to MongoDB
        await axios.post("/api/spins", {
          userId: user.uid,
          rewardId: reward.id,
          label: reward.label,
          type: reward.type,
          value: reward.value,
          createdAt: new Date(),
        });

        // Reload history
        loadHistory();

        alert(`🎉 Congrats ${user.displayName || user.email}! You won ${reward.label}`);
      } catch (err) {
        console.error(err);
        alert("Error saving spin.");
      } finally {
        setSpinning(false);
      }
    }, 2000);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f8", paddingBottom: 50 }}>
      <TopNav />
      <div style={{ maxWidth: 500, margin: "20px auto", padding: "0 12px", textAlign: "center" }}>
        <h2 style={{ color: "#0D6EFD" }}>🎡 Spin the Wheel</h2>
        <p>Try your luck and win rewards! Your prizes will be added to your coupon balance.</p>

        {/* Spin Button */}
        <button
          onClick={spinWheel}
          disabled={spinning || !user}
          style={{
            marginTop: 20,
            padding: "12px 20px",
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 12,
            border: "none",
            background: "#0D6EFD",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          {spinning ? "Spinning..." : "Spin Now"}
        </button>

        {/* Last Spin Result */}
        {result && (
          <div style={{ marginTop: 20, padding: 12, background: "#fff", borderRadius: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>🎉 Last Spin Result</h3>
            <p style={{ marginTop: 8, fontWeight: 600, color: "#198754" }}>
              {result.label}
            </p>
          </div>
        )}

        {/* Spin History */}
        <div style={{
          marginTop: 20,
          maxHeight: 300,
          overflowY: "auto",
          padding: 8,
          background: "#e9ecef",
          borderRadius: 12
        }}>
          <h4>Spin History</h4>
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
                  <p style={{ margin: 0 }}>{h.label}</p>
                  <small style={{ color: "#6c757d" }}>{new Date(h.createdAt).toLocaleDateString()}</small>
                </div>
                <span style={{ fontWeight: 600, color: "#198754" }}>
                  {h.type === "money" ? `₦${h.value}` : h.type === "percentage" ? `${h.value}%` : `${h.value}x`}
                </span>
              </div>
            ))
          ) : (
            <p>No spins yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
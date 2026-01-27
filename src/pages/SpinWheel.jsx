import { useState, useEffect } from "react";
import axios from "axios";
import { coupons } from "../config/coupons";

export default function SpinWheel({ userId }) {
  const [history, setHistory] = useState([]);
  const [lastWin, setLastWin] = useState(null);
  const [spinning, setSpinning] = useState(false);

  const spin = async () => {
    if (spinning) return;
    setSpinning(true);
    // simulate spin delay
    setTimeout(async () => {
      const res = await axios.post("http://localhost:5000/api/spin", { userId });
      setLastWin(res.data.coupon);
      loadHistory();
      setSpinning(false);
    }, 2000);
  };

  const loadHistory = async () => {
    const res = await axios.get(`http://localhost:5000/api/coupons/${userId}`);
    setHistory(res.data);
  };

  useEffect(() => { loadHistory(); }, []);

  const activeCoupons = history.filter(c => c.status === "active");

  return (
    <div style={{ maxWidth: 500, margin: "0 auto", padding: 20 }}>
      <h2>Spin Wheel 🎁</h2>
      <button 
        onClick={spin} 
        disabled={spinning} 
        style={{ padding: "10px 20px", borderRadius: 8, background: "#0d6efd", color: "#fff", fontWeight: "bold", cursor: "pointer" }}
      >
        {spinning ? "Spinning..." : "Spin to Win!"}
      </button>

      {lastWin && (
        <div style={{ marginTop: 20, padding: 10, background: "#e0ecff", borderRadius: 8 }}>
          <strong>Congratulations!</strong> You won {lastWin.label}
        </div>
      )}

      <h3 style={{ marginTop: 30 }}>Your Coupons 💳</h3>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "10px 0" }}>
        {activeCoupons.length ? activeCoupons.map(c => (
          <div key={c._id} style={{ padding: 10, background: "#fff3cd", borderRadius: 8, minWidth: 120 }}>
            <div>{c.label}</div>
            <div style={{ fontSize: 12, color: "#6c757d" }}>
              Exp: {new Date(c.expiry).toLocaleDateString()}
            </div>
          </div>
        )) : <div>No active coupons</div>}
      </div>

      <h3 style={{ marginTop: 30 }}>History 🕒</h3>
      <div style={{ maxHeight: 200, overflowY: "auto", borderTop: "1px solid #dee2e6", paddingTop: 10 }}>
        {history.length ? history.map(c => (
          <div key={c._id} style={{ padding: 8, borderBottom: "1px solid #dee2e6" }}>
            {c.label} — {c.status} — {new Date(c.createdAt).toLocaleDateString()}
          </div>
        )) : <div>No history</div>}
      </div>
    </div>
  );
}
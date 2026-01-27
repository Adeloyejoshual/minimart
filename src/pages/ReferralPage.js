import { useEffect, useState } from "react";
import axios from "axios";
import { referralConfig } from "../config/referral.js";
import TopNav from "../components/TopNav";

export default function ReferralPage({ userId }) {
  const [friendEmail, setFriendEmail] = useState("");
  const [bonuses, setBonuses] = useState([]);
  const [message, setMessage] = useState("");

  const submitReferral = async () => {
    try {
      const res = await axios.post("http://localhost:5000/api/referral", { userId, friendEmail });
      setMessage(res.data.message);
      setFriendEmail("");
      loadBonuses();
    } catch (err) {
      setMessage(err.response?.data?.message || "Error");
    }
  };

  const loadBonuses = async () => {
    const res = await axios.get(`http://localhost:5000/api/referral/${userId}`);
    setBonuses(res.data);
  };

  useEffect(() => { loadBonuses(); }, []);

  return (
    <div style={{ maxWidth: 500, margin: "0 auto", padding: 20 }}>
      <TopNav />
      <h2>Referral Program 🎁</h2>
      <p>{referralConfig.message}</p>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          type="email"
          placeholder="Friend's email"
          value={friendEmail}
          onChange={e => setFriendEmail(e.target.value)}
          style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #dee2e6" }}
        />
        <button
          onClick={submitReferral}
          style={{ padding: "8px 12px", borderRadius: 6, background: "#0d6efd", color: "#fff", fontWeight: "bold" }}
        >
          Invite
        </button>
      </div>

      {message && <p style={{ marginTop: 8, color: "#198754" }}>{message}</p>}

      <h3 style={{ marginTop: 30 }}>Your Referrals</h3>
      <div style={{ maxHeight: 250, overflowY: "auto", borderTop: "1px solid #dee2e6", paddingTop: 10 }}>
        {bonuses.length ? bonuses.map(b => (
          <div key={b._id} style={{ padding: 8, borderBottom: "1px solid #dee2e6", display: "flex", justifyContent: "space-between" }}>
            <span>{b.friendEmail}</span>
            <span>{b.reward} ₦ — {b.status}</span>
          </div>
        )) : <div>No referrals yet.</div>}
      </div>
    </div>
  );
}
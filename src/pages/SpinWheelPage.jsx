// src/pages/SpinWheelPage.jsx
import { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs } from "firebase/firestore";
import { coupons as spinCoupons } from "../config/coupons";
import confetti from "canvas-confetti";
import { FaGift } from "react-icons/fa";

export default function SpinWheelPage() {
  const [result, setResult] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [userCoupons, setUserCoupons] = useState([]);
  const [lastSpin, setLastSpin] = useState(null);
  const [referralBonus, setReferralBonus] = useState(0);

  const wheelRef = useRef(null);
  const userName = auth.currentUser.displayName || auth.currentUser.email.split("@")[0];

  // Load user's coupons & referral bonus
  const loadUserData = async () => {
    const snap = await getDocs(query(
      collection(db, "users", auth.currentUser.uid, "coupons"),
      orderBy("createdAt", "desc")
    ));
    const couponsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setUserCoupons(couponsList);

    // Referral bonus (sum)
    const referralSnap = await getDocs(collection(db, "users", auth.currentUser.uid, "referrals"));
    const bonus = referralSnap.docs.reduce((acc, doc) => acc + (doc.data().bonus || 0), 0);
    setReferralBonus(bonus);

    // Last spin
    if (couponsList.length > 0) {
      const last = couponsList.reduce((prev, curr) => prev.createdAt?.toMillis() > curr.createdAt?.toMillis() ? prev : curr);
      setLastSpin(last?.createdAt?.toDate());
    }
  };

  useEffect(() => { loadUserData(); }, []);

  const canSpin = () => {
    if (!lastSpin) return true;
    const now = new Date();
    const diff = now - lastSpin; // ms
    return diff > 24 * 60 * 60 * 1000; // 24h cooldown
  };

  const spin = async () => {
    if (spinning) return;
    if (!canSpin()) { alert("You can only spin once every 24 hours."); return; }

    setSpinning(true);
    const reward = spinCoupons[Math.floor(Math.random() * spinCoupons.length)];
    const degrees = Math.floor(Math.random() * 360) + 720;

    if (wheelRef.current) {
      wheelRef.current.style.transition = "transform 3s ease-out";
      wheelRef.current.style.transform = `rotate(${degrees}deg)`;
    }

    setTimeout(async () => {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
      setResult(reward);

      // Save reward to user
      await addDoc(collection(db, "users", auth.currentUser.uid, "coupons"), {
        ...reward,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      // Save recent winner
      await addDoc(collection(db, "recentWins"), {
        name: userName,
        reward: reward.label,
        createdAt: serverTimestamp()
      });

      // Reload
      loadUserData();

      setSpinning(false);
      if (wheelRef.current) wheelRef.current.style.transition = "none";
    }, 3000);
  };

  const getCardStyle = (type) => {
    switch (type) {
      case "money": return { background: "linear-gradient(135deg, #00c6ff, #0072ff)", color: "#fff" };
      case "freeDelivery": return { background: "linear-gradient(135deg, #ffecb3, #ffc107)", color: "#212121" };
      case "percentage": return { background: "linear-gradient(135deg, #c8e6c9, #66bb6a)", color: "#212121" };
      case "repeat": return { background: "linear-gradient(135deg, #e1bee7, #ba68c8)", color: "#fff" };
      default: return { background: "#f0f0f0", color: "#212121" };
    }
  };

  const totalCoupons = userCoupons.reduce((acc, c) => acc + (c.value || 0), 0);

  return (
    <div style={{ textAlign: "center", padding: 20, fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" }}>
      <h2>🎡 Spin & Win</h2>
      <p>Welcome, <b>{userName}</b>! Try your luck and win amazing rewards.</p>

      {/* Coupon Balance */}
      <div style={{ margin: "20px 0", fontWeight: "bold", fontSize: 16 }}>
        💳 Total Coupon Value: ₦{totalCoupons.toLocaleString()} | Referral Bonus: ₦{referralBonus.toLocaleString()}
      </div>

      {/* User Coupons */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, marginBottom: 20 }}>
        {userCoupons.length ? userCoupons.map(c => (
          <div key={c.id} style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            padding: "14px 18px",
            borderRadius: 16,
            boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
            minWidth: 140,
            position: "relative",
            ...getCardStyle(c.type),
            transition: "transform 0.2s",
          }}
            title={`Expires: ${c.expiresAt?.toDate ? c.expiresAt.toDate().toLocaleDateString() : ""}`}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-4px) scale(1.05)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0) scale(1)"}
          >
            <FaGift size={28} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>{c.label}</span>
            {c.expiresAt && (
              <span style={{
                fontSize: 10,
                background: "#ff5252",
                color: "#fff",
                padding: "2px 6px",
                borderRadius: 8,
                position: "absolute",
                top: 6,
                right: 6
              }}>
                Exp: {c.expiresAt.toDate().toLocaleDateString()}
              </span>
            )}
          </div>
        )) : <div style={{ color: "#6c757d", fontSize: 14 }}>No coupons yet. Spin to win!</div>}
      </div>

      {/* Wheel */}
      <div
        ref={wheelRef}
        style={{
          margin: "20px auto",
          width: 280,
          height: 280,
          borderRadius: "50%",
          border: "10px solid #0d6efd",
          position: "relative",
          background: "conic-gradient(#ffc107 0% 20%, #0d6efd 20% 40%, #28a745 40% 60%, #dc3545 60% 80%, #20c997 80% 100%)",
          transition: "transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)"
        }}
      >
        <div style={{
          width: 0,
          height: 0,
          borderLeft: "14px solid transparent",
          borderRight: "14px solid transparent",
          borderBottom: "24px solid #000",
          position: "absolute",
          top: -24,
          left: "50%",
          transform: "translateX(-50%)"
        }} />
      </div>

      <button
        onClick={spin}
        disabled={spinning || !canSpin()}
        style={{
          marginTop: 20,
          padding: "14px 28px",
          fontSize: 16,
          fontWeight: 600,
          color: "#fff",
          background: "#0d6efd",
          border: "none",
          borderRadius: 10,
          cursor: spinning || !canSpin() ? "not-allowed" : "pointer",
          transition: "transform 0.2s",
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
      >
        {spinning ? "Spinning..." : canSpin() ? "Spin Now" : "Come back tomorrow!"}
      </button>

      {/* Result */}
      {result && (
        <div style={{
          marginTop: 30,
          maxWidth: 360,
          marginLeft: "auto",
          marginRight: "auto",
          padding: 22,
          borderRadius: 18,
          background: "#fff3e0",
          fontWeight: "bold",
          color: "#ef6c00",
          fontSize: 16,
          boxShadow: "0 6px 20px rgba(0,0,0,0.15)"
        }}>
          🎉 Congratulations <b>{userName}</b>!<br />
          You won: <span style={{ color: "#0d6efd" }}>{result.label}</span>
        </div>
      )}
    </div>
  );
}
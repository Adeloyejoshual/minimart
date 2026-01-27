import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { coupons } from "../config/coupons";
import { FaGift } from "react-icons/fa";

export default function SpinWheel() {
  const [userCoupon, setUserCoupon] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const loadCoupon = async () => {
      if (!auth.currentUser) return;
      const snap = await getDoc(doc(db, "users", auth.currentUser.uid, "coupons", "main"));
      if (snap.exists()) setUserCoupon(snap.data());
    };
    loadCoupon();
  }, []);

  const spin = async () => {
    if (spinning) return;
    setSpinning(true);

    // Pick random coupon
    const reward = coupons[Math.floor(Math.random() * coupons.length)];
    
    const expires = reward.expiresInDays
      ? new Date(Date.now() + reward.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const couponData = {
      ...reward,
      obtainedAt: serverTimestamp(),
      expires: expires ? expires : null,
    };

    // Save to Firestore
    await setDoc(doc(db, "users", auth.currentUser.uid, "coupons", "main"), couponData);

    setResult(couponData);
    setUserCoupon(couponData);

    // Stop spinning animation after a bit
    setTimeout(() => setSpinning(false), 2000);
  };

  return (
    <div style={{ maxWidth: 420, margin: "20px auto", textAlign: "center" }}>
      <h2>🎁 Spin to Win Coupons</h2>

      <div style={{ margin: "20px 0" }}>
        <button
          onClick={spin}
          disabled={spinning}
          style={{
            padding: "16px 24px",
            fontSize: 18,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            background: spinning ? "#dee2e6" : "#0d6efd",
            color: "#fff",
            width: 120,
            height: 120,
            boxShadow: spinning ? "0 2px 6px rgba(0,0,0,0.05)" : "0 6px 12px rgba(0,0,0,0.1)",
            transition: "all 0.3s ease",
          }}
        >
          {spinning ? "🎡" : "SPIN"}
        </button>
      </div>

      {result && (
        <div style={{
          marginTop: 20,
          padding: 16,
          borderRadius: 12,
          background: "#fff",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}>
          <div style={{ fontSize: 30 }}>{result.icon}</div>
          <h3 style={{ margin: 6 }}>{result.label}</h3>
          {result.expires && (
            <p style={{ fontSize: 12, color: "#6c757d" }}>
              Expires: {new Date(result.expires.seconds * 1000).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {userCoupon && !result && (
        <div style={{
          marginTop: 20,
          padding: 12,
          borderRadius: 12,
          background: "#fff",
          boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
        }}>
          <h4>Your Current Coupon</h4>
          <p style={{ margin: "4px 0" }}>{userCoupon.label} {userCoupon.expires && `(Expires: ${new Date(userCoupon.expires.seconds * 1000).toLocaleDateString()})`}</p>
        </div>
      )}
    </div>
  );
}
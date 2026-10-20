// src/components/SpinWheelWidget.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;

const getAuthToken = () => {
  const keys = [
    "token", "authToken", "accessToken", "access_token",
    "jwt", "jwtToken", "userToken", "loemart_token",
  ];
  for (const k of keys) {
    const v = localStorage.getItem(k) || sessionStorage.getItem(k);
    if (v) return v;
  }
  return null;
};

export default function SpinWheelWidget({ user }) {
  const navigate = useNavigate();
  const [spinStatus, setSpinStatus] = useState(null);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [result, setResult] = useState(null);
  const [wheelRotation, setWheelRotation] = useState(0);

  // 1. Retrieve or generate Guest Session ID for unregistered visitors
  const getGuestId = () => {
    let id = localStorage.getItem("spin_guest_id");
    if (!id) {
      id = "guest_" + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("spin_guest_id", id);
    }
    return id;
  };

  // 2. Fetch Wheel Config & User/Guest Spin Status
  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const guestId = !token ? getGuestId() : "";
      
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const url = token
        ? `${BASE_URL}/api/spinwheel/config`
        : `${BASE_URL}/api/spinwheel/config?guest_session_id=${guestId}`;

      const res = await fetch(url, { headers });
      const data = await res.json();

      if (data.segments) setSegments(data.segments);
      if (data.spin_status) setSpinStatus(data.spin_status);
    } catch (err) {
      console.error("[SpinWheelWidget] Config error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [user, fetchConfig]);

  // 3. Execute Spin Request
  const handleSpin = async () => {
    if (isSpinning || !spinStatus?.can_spin) return;
    setIsSpinning(true);
    setResult(null);

    try {
      const token = getAuthToken();
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const body = token
        ? {}
        : { guest_session_id: getGuestId() };

      const res = await fetch(`${BASE_URL}/api/spinwheel/spin`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to spin");

      // Calculate target angle to land on winning segment
      const winningIndex = segments.findIndex(s => s.id === data.segment_id);
      const segmentAngle = 360 / (segments.length || 8);
      const targetDegree = 360 * 5 + (360 - winningIndex * segmentAngle - segmentAngle / 2);

      setWheelRotation(targetDegree);

      // Wait for spin animation to complete (3 seconds)
      setTimeout(() => {
        setResult(data.result);
        setIsSpinning(false);
        if (data.spin_status) setSpinStatus(data.spin_status);
      }, 3200);

    } catch (err) {
      alert(err.message);
      setIsSpinning(false);
    }
  };

  const handleGuestClaim = () => {
    navigate("/login?redirect=/&claim_spin=true");
  };

  if (loading || !spinStatus) return null;

  const totalSpinsAvailable = (spinStatus.free_spins_remaining || 0) + (spinStatus.bonus_spins_remaining || 0);

  return (
    <>
      {/* ══ FLOATING BADGE / BUTTON ══ */}
      <button
        onClick={() => setShowModal(true)}
        style={styles.floatingBtn}
        aria-label="Open Spin & Win"
      >
        <span style={styles.floatingIcon}>🎡</span>
        <div style={styles.floatingText}>
          <span style={{ fontSize: "11px", fontWeight: "bold" }}>
            {user ? "Daily Spin Ready!" : "Free Spin!"}
          </span>
          <span style={{ fontSize: "9px", opacity: 0.9 }}>
            {user 
              ? `${totalSpinsAvailable} spin${totalSpinsAvailable !== 1 ? "s" : ""} left` 
              : "Win up to ₦1,000"}
          </span>
        </div>
        {spinStatus.can_spin && <span style={styles.pulseDot} />}
      </button>

      {/* ══ MODAL ══ */}
      {showModal && (
        <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div style={styles.modal}>
            <button onClick={() => setShowModal(false)} style={styles.closeBtn}>✕</button>

            {/* ── HEADER ── */}
            {!result ? (
              <>
                <h2 style={styles.title}>
                  {user ? "Welcome back! Your daily spin is ready." : "Guest Spin & Win 🎡"}
                </h2>
                <p style={styles.subtitle}>
                  {user 
                    ? "Spin, earn bonus chances, and climb the Loemart rewards leaderboard." 
                    : "You have 1 free guest spin. Spin to win instant discounts!"}
                </p>

                {/* ── SPINS COUNTER BADGE ── */}
                {user && (
                  <div style={styles.counterBadge}>
                    <span>🎟️ Free Spins: <strong>{spinStatus.free_spins_remaining}</strong></span>
                    {spinStatus.bonus_spins_remaining > 0 && (
                      <span>⚡ Bonus Spins: <strong>{spinStatus.bonus_spins_remaining}</strong></span>
                    )}
                  </div>
                )}

                {/* ── MINI ANIMATED CANVAS WHEEL ── */}
                <div style={styles.wheelContainer}>
                  <div style={styles.pointer}>▼</div>
                  <div 
                    style={{
                      ...styles.wheel,
                      transform: `rotate(${wheelRotation}deg)`,
                      transition: isSpinning ? "transform 3s cubic-bezier(0.15, 0.9, 0.2, 1)" : "none"
                    }}
                  >
                    {segments.map((seg, idx) => {
                      const angle = 360 / segments.length;
                      return (
                        <div
                          key={seg.id || idx}
                          style={{
                            ...styles.wheelSlice,
                            transform: `rotate(${idx * angle}deg)`,
                            backgroundColor: seg.bg || seg.color || "#6366F1",
                          }}
                        >
                          <span style={styles.sliceContent}>
                            {seg.emoji} {seg.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── SPIN BUTTON / COUNTDOWN ── */}
                {spinStatus.can_spin ? (
                  <button 
                    onClick={handleSpin} 
                    disabled={isSpinning}
                    style={{ ...styles.spinBtn, opacity: isSpinning ? 0.7 : 1 }}
                  >
                    {isSpinning ? "Spinning..." : "SPIN NOW 🎡"}
                  </button>
                ) : (
                  <div style={styles.exhaustedBox}>
                    <p style={{ margin: 0, fontWeight: "bold", color: "#374151" }}>
                      No spins left for today!
                    </p>
                    <p style={{ margin: "4px 0 12px 0", fontSize: "12px", color: "#6B7280" }}>
                      Next daily spin in: <strong>{spinStatus.next_spin_in || "00:00:00"}</strong>
                    </p>
                    <button 
                      onClick={() => { setShowModal(false); navigate("/profile/spin-and-win"); }}
                      style={styles.earnBtn}
                    >
                      Earn Bonus Spins ⚡
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* ── WIN RESULT VIEW ── */
              <div style={{ animation: "fadeIn 0.4s ease" }}>
                <div style={styles.winIcon}>{result.emoji}</div>
                <h2 style={styles.title}>
                  {result.is_win ? "Congratulations! 🎉" : "Better Luck Next Time!"}
                </h2>
                <p style={styles.prizeText}>{result.label}</p>

                {user ? (
                  <>
                    <p style={styles.subtitle}>
                      {result.is_win 
                        ? "Your reward has been added to your Coupons dashboard." 
                        : "Thanks for spinning! Come back tomorrow or complete tasks for bonus spins."}
                    </p>
                    <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                      {result.is_win && (
                        <button 
                          onClick={() => { setShowModal(false); navigate("/coupons"); }}
                          style={styles.claimBtn}
                        >
                          View My Coupons
                        </button>
                      )}
                      {spinStatus.can_spin ? (
                        <button 
                          onClick={() => setResult(null)} 
                          style={{ ...styles.spinBtn, flex: 1 }}
                        >
                          Spin Again
                        </button>
                      ) : (
                        <button 
                          onClick={() => setShowModal(false)} 
                          style={{ ...styles.claimBtn, background: "#4B5563" }}
                        >
                          Close
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p style={styles.subtitle}>
                      Log in or create an account now to claim your reward and keep it forever!
                    </p>
                    <button onClick={handleGuestClaim} style={styles.claimBtn}>
                      Log In to Claim Reward
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inline styles for Keyframes */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }
      `}</style>
    </>
  );
}

// Senior Inline Styling
const styles = {
  floatingBtn: {
    position: "fixed", bottom: "90px", right: "16px", zIndex: 999,
    background: "linear-gradient(135deg, #FF4500, #EC4899)", color: "white",
    border: "none", borderRadius: "30px", padding: "8px 16px 8px 8px",
    display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 14px rgba(255,69,0,0.35)",
    cursor: "pointer", transition: "transform 0.2s"
  },
  floatingIcon: { fontSize: "22px", background: "rgba(255,255,255,0.2)", borderRadius: "50%", padding: "4px" },
  floatingText: { display: "flex", flexDirection: "column", textAlign: "left", lineHeight: "1.2" },
  pulseDot: {
    width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10B981",
    animation: "pulse 1.5s infinite"
  },
  overlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.75)", zIndex: 9999, display: "flex",
    alignItems: "center", justifyContent: "center", padding: "16px", backdropFilter: "blur(4px)"
  },
  modal: {
    background: "white", borderRadius: "20px", padding: "28px 20px",
    width: "100%", maxWidth: "360px", textAlign: "center", position: "relative",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
  },
  closeBtn: {
    position: "absolute", top: "14px", right: "14px", background: "#F3F4F6",
    border: "none", width: "32px", height: "32px", borderRadius: "50%", fontSize: "16px", color: "#4B5563", cursor: "pointer"
  },
  title: { margin: "0 0 6px 0", fontSize: "19px", fontWeight: "800", color: "#111827" },
  subtitle: { margin: "0 0 16px 0", fontSize: "13px", color: "#6B7280", lineHeight: "1.4" },
  counterBadge: {
    display: "flex", justifyContent: "center", gap: "12px", background: "#F3F4F6",
    padding: "6px 12px", borderRadius: "20px", fontSize: "12px", color: "#374151", marginBottom: "16px"
  },
  wheelContainer: {
    position: "relative", width: "200px", height: "200px", margin: "0 auto 20px auto"
  },
  pointer: {
    position: "absolute", top: "-10px", left: "50%", transform: "translateX(-50%)",
    zIndex: 10, color: "#FF4500", fontSize: "20px", textShadow: "0 2px 4px rgba(0,0,0,0.2)"
  },
  wheel: {
    width: "100%", height: "100%", borderRadius: "50%", position: "relative",
    overflow: "hidden", border: "4px solid #F3F4F6", boxShadow: "0 4px 10px rgba(0,0,0,0.15)"
  },
  wheelSlice: {
    position: "absolute", width: "50%", height: "50%", top: 0, right: 0,
    transformOrigin: "0% 100%", display: "flex", alignItems: "center", justifyContent: "center"
  },
  sliceContent: {
    position: "absolute", left: "-100%", transform: "rotate(45deg)",
    fontSize: "9px", fontWeight: "bold", color: "#FFFFFF", textShadow: "0 1px 2px rgba(0,0,0,0.5)",
    whiteSpace: "nowrap"
  },
  spinBtn: {
    background: "linear-gradient(135deg, #2563EB, #1D4ED8)", color: "white", width: "100%", padding: "14px",
    border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: "bold", cursor: "pointer",
    boxShadow: "0 4px 12px rgba(37,99,235,0.3)"
  },
  claimBtn: {
    background: "#10B981", color: "white", width: "100%", padding: "14px",
    border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: "bold", cursor: "pointer"
  },
  earnBtn: {
    background: "#8B5CF6", color: "white", width: "100%", padding: "10px",
    border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "bold", cursor: "pointer"
  },
  exhaustedBox: { background: "#F9FAFB", padding: "16px", borderRadius: "12px", border: "1px solid #E5E7EB" },
  winIcon: { fontSize: "56px", marginBottom: "12px" },
  prizeText: { fontSize: "22px", fontWeight: "800", color: "#FF4500", margin: "0 0 12px 0" }
};
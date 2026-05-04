import React, { useState } from "react";

const segments = [
  { label: "₦500", color: "#FF6B6B" },
  { label: "₦1000", color: "#6C5CE7" },
  { label: "Free Item", color: "#00B894" },
  { label: "Try Again", color: "#636E72" },
  { label: "₦2000", color: "#FD79A8" },
  { label: "Free Delivery", color: "#FDCB6E" },
  { label: "₦5000", color: "#0984E3" },
  { label: "Bonus", color: "#E17055" }
];

export default function PremiumSpinWheel() {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [reward, setReward] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [message, setMessage] = useState("");

  const spin = () => {
    // 🚫 Already claimed → show message instead of blocking button
    if (hasClaimed) {
      setMessage("You have already claimed your reward 🎁");
      setTimeout(() => setMessage(""), 2500);
      return;
    }

    if (spinning) return;

    setSpinning(true);

    const randomIndex = Math.floor(Math.random() * segments.length);
    const segmentAngle = 360 / segments.length;

    const stopAngle =
      360 * 5 +
      (360 - randomIndex * segmentAngle - segmentAngle / 2);

    setRotation((prev) => prev + stopAngle);

    setTimeout(() => {
      setSpinning(false);
      setReward(segments[randomIndex].label);
      setShowModal(true);
    }, 4000);
  };

  const handleClaim = () => {
    setShowModal(false);
    setHasClaimed(true); // 🔒 lock future spins
  };

  return (
    <div style={styles.page}>
      {/* Message Toast */}
      {message && <div style={styles.toast}>{message}</div>}

      {/* Blur */}
      {showModal && <div style={styles.blur} />}

      {/* Pointer */}
      <div style={styles.pointer} />

      {/* Wheel */}
      <div
        style={{
          ...styles.wheel,
          transform: `rotate(${rotation}deg)`
        }}
      >
        {segments.map((seg, i) => {
          const angle = (360 / segments.length) * i;
          return (
            <div
              key={i}
              style={{
                ...styles.segment,
                background: seg.color,
                transform: `rotate(${angle}deg) skewY(-${90 - 360 / segments.length}deg)`
              }}
            >
              <span style={styles.label}>{seg.label}</span>
            </div>
          );
        })}
      </div>

      {/* Button (NOT disabled) */}
      <button onClick={spin} style={styles.button}>
        {spinning ? "Spinning..." : "Spin to Win"}
      </button>

      {/* Modal */}
      {showModal && (
        <div style={styles.modal}>
          <h2>You Won 🎉</h2>
          <p style={{ fontSize: "20px", fontWeight: "bold" }}>{reward}</p>
          <button style={styles.claimBtn} onClick={handleClaim}>
            Claim Reward
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "sans-serif",
    position: "relative"
  },
  wheel: {
    width: "320px",
    height: "320px",
    borderRadius: "50%",
    overflow: "hidden",
    boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
    transition: "transform 4s cubic-bezier(0.33, 1, 0.68, 1)"
  },
  segment: {
    position: "absolute",
    width: "50%",
    height: "50%",
    top: "50%",
    left: "50%",
    transformOrigin: "0% 0%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  label: {
    transform: "skewY(45deg) rotate(45deg)",
    color: "#fff",
    fontSize: "12px",
    fontWeight: "bold"
  },
  pointer: {
    width: 0,
    height: 0,
    borderLeft: "14px solid transparent",
    borderRight: "14px solid transparent",
    borderBottom: "24px solid #111",
    marginBottom: "-15px",
    zIndex: 2
  },
  button: {
    marginTop: "20px",
    padding: "14px 28px",
    borderRadius: "999px",
    border: "none",
    background: "#111",
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
    boxShadow: "0 10px 25px rgba(0,0,0,0.2)"
  },
  blur: {
    position: "absolute",
    width: "100%",
    height: "100%",
    backdropFilter: "blur(6px)",
    background: "rgba(0,0,0,0.2)",
    zIndex: 5
  },
  modal: {
    position: "absolute",
    zIndex: 10,
    background: "#fff",
    padding: "30px",
    borderRadius: "20px",
    textAlign: "center",
    boxShadow: "0 20px 50px rgba(0,0,0,0.25)"
  },
  claimBtn: {
    marginTop: "15px",
    padding: "10px 20px",
    borderRadius: "999px",
    border: "none",
    background: "#111",
    color: "#fff",
    cursor: "pointer"
  },
  toast: {
    position: "absolute",
    top: "20px",
    background: "#111",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: "999px",
    fontSize: "14px"
  }
};
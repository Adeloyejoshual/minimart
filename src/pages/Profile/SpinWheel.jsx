/**
 * src/pages/Profile/SpinWheel.jsx
 * Route: /spin  (add to your router)
 *
 * Animated Spin & Win wheel with:
 * - 7 segments with weighted probabilities (server-side)
 * - 1 free spin per day
 * - Win animation + confetti
 * - Coupon code reveal
 * - History tab
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

/* ═══════════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") || null;

const authH = () => ({
  Authorization  : `Bearer ${getToken()}`,
  "Content-Type" : "application/json",
});

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 60)     return "just now";
  if (s < 3_600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
};

/* ═══════════════════════════════════════════════════════════════
   CONFETTI
═══════════════════════════════════════════════════════════════ */
function fireConfetti() {
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(container);

  const colors = ["#e8630a", "#6366f1", "#16a34a", "#f59e0b", "#ec4899", "#0891b2"];

  for (let i = 0; i < 80; i++) {
    const el    = document.createElement("div");
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size  = Math.random() * 8 + 5;
    el.style.cssText = `
      position:absolute;top:-10px;
      left:${Math.random() * 100}%;
      width:${size}px;height:${size}px;
      background:${color};
      border-radius:${Math.random() > .5 ? "50%" : "2px"};
      animation:sw-confetti ${Math.random() * 1500 + 1500}ms
        ${Math.random() * 800}ms ease-in forwards;
    `;
    container.appendChild(el);
  }

  setTimeout(() => {
    if (document.body.contains(container)) document.body.removeChild(container);
  }, 3_500);
}

/* ═══════════════════════════════════════════════════════════════
   WHEEL CANVAS
═══════════════════════════════════════════════════════════════ */
function WheelCanvas({ segments, targetSegmentId, spinning, onSpinEnd }) {
  const canvasRef   = useRef(null);
  const rafRef      = useRef(null);
  const angleRef    = useRef(0);      // current rotation in degrees
  const speedRef    = useRef(0);
  const targetAngle = useRef(null);

  /* ── Draw the wheel ── */
  const draw = useCallback((angle) => {
    const canvas = canvasRef.current;
    if (!canvas || !segments.length) return;

    const ctx    = canvas.getContext("2d");
    const W      = canvas.width;
    const H      = canvas.height;
    const cx     = W / 2;
    const cy     = H / 2;
    const radius = Math.min(cx, cy) - 4;
    const arc    = (2 * Math.PI) / segments.length;

    ctx.clearRect(0, 0, W, H);

    /* Outer glow */
    ctx.save();
    ctx.shadowBlur  = 20;
    ctx.shadowColor = "rgba(232,99,10,.3)";
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, 2 * Math.PI);
    ctx.strokeStyle = "#e8630a";
    ctx.lineWidth   = 3;
    ctx.stroke();
    ctx.restore();

    segments.forEach((seg, i) => {
      const startAngle = arc * i + (angle * Math.PI) / 180 - Math.PI / 2;
      const endAngle   = startAngle + arc;

      /* Slice */
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? seg.color : seg.color + "cc";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.3)";
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      /* Text */
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startAngle + arc / 2);
      ctx.textAlign = "right";

      /* Emoji */
      ctx.font  = `${radius * 0.13}px serif`;
      ctx.fillStyle = "#fff";
      ctx.fillText(seg.emoji, radius * 0.82, 5);

      /* Label */
      ctx.font      = `bold ${radius * 0.085}px 'DM Sans',sans-serif`;
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "rgba(0,0,0,.4)";
      ctx.shadowBlur  = 4;
      ctx.fillText(seg.label, radius * 0.62, -radius * 0.01 + 5);

      ctx.restore();
    });

    /* Center cap */
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.12);
    grad.addColorStop(0, "#fff");
    grad.addColorStop(1, "#f0ede8");

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.12, 0, 2 * Math.PI);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "#e8630a";
    ctx.lineWidth   = 3;
    ctx.stroke();

    /* Center logo */
    ctx.font      = `bold ${radius * 0.08}px sans-serif`;
    ctx.fillStyle = "#e8630a";
    ctx.textAlign = "center";
    ctx.fillText("🎡", cx, cy + 5);
  }, [segments]);

  /* Initial draw */
  useEffect(() => {
    draw(angleRef.current);
  }, [draw]);

  /* ── Spin animation ── */
  useEffect(() => {
    if (!spinning || !segments.length || targetSegmentId == null) return;

    /* Calculate where we need to stop */
    const segCount   = segments.length;
    const segAngle   = 360 / segCount;
    const targetIdx  = segments.findIndex((s) => s.id === targetSegmentId);
    if (targetIdx < 0) return;

    /* We want targetIdx segment to land at the top (pointer) */
    const segMidpoint = segAngle * targetIdx + segAngle / 2;
    const stopAngle   = 360 - segMidpoint;

    /* Add 5–8 full rotations + stop offset */
    const rotations   = (5 + Math.floor(Math.random() * 3)) * 360;
    const finalAngle  = stopAngle + rotations;

    targetAngle.current = finalAngle;
    speedRef.current    = 20; // initial speed (deg/frame)

    const TOTAL_FRAMES = 120 + Math.floor(Math.random() * 40);
    let   frame        = 0;

    const animate = () => {
      frame++;
      const progress = frame / TOTAL_FRAMES;

      /* Ease-out cubic */
      const eased = 1 - Math.pow(1 - progress, 3);
      angleRef.current = eased * finalAngle;

      draw(angleRef.current % 360);

      if (frame < TOTAL_FRAMES) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        angleRef.current = finalAngle % 360;
        draw(angleRef.current);
        onSpinEnd?.();
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [spinning, targetSegmentId, segments, draw, onSpinEnd]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={300}
      style={{ display: "block", maxWidth: "100%" }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   RESULT MODAL
═══════════════════════════════════════════════════════════════ */
function ResultModal({ result, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!result?.coupon_code) return;
    navigator.clipboard?.writeText(result.coupon_code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  };

  if (!result) return null;

  return (
    <div className="sw-modal-overlay" onClick={onClose}>
      <div className="sw-modal" onClick={(e) => e.stopPropagation()}>

        {/* Animation */}
        <div className="sw-modal-anim">
          {result.is_win ? (
            <div className="sw-modal-win-ring">
              <span style={{ fontSize: 48 }}>{result.emoji}</span>
            </div>
          ) : (
            <span style={{ fontSize: 60 }}>😅</span>
          )}
        </div>

        {/* Title */}
        <h2 className="sw-modal-title">
          {result.is_win ? "🎉 You Won!" : "Better Luck Tomorrow!"}
        </h2>

        {/* Prize */}
        {result.is_win && (
          <div className="sw-modal-prize">
            <p className="sw-modal-prize-label">{result.label}</p>
            {result.type === "fixed" && (
              <p className="sw-modal-prize-val">{naira(result.value)} OFF</p>
            )}
            {result.type === "percentage" && (
              <p className="sw-modal-prize-val">{result.value}% OFF</p>
            )}
            {result.type === "free_shipping" && (
              <p className="sw-modal-prize-val">🚚 Free Delivery</p>
            )}
            {result.type === "airtime" && (
              <p className="sw-modal-prize-val">📱 {naira(result.value)} Airtime</p>
            )}
          </div>
        )}

        {/* Message */}
        <p className="sw-modal-msg">{result.message}</p>

        {/* Coupon code */}
        {result.coupon_code && (
          <div className="sw-modal-coupon">
            <p className="sw-modal-coupon-label">Your coupon code</p>
            <div className="sw-modal-coupon-row">
              <span className="sw-modal-coupon-code">{result.coupon_code}</span>
              <button
                className={`sw-modal-copy${copied ? " copied" : ""}`}
                onClick={handleCopy}
              >
                {copied ? "✓ Copied!" : "Copy"}
              </button>
            </div>
            {result.expires_in && (
              <p className="sw-modal-expires">Expires in {result.expires_in}</p>
            )}
          </div>
        )}

        <button className="sw-modal-close" onClick={onClose}>
          {result.is_win ? "Awesome! 🎊" : "Try Tomorrow →"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function SpinWheel({ user }) {
  const navigate = useNavigate();

  const [segments,   setSegments]   = useState([]);
  const [spinStatus, setSpinStatus] = useState(null);
  const [history,    setHistory]    = useState([]);
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [spinning,   setSpinning]   = useState(false);
  const [spinResult, setSpinResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [targetId,   setTargetId]   = useState(null);
  const [tab,        setTab]        = useState("wheel"); // wheel | history

  /* ── Auth check ── */
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/spin");
  }, [navigate]);

  /* ── Load config ── */
  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, historyRes] = await Promise.all([
        fetch(`${API}/spinwheel/config`,  { headers: authH() }),
        fetch(`${API}/spinwheel/history`, { headers: authH() }),
      ]);

      if (configRes.ok) {
        const d = await configRes.json();
        setSegments(d.segments || []);
        setSpinStatus(d.spin_status || null);
      }

      if (historyRes.ok) {
        const d = await historyRes.json();
        setHistory(d.history || []);
        setStats(d.stats || null);
      }
    } catch (err) {
      console.error("[SpinWheel]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  /* ── Execute spin ── */
  const handleSpin = useCallback(async () => {
    if (spinning || !spinStatus?.can_spin) return;

    setSpinning(true);
    setSpinResult(null);

    try {
      const res  = await fetch(`${API}/spinwheel/spin`, {
        method  : "POST",
        headers : authH(),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Could not spin. Please try again.");
        setSpinning(false);
        return;
      }

      /* Set target so wheel animation knows where to stop */
      setTargetId(data.segment_id);
      setSpinResult(data.result);

      /* Update spin status */
      setSpinStatus((prev) => ({
        ...prev,
        can_spin   : false,
        spins_today: (prev?.spins_today || 0) + 1,
      }));

    } catch {
      alert("Network error. Please try again.");
      setSpinning(false);
    }
  }, [spinning, spinStatus]);

  /* ── Called when wheel animation finishes ── */
  const handleSpinEnd = useCallback(() => {
    setSpinning(false);

    /* Fire confetti if won */
    if (spinResult?.is_win) {
      fireConfetti();
    }

    /* Show result after short delay */
    setTimeout(() => {
      setShowResult(true);
      loadConfig(); // refresh history
    }, 400);
  }, [spinResult, loadConfig]);

  const closeResult = useCallback(() => {
    setShowResult(false);
    setSpinResult(null);
    setTargetId(null);
  }, []);

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="sw-page">

      {/* ── Topbar ── */}
      <div className="sw-topbar">
        <button className="sw-back" onClick={() => navigate(-1)} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <h1 className="sw-topbar-title">🎡 Spin & Win</h1>
          <p className="sw-topbar-sub">1 free spin per day</p>
        </div>
        <div className="sw-topbar-stats">
          {stats && (
            <div className="sw-topbar-win-rate">
              <span>{stats.total_wins}</span>
              <small>wins</small>
            </div>
          )}
        </div>
      </div>

      {/* ── Nav ── */}
      <div className="sw-nav">
        <button
          className={`sw-nav-btn${tab === "wheel" ? " active" : ""}`}
          onClick={() => setTab("wheel")}
        >
          🎡 Spin
        </button>
        <button
          className={`sw-nav-btn${tab === "history" ? " active" : ""}`}
          onClick={() => setTab("history")}
        >
          📋 History
          {history.length > 0 && (
            <span className="sw-nav-count">{history.length}</span>
          )}
        </button>
      </div>

      <div className="sw-scroll">

        {/* ══════════════════════════════════════════════
            WHEEL TAB
        ══════════════════════════════════════════════ */}
        {tab === "wheel" && (
          <>
            {/* Spin status banner */}
            {spinStatus && !spinStatus.can_spin && (
              <div className="sw-status-banner">
                <span>⏰</span>
                <div>
                  <p>Next spin in <strong>{spinStatus.next_spin_in}</strong></p>
                  <small>Come back tomorrow for your free spin!</small>
                </div>
              </div>
            )}

            {spinStatus?.can_spin && (
              <div className="sw-ready-banner">
                <span>✨</span>
                <p>Your free spin is ready!</p>
              </div>
            )}

            {/* Wheel */}
            <div className="sw-wheel-wrap">
              {/* Pointer */}
              <div className="sw-pointer">▼</div>

              {/* Canvas */}
              <div className="sw-canvas-wrap">
                {loading ? (
                  <div className="sw-canvas-loading">
                    <div className="sw-sk-wheel" />
                  </div>
                ) : (
                  <WheelCanvas
                    segments={segments}
                    targetSegmentId={targetId}
                    spinning={spinning}
                    onSpinEnd={handleSpinEnd}
                  />
                )}
              </div>
            </div>

            {/* Spin button */}
            <button
              className={`sw-spin-btn${spinning ? " sw-spin-btn--spinning" : ""}${!spinStatus?.can_spin ? " sw-spin-btn--disabled" : ""}`}
              onClick={handleSpin}
              disabled={spinning || !spinStatus?.can_spin || loading}
            >
              {spinning
                ? <><span className="sw-btn-spinner" /> Spinning…</>
                : spinStatus?.can_spin
                  ? "🎡 SPIN NOW!"
                  : `Come back in ${spinStatus?.next_spin_in || "..."}`}
            </button>

            {/* Prizes list */}
            <div className="sw-prizes">
              <h3 className="sw-prizes-title">🎁 Prizes You Can Win</h3>
              <div className="sw-prizes-grid">
                {segments.map((seg) => (
                  <div
                    key={seg.id}
                    className="sw-prize-item"
                    style={{ background: seg.bg, borderColor: seg.color + "44" }}
                  >
                    <span className="sw-prize-emoji">{seg.emoji}</span>
                    <span className="sw-prize-label" style={{ color: seg.color }}>
                      {seg.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rules */}
            <div className="sw-rules">
              <h3 className="sw-rules-title">📋 Rules</h3>
              {[
                "1 free spin per day — resets at midnight",
                "Coupons expire 30 days after winning",
                "Airtime credited within 24 hours",
                "Each coupon can only be used once",
                "Prizes are non-transferable",
              ].map((rule, i) => (
                <div key={i} className="sw-rule">
                  <span>•</span>
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════
            HISTORY TAB
        ══════════════════════════════════════════════ */}
        {tab === "history" && (
          <>
            {/* Stats */}
            {stats && (
              <div className="sw-hist-stats">
                <div className="sw-hist-stat">
                  <p className="sw-hist-stat-val">{stats.total_spins}</p>
                  <p className="sw-hist-stat-label">Total Spins</p>
                </div>
                <div className="sw-hist-stat">
                  <p className="sw-hist-stat-val" style={{ color: "#16a34a" }}>
                    {stats.total_wins}
                  </p>
                  <p className="sw-hist-stat-label">Wins</p>
                </div>
                <div className="sw-hist-stat">
                  <p className="sw-hist-stat-val" style={{ color: "#e8630a" }}>
                    {stats.win_rate}%
                  </p>
                  <p className="sw-hist-stat-label">Win Rate</p>
                </div>
              </div>
            )}

            {/* History list */}
            {history.length === 0 ? (
              <div className="sw-empty">
                <span>🎡</span>
                <p>No spins yet</p>
                <small>Spin the wheel to win prizes!</small>
                <button onClick={() => setTab("wheel")}>Go Spin →</button>
              </div>
            ) : (
              <div className="sw-hist-list">
                {history.map((h) => (
                  <div key={h.id} className="sw-hist-item">
                    <div
                      className="sw-hist-icon"
                      style={{
                        background : h.is_win ? "#f0fdf4" : "#f3f4f6",
                        color      : h.is_win ? "#16a34a" : "#9ca3af",
                        fontSize   : 20,
                      }}
                    >
                      {h.is_win ? "🎉" : "😅"}
                    </div>
                    <div className="sw-hist-info">
                      <p className="sw-hist-label">{h.label}</p>
                      {h.coupon_code && (
                        <p className="sw-hist-code">Code: {h.coupon_code}</p>
                      )}
                      <p className="sw-hist-date">{timeAgo(h.spun_at)}</p>
                    </div>
                    <div className="sw-hist-result">
                      {h.type === "fixed"        && <span className="sw-hist-win">{naira(h.value)} OFF</span>}
                      {h.type === "percentage"   && <span className="sw-hist-win">{h.value}% OFF</span>}
                      {h.type === "free_shipping"&& <span className="sw-hist-win">🚚 Free</span>}
                      {h.type === "airtime"      && <span className="sw-hist-win">📱 {naira(h.value)}</span>}
                      {h.type === "none"         && <span className="sw-hist-miss">Try Again</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <p className="sw-footer">© {new Date().getFullYear()} Loemart — Spin responsibly!</p>
      </div>

      {/* ── Result modal ── */}
      {showResult && spinResult && (
        <ResultModal result={spinResult} onClose={closeResult} />
      )}

      {/* ── Styles ── */}
      <style>{SW_STYLES}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════════ */
const SW_STYLES = `

/* ── Page ── */
.sw-page {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  background: linear-gradient(180deg, #0a0f1e 0%, #1a1614 100%);
  font-family: 'DM Sans', system-ui, sans-serif;
  color: #fff;
  padding-bottom: 40px;
}

/* ── Topbar ── */
.sw-topbar {
  display: flex; align-items: center; gap: 12px;
  padding: 16px; position: sticky; top: 0; z-index: 50;
  background: rgba(10,15,30,.96);
  border-bottom: 1px solid rgba(255,255,255,.08);
  backdrop-filter: blur(12px);
}
.sw-back {
  width: 38px; height: 38px; border-radius: 50%;
  border: 1.5px solid rgba(255,255,255,.15);
  background: rgba(255,255,255,.08);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #fff; flex-shrink: 0;
  transition: all .15s;
}
.sw-back:hover { border-color: #e8630a; color: #e8630a; }
.sw-topbar-title { font-size: 18px; font-weight: 800; margin: 0; }
.sw-topbar-sub   { font-size: 11px; color: rgba(255,255,255,.5); margin: 0; }
.sw-topbar-stats { margin-left: auto; }
.sw-topbar-win-rate {
  text-align: center;
  background: rgba(232,99,10,.2);
  border: 1px solid rgba(232,99,10,.3);
  border-radius: 10px; padding: 6px 12px;
}
.sw-topbar-win-rate span { font-size: 18px; font-weight: 900; color: #e8630a; display: block; }
.sw-topbar-win-rate small { font-size: 9px; color: rgba(255,255,255,.5); }

/* ── Nav ── */
.sw-nav {
  display: flex; background: rgba(255,255,255,.06);
  border-bottom: 1px solid rgba(255,255,255,.08);
}
.sw-nav-btn {
  flex: 1; padding: 12px 8px; border: none; background: none;
  color: rgba(255,255,255,.5); font-size: 13px; font-weight: 600;
  cursor: pointer; border-bottom: 2.5px solid transparent;
  display: flex; align-items: center; justify-content: center; gap: 5px;
  transition: color .15s;
}
.sw-nav-btn.active { color: #e8630a; border-bottom-color: #e8630a; }
.sw-nav-count {
  background: #e8630a; color: #fff;
  font-size: 10px; font-weight: 700;
  padding: 1px 6px; border-radius: 20px;
}

/* ── Scroll ── */
.sw-scroll { padding: 16px; display: flex; flex-direction: column; gap: 16px; }

/* ── Status banners ── */
.sw-status-banner {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 14px;
  font-size: 13px;
}
.sw-status-banner span { font-size: 24px; flex-shrink: 0; }
.sw-status-banner p    { margin: 0 0 2px; }
.sw-status-banner small{ color: rgba(255,255,255,.5); }

.sw-ready-banner {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px;
  background: rgba(232,99,10,.15);
  border: 1px solid rgba(232,99,10,.3);
  border-radius: 14px;
  font-size: 14px; font-weight: 700; color: #ff8a4a;
}
.sw-ready-banner span { font-size: 20px; }

/* ── Wheel ── */
.sw-wheel-wrap {
  position: relative;
  display: flex; flex-direction: column; align-items: center;
  gap: 0;
}
.sw-pointer {
  font-size: 28px; color: #e8630a;
  text-shadow: 0 2px 8px rgba(232,99,10,.6);
  margin-bottom: -4px; position: relative; z-index: 2;
  animation: sw-pulse 1.5s ease-in-out infinite;
}
@keyframes sw-pulse {
  0%, 100% { transform: translateY(0);   }
  50%       { transform: translateY(4px); }
}

.sw-canvas-wrap {
  width: 300px; height: 300px;
  border-radius: 50%;
  box-shadow:
    0 0 0 8px rgba(232,99,10,.15),
    0 0 0 16px rgba(232,99,10,.06),
    0 20px 60px rgba(0,0,0,.5);
}

.sw-canvas-loading { width: 300px; height: 300px; }
.sw-sk-wheel {
  width: 300px; height: 300px; border-radius: 50%;
  background: linear-gradient(135deg, #1a1614, #2a2420);
  animation: sw-glow 1.5s ease-in-out infinite;
}
@keyframes sw-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(232,99,10,.2); }
  50%       { box-shadow: 0 0 40px rgba(232,99,10,.4); }
}

/* ── Spin button ── */
.sw-spin-btn {
  width: 100%; padding: 18px;
  background: linear-gradient(135deg, #e8630a, #ff8a4a);
  color: #fff; border: none; border-radius: 16px;
  font-size: 18px; font-weight: 900; cursor: pointer;
  box-shadow: 0 4px 24px rgba(232,99,10,.4);
  transition: all .2s;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.sw-spin-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(232,99,10,.5);
}
.sw-spin-btn:active:not(:disabled) { transform: scale(.97); }
.sw-spin-btn--spinning {
  background: linear-gradient(135deg, #555, #777);
  box-shadow: none; cursor: wait;
}
.sw-spin-btn--disabled {
  background: rgba(255,255,255,.1);
  color: rgba(255,255,255,.4);
  box-shadow: none; cursor: not-allowed;
}

.sw-btn-spinner {
  width: 18px; height: 18px;
  border: 2.5px solid rgba(255,255,255,.3);
  border-top-color: #fff;
  border-radius: 50%;
  display: inline-block;
  animation: sw-spin .7s linear infinite;
}
@keyframes sw-spin { to { transform: rotate(360deg); } }

/* ── Prizes ── */
.sw-prizes {
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 16px; padding: 16px;
}
.sw-prizes-title { font-size: 15px; font-weight: 800; margin: 0 0 12px; }
.sw-prizes-grid  {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;
}
.sw-prize-item {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; border-radius: 10px;
  border: 1px solid;
}
.sw-prize-emoji { font-size: 18px; flex-shrink: 0; }
.sw-prize-label { font-size: 12px; font-weight: 700; }

/* ── Rules ── */
.sw-rules {
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 14px; padding: 14px 16px;
}
.sw-rules-title { font-size: 13px; font-weight: 800; margin: 0 0 10px; }
.sw-rule {
  display: flex; gap: 8px; font-size: 12px;
  color: rgba(255,255,255,.6); margin-bottom: 6px; line-height: 1.4;
}
.sw-rule:last-child { margin-bottom: 0; }

/* ── History ── */
.sw-hist-stats {
  display: grid; grid-template-columns: repeat(3, 1fr);
  background: rgba(255,255,255,.06);
  border-radius: 14px; overflow: hidden;
  border: 1px solid rgba(255,255,255,.08);
}
.sw-hist-stat {
  text-align: center; padding: 16px 8px;
  border-right: 1px solid rgba(255,255,255,.08);
}
.sw-hist-stat:last-child { border-right: none; }
.sw-hist-stat-val   { font-size: 24px; font-weight: 900; margin: 0 0 3px; }
.sw-hist-stat-label { font-size: 10px; color: rgba(255,255,255,.5); margin: 0; }

.sw-hist-list { display: flex; flex-direction: column; gap: 0; }
.sw-hist-item {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(255,255,255,.06);
}
.sw-hist-item:last-child { border-bottom: none; }
.sw-hist-icon {
  width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.sw-hist-info  { flex: 1; min-width: 0; }
.sw-hist-label { font-size: 14px; font-weight: 700; margin: 0 0 2px; }
.sw-hist-code  { font-size: 11px; color: #e8630a; font-family: monospace; margin: 0 0 2px; }
.sw-hist-date  { font-size: 11px; color: rgba(255,255,255,.4); margin: 0; }
.sw-hist-win   { font-size: 14px; font-weight: 800; color: #16a34a; }
.sw-hist-miss  { font-size: 12px; color: rgba(255,255,255,.3); }

/* ── Empty ── */
.sw-empty {
  text-align: center; padding: 48px 20px;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
}
.sw-empty span  { font-size: 40px; }
.sw-empty p     { font-size: 16px; font-weight: 700; margin: 0; }
.sw-empty small { font-size: 12px; color: rgba(255,255,255,.5); }
.sw-empty button {
  padding: 10px 24px; background: #e8630a; color: #fff;
  border: none; border-radius: 8px; font-size: 14px;
  font-weight: 700; cursor: pointer;
}

/* ── Footer ── */
.sw-footer {
  text-align: center; font-size: 11px;
  color: rgba(255,255,255,.2); padding: 8px 0;
}

/* ── Result modal ── */
.sw-modal-overlay {
  position: fixed; inset: 0; z-index: 500;
  background: rgba(0,0,0,.8);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.sw-modal {
  background: linear-gradient(145deg, #1a1614, #111);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 24px; padding: 32px 24px;
  width: 100%; max-width: 360px;
  text-align: center;
  box-shadow: 0 24px 80px rgba(0,0,0,.6);
  animation: sw-modal-in .3s cubic-bezier(.4,0,.2,1);
}
@keyframes sw-modal-in {
  from { opacity: 0; transform: scale(.8) translateY(20px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

.sw-modal-anim { margin-bottom: 16px; }
.sw-modal-win-ring {
  width: 90px; height: 90px; border-radius: 50%;
  background: rgba(232,99,10,.15);
  border: 3px solid #e8630a;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto;
  animation: sw-ring-pulse 1s ease-in-out infinite;
}
@keyframes sw-ring-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(232,99,10,.4); }
  50%       { box-shadow: 0 0 0 12px rgba(232,99,10,0); }
}

.sw-modal-title {
  font-size: 22px; font-weight: 900; color: #fff; margin: 0 0 14px;
}
.sw-modal-prize {
  background: rgba(232,99,10,.1);
  border: 1px solid rgba(232,99,10,.25);
  border-radius: 14px; padding: 16px; margin-bottom: 14px;
}
.sw-modal-prize-label { font-size: 13px; color: rgba(255,255,255,.7); margin: 0 0 4px; }
.sw-modal-prize-val   { font-size: 28px; font-weight: 900; color: #e8630a; margin: 0; }

.sw-modal-msg {
  font-size: 13px; color: rgba(255,255,255,.7); line-height: 1.5; margin-bottom: 16px;
}

.sw-modal-coupon {
  background: rgba(255,255,255,.06);
  border: 1px dashed rgba(255,255,255,.2);
  border-radius: 12px; padding: 14px; margin-bottom: 20px;
}
.sw-modal-coupon-label { font-size: 11px; color: rgba(255,255,255,.5); margin: 0 0 8px; }
.sw-modal-coupon-row {
  display: flex; align-items: center; justify-content: center; gap: 10px;
}
.sw-modal-coupon-code {
  font-size: 20px; font-weight: 900; letter-spacing: 2px;
  color: #e8630a; font-family: monospace;
}
.sw-modal-copy {
  padding: 6px 14px; background: #e8630a; color: #fff;
  border: none; border-radius: 20px; font-size: 12px;
  font-weight: 700; cursor: pointer; transition: all .15s;
}
.sw-modal-copy.copied { background: #16a34a; }
.sw-modal-expires { font-size: 11px; color: rgba(255,255,255,.4); margin: 8px 0 0; }

.sw-modal-close {
  width: 100%; padding: 14px;
  background: linear-gradient(135deg, #e8630a, #ff8a4a);
  color: #fff; border: none; border-radius: 12px;
  font-size: 16px; font-weight: 800; cursor: pointer;
  transition: opacity .15s;
}
.sw-modal-close:hover { opacity: .88; }

/* ── Confetti keyframe ── */
@keyframes sw-confetti {
  0%   { transform: translateY(0) rotate(0deg);      opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}
`;
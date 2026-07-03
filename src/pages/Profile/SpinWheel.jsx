// src/pages/Profile/SpinWheel.jsx
// Route: /spin

import {
  useState, useEffect, useRef,
  useCallback, useMemo,
} from "react";
import { useNavigate, Link } from "react-router-dom";
import "../../styles/SpinWheel.css";

/* ══════════════════════════════════════════════════════════════
   ENV + API
══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

/* ══════════════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const authH = () => ({
  Authorization  : `Bearer ${getToken()}`,
  "Content-Type" : "application/json",
});

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 60)     return "just now";
  if (s < 3_600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
};

const fmtCountdown = (secs) => {
  if (!secs || secs <= 0) return "00:00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
};

const isBigWin = (result) => {
  if (!result?.is_win) return false;
  if (result.is_big_win)                                         return true;
  if (result.type === "fixed"       && Number(result.value) >= 2000) return true;
  if (result.type === "percentage"  && Number(result.value) >= 20)   return true;
  if (result.type === "free_shipping")                               return true;
  return false;
};

/* ══════════════════════════════════════════════════════════════
   SOUND MANAGER
══════════════════════════════════════════════════════════════ */
class SoundMgr {
  constructor() {
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) {
      this._ctx = null;
    }
    this.muted = false;
  }

  _beep(freq, dur, vol = 0.15, type = "sine") {
    if (this.muted || !this._ctx) return;
    try {
      const osc  = this._ctx.createOscillator();
      const gain = this._ctx.createGain();
      osc.connect(gain);
      gain.connect(this._ctx.destination);
      osc.frequency.value = freq;
      osc.type            = type;
      gain.gain.setValueAtTime(vol, this._ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + dur);
      osc.start();
      osc.stop(this._ctx.currentTime + dur);
    } catch (_) {}
  }

  tick()      { this._beep(320, 0.04, 0.12, "square"); }
  spinStart() { this._beep(440, 0.08, 0.10, "sine");   }
  lose() {
    this._beep(200, 0.3, 0.12, "sawtooth");
    setTimeout(() => this._beep(150, 0.4, 0.1, "sawtooth"), 250);
  }
  win() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this._beep(f, 0.18, 0.2, "sine"), i * 120)
    );
  }
  resume() {
    if (this._ctx?.state === "suspended") this._ctx.resume();
  }
}

const sound = new SoundMgr();

/* ══════════════════════════════════════════════════════════════
   CONFETTI
══════════════════════════════════════════════════════════════ */
function fireConfetti(big = false) {
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(container);

  const colors = ["#e8630a","#6366f1","#16a34a","#f59e0b","#ec4899","#0891b2"];
  const count  = big ? 160 : 100;

  for (let i = 0; i < count; i++) {
    const el    = document.createElement("div");
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size  = Math.random() * (big ? 12 : 8) + 5;
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

/* ══════════════════════════════════════════════════════════════
   SPIN COUNTER BADGE
══════════════════════════════════════════════════════════════ */
function SpinCounterBadge({ spinStatus }) {
  if (!spinStatus) return null;

  const freeLeft  = spinStatus.can_free_spin ? 1 : 0;
  const bonusLeft = spinStatus.bonus_spins_remaining || 0;
  const total     = freeLeft + bonusLeft;

  return (
    <div className="sw-counter-wrap">
      <div
        className={`sw-counter-pill ${total > 0 ? "has-spins" : "no-spins"}`}
        aria-label={`${total} spin${total !== 1 ? "s" : ""} remaining`}
      >
        <span className="sw-counter-num">{total}</span>
        <span className="sw-counter-label">spin{total !== 1 ? "s" : ""} left</span>
      </div>

      <div className="sw-counter-breakdown" role="list" aria-label="Spin breakdown">
        <div className="sw-counter-dot-wrap" role="listitem">
          <div
            className={`sw-counter-dot ${freeLeft > 0 ? "dot-free" : "dot-used"}`}
            aria-hidden="true"
          />
          <span>Free</span>
        </div>

        {Array.from({ length: Math.min(bonusLeft, 10) }).map((_, i) => (
          <div key={i} className="sw-counter-dot-wrap" role="listitem">
            <div className="sw-counter-dot dot-bonus" aria-hidden="true" />
            {i === 0 && <span>Bonus</span>}
          </div>
        ))}

        {bonusLeft > 10 && (
          <span className="sw-counter-overflow">+{bonusLeft - 10} more</span>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   COUNTDOWN TIMER
══════════════════════════════════════════════════════════════ */
function CountdownTimer({ secondsLeft }) {
  const [secs, setSecs] = useState(secondsLeft || 0);

  useEffect(() => {
    setSecs(secondsLeft || 0);
    if (!secondsLeft || secondsLeft <= 0) return;
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1_000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  if (secs <= 0) return null;

  return (
    <div className="sw-countdown" aria-live="polite" aria-label="Time until next free spin">
      <span aria-hidden="true">⏱</span>
      <span>Next free spin in</span>
      <span className="sw-countdown-time">{fmtCountdown(secs)}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   BONUS SPIN TOAST
══════════════════════════════════════════════════════════════ */
function BonusSpinToast({ bonus, onClose }) {
  useEffect(() => {
    if (!bonus) return;
    const t = setTimeout(onClose, 4_000);
    return () => clearTimeout(t);
  }, [bonus, onClose]);

  if (!bonus) return null;

  return (
    <div className="sw-bonus-toast" role="alert" aria-live="assertive">
      <span className="sw-bonus-toast-icon" aria-hidden="true">🎁</span>
      <div>
        <p className="sw-bonus-toast-title">
          +{bonus.spins_awarded} Bonus Spin{bonus.spins_awarded > 1 ? "s" : ""} Earned!
        </p>
        <p className="sw-bonus-toast-msg">
          {bonus.referred_user} joined using your invite code
        </p>
      </div>
      <button
        className="sw-bonus-toast-close"
        onClick={onClose}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   REFERRAL SPINS PANEL
══════════════════════════════════════════════════════════════ */
function ReferralSpinsPanel({ referralSpins }) {
  if (!referralSpins?.length) return null;

  return (
    <div className="sw-ref-panel">
      <div className="sw-ref-panel-header">
        <span className="sw-ref-panel-icon" aria-hidden="true">🎁</span>
        <div>
          <h3 className="sw-ref-panel-title">Bonus Spins from Referrals</h3>
          <p className="sw-ref-panel-sub">
            Earn 1 bonus spin each time someone signs up with your invite code
          </p>
        </div>
      </div>

      <div className="sw-ref-list" role="list">
        {referralSpins.map((ref) => (
          <div key={ref.id} className="sw-ref-item" role="listitem">
            {ref.avatar_url ? (
              <img
                src={ref.avatar_url}
                alt={ref.referred_name}
                className="sw-ref-avatar-img"
              />
            ) : (
              <div
                className="sw-ref-avatar"
                style={{ backgroundColor: ref.color || "#e8630a" }}
                aria-hidden="true"
              >
                {ref.initials}
              </div>
            )}
            <div className="sw-ref-info">
              <p className="sw-ref-name">{ref.referred_name}</p>
              <p className="sw-ref-time">Signed up {timeAgo(ref.created_at)}</p>
            </div>
            <div className="sw-ref-badge">
              <span aria-hidden="true">🎡</span>
              <span>+{ref.spins_awarded} spin{ref.spins_awarded > 1 ? "s" : ""}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="sw-ref-tip">
        💡 Share your invite code on the{" "}
        <Link to="/invite" className="sw-ref-tip-link">Invite Friends</Link>{" "}
        page to earn more bonus spins!
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   WHEEL CANVAS
══════════════════════════════════════════════════════════════ */
function WheelCanvas({ segments, targetSegmentId, spinning, onSpinEnd, onTick }) {
  const canvasRef   = useRef(null);
  const rafRef      = useRef(null);
  const angleRef    = useRef(0);
  const lastTickSeg = useRef(-1);

  const size = useMemo(
    () => Math.min(
      typeof window !== "undefined" ? window.innerWidth - 48 : 320,
      320
    ),
    []
  );

  /* ── Draw ── */
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

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle   = i % 2 === 0 ? seg.color : seg.color + "cc";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.3)";
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startAngle + arc / 2);
      ctx.textAlign = "right";

      ctx.font      = `${radius * 0.13}px serif`;
      ctx.fillStyle = "#fff";
      ctx.fillText(seg.emoji, radius * 0.82, 5);

      ctx.font        = `bold ${radius * 0.085}px 'DM Sans',sans-serif`;
      ctx.fillStyle   = "#fff";
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
    ctx.fillStyle   = grad;
    ctx.fill();
    ctx.strokeStyle = "#e8630a";
    ctx.lineWidth   = 3;
    ctx.stroke();

    ctx.font      = `bold ${radius * 0.08}px sans-serif`;
    ctx.fillStyle = "#e8630a";
    ctx.textAlign = "center";
    ctx.fillText("🎡", cx, cy + 5);
  }, [segments]);

  useEffect(() => { draw(angleRef.current); }, [draw]);

  /* ── Animation ── */
  useEffect(() => {
    if (!spinning || !segments.length || targetSegmentId == null) return;

    const segCount    = segments.length;
    const segAngle    = 360 / segCount;
    const targetIdx   = segments.findIndex((s) => s.id === targetSegmentId);
    if (targetIdx < 0) return;

    const segMidpoint = segAngle * targetIdx + segAngle / 2;
    const stopAngle   = 360 - segMidpoint;
    const rotations   = (5 + Math.floor(Math.random() * 3)) * 360;
    const finalAngle  = stopAngle + rotations;

    const TOTAL_FRAMES = 130 + Math.floor(Math.random() * 40);
    let   frame        = 0;

    const animate = () => {
      frame++;
      const progress = frame / TOTAL_FRAMES;
      const eased    = 1 - Math.pow(1 - progress, 3);

      angleRef.current = eased * finalAngle;
      draw(angleRef.current % 360);

      const curSeg = Math.floor((angleRef.current % 360) / segAngle) % segCount;
      if (curSeg !== lastTickSeg.current) {
        lastTickSeg.current = curSeg;
        onTick?.();
      }

      if (frame < TOTAL_FRAMES) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        angleRef.current = finalAngle % 360;
        draw(angleRef.current);
        onSpinEnd?.();
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [spinning, targetSegmentId, segments, draw, onSpinEnd, onTick]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: "block", maxWidth: "100%", borderRadius: "50%" }}
      aria-label="Spin wheel"
      role="img"
    />
  );
}

/* ══════════════════════════════════════════════════════════════
   RESULT MODAL
══════════════════════════════════════════════════════════════ */
function ResultModal({ result, onClose }) {
  const [copied, setCopied] = useState(false);
  const big = isBigWin(result);

  const handleCopy = () => {
    if (!result?.coupon_code) return;
    navigator.clipboard?.writeText(result.coupon_code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  };

  const handleShare = async () => {
    const text = result.is_win
      ? `🎉 I just won ${result.label} on Loemart's Spin & Win! Join here: ${import.meta.env.VITE_APP_URL || "https://loemart.com"}`
      : "🎡 I just spun the Loemart wheel! Join and try your luck!";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Loemart Spin & Win", text });
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (big && "vibrate" in navigator) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }
  }, [big]);

  if (!result) return null;

  return (
    <div
      className="sw-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={result.is_win ? "You won!" : "Better luck next time"}
    >
      <div
        className={`sw-modal${big ? " sw-modal--big-win" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animation ring */}
        <div className="sw-modal-anim">
          {result.is_win ? (
            <div className="sw-modal-win-ring">
              <span style={{ fontSize: 48 }} aria-hidden="true">{result.emoji}</span>
            </div>
          ) : (
            <span style={{ fontSize: 60 }} aria-hidden="true">😅</span>
          )}
        </div>

        {/* Title */}
        <h2 className="sw-modal-title">
          {result.is_win ? "🎉 You Won!" : "Better Luck Tomorrow!"}
        </h2>

        {/* Prize details */}
        {result.is_win && (
          <div className="sw-modal-prize">
            <p className="sw-modal-prize-label">{result.label}</p>
            {result.type === "fixed"         && <p className="sw-modal-prize-val">{naira(result.value)} OFF</p>}
            {result.type === "percentage"    && <p className="sw-modal-prize-val">{result.value}% OFF</p>}
            {result.type === "free_shipping" && <p className="sw-modal-prize-val">🚚 Free Delivery</p>}
            {result.type === "airtime"       && <p className="sw-modal-prize-val">📱 {naira(result.value)} Airtime</p>}
          </div>
        )}

        {/* Spin type badge */}
        {result.spin_type && (
          <div className={`sw-modal-spin-type ${result.spin_type === "bonus" ? "bonus" : "free"}`}>
            {result.spin_type === "bonus" ? "🎁 Bonus Spin Used" : "⭐ Free Daily Spin"}
          </div>
        )}

        <p className="sw-modal-msg">{result.message}</p>

        {/* Coupon */}
        {result.coupon_code && (
          <div className="sw-modal-coupon">
            <p className="sw-modal-coupon-label">Your coupon code</p>
            <div className="sw-modal-coupon-row">
              <span className="sw-modal-coupon-code">{result.coupon_code}</span>
              <button
                className={`sw-modal-copy${copied ? " copied" : ""}`}
                onClick={handleCopy}
                aria-label={copied ? "Copied!" : "Copy coupon code"}
              >
                {copied ? "✓ Copied!" : "Copy"}
              </button>
            </div>
            {result.expires_in && (
              <p className="sw-modal-expires">Expires in {result.expires_in}</p>
            )}
          </div>
        )}

        {/* Bonus spins remaining */}
        {typeof result.spins_remaining === "number" && result.spins_remaining > 0 && (
          <div className="sw-modal-remaining" aria-live="polite">
            🎡 You have{" "}
            <strong>{result.spins_remaining}</strong>{" "}
            bonus spin{result.spins_remaining !== 1 ? "s" : ""} remaining!
          </div>
        )}

        {/* Share */}
        {result.is_win && (
          <button className="sw-modal-share" onClick={handleShare} aria-label="Share your win">
            📤 Share Your Win
          </button>
        )}

        <button
          className="sw-modal-close"
          onClick={onClose}
          aria-label={result.is_win ? "Close" : "Close dialog"}
        >
          {result.is_win ? "Awesome! 🎊" : "Try Tomorrow →"}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   HISTORY FILTERS
══════════════════════════════════════════════════════════════ */
const FILTERS = [
  { key: "all",    label: "All"        },
  { key: "wins",   label: "🏆 Wins"    },
  { key: "losses", label: "😅 Losses"  },
  { key: "bonus",  label: "🎁 Bonus"   },
  { key: "coupon", label: "🎟 Coupons" },
];

function filterHistory(history, filter) {
  switch (filter) {
    case "wins":   return history.filter((h) => h.is_win);
    case "losses": return history.filter((h) => !h.is_win);
    case "bonus":  return history.filter((h) => h.spin_type === "bonus");
    case "coupon": return history.filter((h) => !!h.coupon_code);
    default:       return history;
  }
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function SpinWheel() {
  const navigate = useNavigate();

  /* ── Data ── */
  const [segments,      setSegments]      = useState([]);
  const [spinStatus,    setSpinStatus]    = useState(null);
  const [history,       setHistory]       = useState([]);
  const [stats,         setStats]         = useState(null);
  const [referralSpins, setReferralSpins] = useState([]);

  /* ── UI ── */
  const [loading,     setLoading]     = useState(true);
  const [spinning,    setSpinning]    = useState(false);
  const [spinResult,  setSpinResult]  = useState(null);
  const [showResult,  setShowResult]  = useState(false);
  const [targetId,    setTargetId]    = useState(null);
  const [tab,         setTab]         = useState("wheel");
  const [histFilter,  setHistFilter]  = useState("all");
  const [bonusToast,  setBonusToast]  = useState(null);
  const [spinType,    setSpinType]    = useState("free");
  const [soundOn,     setSoundOn]     = useState(true);
  const [bigWin,      setBigWin]      = useState(false);
  const [shake,       setShake]       = useState(false);
  const [error,       setError]       = useState(null);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/spin");
  }, [navigate]);

  /* ── Sound mute sync ── */
  useEffect(() => { sound.muted = !soundOn; }, [soundOn]);

  /* ══════════════════════════════════════════════
     LOAD ALL DATA
  ══════════════════════════════════════════════ */
  const loadConfig = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const [configRes, historyRes, referralRes] = await Promise.all([
        fetch(`${API}/spinwheel/config`,         { headers: authH() }),
        fetch(`${API}/spinwheel/history`,         { headers: authH() }),
        fetch(`${API}/spinwheel/referral-spins`,  { headers: authH() }),
      ]);

      /* ── Handle 401 ── */
      if (configRes.status === 401) {
        navigate("/auth?redirect=/spin");
        return;
      }

      if (configRes.ok) {
        const d = await configRes.json();
        setSegments(d.segments    || []);
        setSpinStatus(d.spin_status || null);
      } else {
        const d = await configRes.json().catch(() => ({}));
        setError(d.message || "Failed to load wheel config.");
      }

      if (historyRes.ok) {
        const d = await historyRes.json();
        setHistory(d.history || []);
        setStats(d.stats    || null);
      }

      if (referralRes.ok) {
        const d = await referralRes.json();
        setReferralSpins(d.referral_spins || []);
      }

    } catch (err) {
      console.error("[SpinWheel] loadConfig:", err);
      setError("Could not connect. Check your internet.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  /* ══════════════════════════════════════════════
     POLL EVERY 90s FOR BONUS SPIN CHANGES
  ══════════════════════════════════════════════ */
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/spinwheel/config`, { headers: authH() });
        if (!res.ok) return;
        const d   = await res.json();
        const nxt = d.spin_status;
        if (!nxt) return;

        setSpinStatus((prev) => {
          const prevBonus = prev?.bonus_spins_remaining || 0;
          const nxtBonus  = nxt.bonus_spins_remaining   || 0;

          if (prev && nxtBonus > prevBonus) {
            const diff = nxtBonus - prevBonus;
            setBonusToast({
              spins_awarded : diff,
              referred_user : nxt.latest_referral_name || "Someone",
            });
          }

          return nxt;
        });
      } catch (_) {}
    }, 90_000);

    return () => clearInterval(interval);
  }, []);

  /* ══════════════════════════════════════════════
     COMPUTED VALUES
  ══════════════════════════════════════════════ */
  const canFreeSpin = spinStatus?.can_free_spin ?? spinStatus?.can_spin ?? false;
  const bonusLeft   = spinStatus?.bonus_spins_remaining || 0;
  const canSpin     = canFreeSpin || bonusLeft > 0;

  const currentSpinType = useCallback(() => {
    if (canFreeSpin) return "free";
    if (bonusLeft > 0) return "bonus";
    return null;
  }, [canFreeSpin, bonusLeft]);

  const totalSpinsAvailable = (canFreeSpin ? 1 : 0) + bonusLeft;

  const filteredHistory = useMemo(
    () => filterHistory(history, histFilter),
    [history, histFilter]
  );

  /* ── Tick sound handler ── */
  const handleTick = useCallback(() => { sound.tick(); }, []);

  /* ══════════════════════════════════════════════
     EXECUTE SPIN
  ══════════════════════════════════════════════ */
  const handleSpin = useCallback(async () => {
    if (spinning || !canSpin) return;

    sound.resume();
    sound.spinStart();

    const type = currentSpinType();
    if (!type) return;

    setSpinType(type);
    setSpinning(true);
    setSpinResult(null);
    setBigWin(false);

    try {
      const res  = await fetch(`${API}/spinwheel/spin`, {
        method  : "POST",
        headers : authH(),
        body    : JSON.stringify({ spin_type: type }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Could not spin. Please try again.");
        setSpinning(false);
        return;
      }

      /* Set wheel target */
      setTargetId(data.segment_id);

      /* Attach spin_type to result */
      setSpinResult({ ...data.result, spin_type: type });

      /* Optimistic update of spin status */
      setSpinStatus((prev) => {
        if (!prev) return prev;
        const u = { ...prev };
        if (type === "free") {
          u.can_free_spin = false;
          u.can_spin      = false;
        } else {
          u.bonus_spins_remaining = Math.max(0, (u.bonus_spins_remaining || 0) - 1);
        }
        return u;
      });

    } catch {
      alert("Network error. Please try again.");
      setSpinning(false);
    }
  }, [spinning, canSpin, currentSpinType]);

  /* ══════════════════════════════════════════════
     WHEEL ANIMATION FINISHED
  ══════════════════════════════════════════════ */
  const handleSpinEnd = useCallback(() => {
    setSpinning(false);

    if (spinResult?.is_win) {
      const big = isBigWin(spinResult);
      setBigWin(big);

      setShake(true);
      setTimeout(() => setShake(false), 600);

      sound.win();
      fireConfetti(big);

      if (big && "vibrate" in navigator) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }
    } else {
      sound.lose();
    }

    setTimeout(() => {
      setShowResult(true);
      loadConfig(true); // silent refresh
    }, 400);
  }, [spinResult, loadConfig]);

  const closeResult = useCallback(() => {
    setShowResult(false);
    setSpinResult(null);
    setTargetId(null);
    setBigWin(false);
  }, []);

  /* ── Spin button label ── */
  const spinBtnLabel = () => {
    if (spinning)   return <><span className="sw-btn-spinner" aria-hidden="true" /> Spinning…</>;
    if (!canSpin)   return `Come back in ${spinStatus?.next_spin_in || "..."}`;
    const type = currentSpinType();
    if (type === "free")  return "⭐ SPIN NOW! (Free)";
    if (type === "bonus") return `🎁 SPIN NOW! (${bonusLeft} bonus left)`;
    return "No Spins Available";
  };

  const wheelSize = Math.min(
    typeof window !== "undefined" ? window.innerWidth - 48 : 320,
    320
  );

  /* ══════════════════════════════════════════════
     ERROR STATE
  ══════════════════════════════════════════════ */
  if (!loading && error) {
    return (
      <div className="sw-page">
        <div className="sw-error-state" role="alert">
          <span aria-hidden="true">⚠️</span>
          <p>{error}</p>
          <button
            onClick={() => loadConfig()}
            className="sw-error-retry"
            aria-label="Retry loading"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="sw-page">

      {/* ── Bonus toast ── */}
      <BonusSpinToast
        bonus={bonusToast}
        onClose={() => setBonusToast(null)}
      />

      {/* ══════════════════════════════════════════
          TOPBAR
      ══════════════════════════════════════════ */}
      <div className="sw-topbar">
        <button
          className="sw-back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
            aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>

        <div>
          <h1 className="sw-topbar-title">🎡 Spin &amp; Win</h1>
          <p className="sw-topbar-sub">
            {totalSpinsAvailable > 0
              ? `${totalSpinsAvailable} spin${totalSpinsAvailable > 1 ? "s" : ""} available`
              : "1 free spin per day"}
          </p>
        </div>

        {/* Sound toggle */}
        <button
          className="sw-sound-btn"
          onClick={() => setSoundOn((s) => !s)}
          aria-label={soundOn ? "Mute sounds" : "Unmute sounds"}
        >
          {soundOn ? "🔊" : "🔇"}
        </button>

        {/* Wins count */}
        <div className="sw-topbar-stats">
          {stats && (
            <div className="sw-topbar-win-rate" aria-label={`${stats.total_wins} wins`}>
              <span>{stats.total_wins}</span>
              <small>wins</small>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          NAV TABS
      ══════════════════════════════════════════ */}
      <nav className="sw-nav" aria-label="Spin wheel sections">
        {[
          { key: "wheel",     label: "🎡 Spin",      count: totalSpinsAvailable },
          { key: "history",   label: "📋 History",   count: history.length       },
          { key: "referrals", label: "🎁 Referrals", count: referralSpins.length },
        ].map((t) => (
          <button
            key={t.key}
            className={`sw-nav-btn${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}
            aria-selected={tab === t.key}
            aria-label={t.label}
          >
            {t.label}
            {t.count > 0 && (
              <span className="sw-nav-count" aria-hidden="true">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="sw-scroll">

        {/* ════════════════════════════════════════
            WHEEL TAB
        ════════════════════════════════════════ */}
        {tab === "wheel" && (
          <>
            {/* Spin counter */}
            <SpinCounterBadge spinStatus={spinStatus} />

            {/* Countdown */}
            {!canSpin && spinStatus?.next_spin_seconds && (
              <CountdownTimer secondsLeft={spinStatus.next_spin_seconds} />
            )}

            {/* Streak */}
            {(stats?.streak || spinStatus?.streak || 0) > 0 && (
              <div className="sw-streak">
                <span className="sw-streak-icon" aria-hidden="true">🔥</span>
                <div className="sw-streak-body">
                  <p className="sw-streak-title">Spin Streak!</p>
                  <p className="sw-streak-sub">Keep spinning daily to maintain your streak</p>
                </div>
                <div
                  className="sw-streak-days"
                  aria-label={`${stats?.streak || spinStatus?.streak} day streak`}
                >
                  {stats?.streak || spinStatus?.streak || 0}
                  <small>days</small>
                </div>
              </div>
            )}

            {/* No spins banner */}
            {spinStatus && !canSpin && (
              <div className="sw-status-banner" role="status">
                <span aria-hidden="true">⏰</span>
                <div>
                  <p>Next spin in <strong>{spinStatus.next_spin_in}</strong></p>
                  <small>Invite friends to earn bonus spins instantly!</small>
                </div>
              </div>
            )}

            {/* Free spin ready */}
            {canFreeSpin && (
              <div className="sw-ready-banner" role="status">
                <span aria-hidden="true">✨</span>
                <p>Your free spin is ready!</p>
              </div>
            )}

            {/* Bonus spins available */}
            {bonusLeft > 0 && (
              <div className="sw-bonus-banner" role="status">
                <span aria-hidden="true">🎁</span>
                <div>
                  <p>
                    You have{" "}
                    <strong>
                      {bonusLeft} bonus spin{bonusLeft > 1 ? "s" : ""}
                    </strong>{" "}
                    from referrals!
                  </p>
                  <small>These don't expire — use them any time</small>
                </div>
              </div>
            )}

            {/* Wheel */}
            <div className="sw-wheel-wrap">
              <div
                className={`sw-pointer${canSpin && !spinning ? " sw-pointer--ready" : ""}`}
                aria-hidden="true"
              >
                ▼
              </div>

              <div className={`sw-canvas-outer${shake ? " shake" : ""}`}>
                <div
                  className={`sw-canvas-wrap${bigWin ? " sw-canvas-wrap--big-win" : ""}`}
                  style={{ width: wheelSize, height: wheelSize }}
                >
                  {loading ? (
                    <div
                      className="sw-canvas-loading"
                      style={{ width: wheelSize, height: wheelSize }}
                    >
                      <div
                        className="sw-sk-wheel"
                        style={{ width: wheelSize, height: wheelSize }}
                      />
                    </div>
                  ) : (
                    <WheelCanvas
                      segments={segments}
                      targetSegmentId={targetId}
                      spinning={spinning}
                      onSpinEnd={handleSpinEnd}
                      onTick={handleTick}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Spin button */}
            <button
              className={[
                "sw-spin-btn",
                spinning                          ? "sw-spin-btn--spinning" : "",
                !canSpin                          ? "sw-spin-btn--disabled" : "",
                canSpin && !spinning              ? "sw-spin-btn--pulse"    : "",
                spinType === "bonus" && !spinning ? "sw-spin-btn--bonus"    : "",
              ].filter(Boolean).join(" ")}
              onClick={handleSpin}
              disabled={spinning || !canSpin || loading}
              aria-label={
                spinning         ? "Spinning…"           :
                !canSpin         ? "No spins available"   :
                spinType === "bonus" ? "Use bonus spin"   :
                "Spin the wheel for free"
              }
            >
              {spinBtnLabel()}
            </button>

            {/* Earn more CTA */}
            <Link
              to="/invite"
              className="sw-earn-more"
              aria-label="Invite friends to earn bonus spins"
            >
              <span className="sw-earn-more-icon" aria-hidden="true">🚀</span>
              <div className="sw-earn-more-body">
                <p className="sw-earn-more-title">Want more spins?</p>
                <p className="sw-earn-more-sub">
                  Invite a friend → they sign up → you get{" "}
                  <strong>+1 bonus spin</strong> instantly!
                </p>
              </div>
              <span className="sw-earn-more-btn" aria-hidden="true">Invite →</span>
            </Link>

            {/* Prizes grid */}
            <div className="sw-prizes">
              <h2 className="sw-prizes-title">🎁 Prizes You Can Win</h2>
              <div className="sw-prizes-grid" role="list">
                {segments.map((seg) => (
                  <div
                    key={seg.id}
                    className="sw-prize-item"
                    role="listitem"
                    style={{ background: seg.bg, borderColor: seg.color + "44" }}
                  >
                    <span className="sw-prize-emoji" aria-hidden="true">
                      {seg.emoji}
                    </span>
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
                "Earn +1 bonus spin for every friend who signs up with your invite code",
                "Bonus spins never expire and stack up to 10",
                "Coupons expire 30 days after winning",
                "Airtime credited within 24 hours",
                "Each coupon can only be used once",
                "Prizes are non-transferable",
                "Loemart reserves the right to cancel rewards from fraudulent activity",
              ].map((rule, i) => (
                <div key={i} className="sw-rule">
                  <span aria-hidden="true">•</span>
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════
            HISTORY TAB
        ════════════════════════════════════════ */}
        {tab === "history" && (
          <>
            {/* Stats row */}
            {stats && (
              <div className="sw-hist-stats" role="region" aria-label="Spin statistics">
                {[
                  { label: "Total Spins", val: stats.total_spins,          color: "#fff"    },
                  { label: "Wins",        val: stats.total_wins,           color: "#16a34a" },
                  { label: "Win Rate",    val: `${stats.win_rate}%`,       color: "#e8630a" },
                  { label: "Bonus Used",  val: stats.bonus_spins_used || 0, color: "#6366f1" },
                ].map((s) => (
                  <div key={s.label} className="sw-hist-stat">
                    <p className="sw-hist-stat-val" style={{ color: s.color }}>
                      {s.val}
                    </p>
                    <p className="sw-hist-stat-label">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Filters */}
            <div className="sw-hist-filters" role="group" aria-label="Filter spin history">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  className={`sw-hist-filter-btn${histFilter === f.key ? " active" : ""}`}
                  onClick={() => setHistFilter(f.key)}
                  aria-pressed={histFilter === f.key}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* History list */}
            {filteredHistory.length === 0 ? (
              <div className="sw-empty">
                <span aria-hidden="true">🎡</span>
                <p>No spins match this filter</p>
                <small>Try a different filter or spin the wheel!</small>
                <button
                  className="sw-empty-btn"
                  onClick={() => setTab("wheel")}
                  aria-label="Go to spin wheel"
                >
                  Go Spin →
                </button>
              </div>
            ) : (
              <div className="sw-hist-list" role="list">
                {filteredHistory.map((h) => (
                  <div key={h.id} className="sw-hist-item" role="listitem">
                    {/* Icon */}
                    <div
                      className="sw-hist-icon"
                      style={{
                        background : h.is_win ? "#f0fdf4" : "#f3f4f6",
                        color      : h.is_win ? "#16a34a" : "#9ca3af",
                        fontSize   : 20,
                      }}
                      aria-hidden="true"
                    >
                      {h.is_win ? "🎉" : "😅"}
                    </div>

                    {/* Info */}
                    <div className="sw-hist-info">
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <p className="sw-hist-label">{h.label}</p>
                        {h.spin_type === "bonus" && (
                          <span className="sw-hist-bonus-tag" aria-label="Bonus spin">
                            🎁 Bonus
                          </span>
                        )}
                      </div>
                      {h.coupon_code && (
                        <p className="sw-hist-code">Code: {h.coupon_code}</p>
                      )}
                      <p className="sw-hist-date">{timeAgo(h.spun_at)}</p>
                    </div>

                    {/* Result */}
                    <div className="sw-hist-result">
                      {h.type === "fixed"         && <span className="sw-hist-win">{naira(h.value)} OFF</span>}
                      {h.type === "percentage"    && <span className="sw-hist-win">{h.value}% OFF</span>}
                      {h.type === "free_shipping" && <span className="sw-hist-win">🚚 Free</span>}
                      {h.type === "airtime"       && <span className="sw-hist-win">📱 {naira(h.value)}</span>}
                      {h.type === "none"          && <span className="sw-hist-miss">Try Again</span>}
                    </div>

                    {/* Share win */}
                    {h.is_win && (
                      <button
                        className="sw-hist-share"
                        aria-label={`Share your ${h.label} win`}
                        onClick={() => {
                          const txt = `🎉 I just won ${h.label} on Loemart Spin & Win!`;
                          navigator.share
                            ? navigator.share({ title: "Loemart Win!", text: txt })
                            : navigator.clipboard.writeText(txt);
                        }}
                      >
                        📤
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════
            REFERRALS TAB
        ════════════════════════════════════════ */}
        {tab === "referrals" && (
          <>
            {/* Summary stats */}
            <div className="sw-ref-summary" role="region" aria-label="Referral summary">
              <div className="sw-ref-summary-row">
                {[
                  {
                    val   : referralSpins.length,
                    label : "Friends Joined",
                    color : "#fff",
                  },
                  {
                    val   : referralSpins.reduce((a, r) => a + (r.spins_awarded || 0), 0),
                    label : "Bonus Spins Earned",
                    color : "#e8630a",
                  },
                  {
                    val   : bonusLeft,
                    label : "Spins Remaining",
                    color : "#6366f1",
                  },
                ].map((s, i, arr) => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center" }}>
                    <div className="sw-ref-summary-stat">
                      <span className="sw-ref-summary-val" style={{ color: s.color }}>
                        {s.val}
                      </span>
                      <span className="sw-ref-summary-label">{s.label}</span>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="sw-ref-summary-divider" aria-hidden="true" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* How it works */}
            <div className="sw-how-it-works">
              <h3 className="sw-how-title">How Bonus Spins Work</h3>
              {[
                { step: "1", icon: "📤", text: "Share your invite code from the Invite Friends page" },
                { step: "2", icon: "👤", text: "Your friend signs up using your code"                },
                { step: "3", icon: "✅", text: "They verify their email address"                    },
                { step: "4", icon: "🎡", text: "You instantly receive +1 bonus spin!"               },
              ].map((item) => (
                <div key={item.step} className="sw-how-step">
                  <div className="sw-how-step-num" aria-hidden="true">{item.step}</div>
                  <span style={{ fontSize: 20 }} aria-hidden="true">{item.icon}</span>
                  <p className="sw-how-step-text">{item.text}</p>
                </div>
              ))}
            </div>

            {/* Referral list */}
            <ReferralSpinsPanel referralSpins={referralSpins} />

            {referralSpins.length === 0 && (
              <div className="sw-empty">
                <span aria-hidden="true">🎁</span>
                <p>No referral spins yet</p>
                <small>Invite friends to earn bonus spins!</small>
                <Link to="/invite" className="sw-empty-invite-btn">
                  Go to Invite Page →
                </Link>
              </div>
            )}

            {/* CTA */}
            <Link
              to="/invite"
              className="sw-ref-cta"
              aria-label="Invite more friends to earn bonus spins"
            >
              <span aria-hidden="true">📤</span>
              <div style={{ flex: 1 }}>
                <p className="sw-ref-cta-title">Invite More Friends</p>
                <p className="sw-ref-cta-sub">Each signup = +1 bonus spin for you</p>
              </div>
              <span style={{ color: "#e8630a", fontSize: 18 }} aria-hidden="true">→</span>
            </Link>
          </>
        )}

        <p className="sw-footer">
          © {new Date().getFullYear()} Loemart — Spin responsibly!
        </p>

      </div>

      {/* ── Result modal ── */}
      {showResult && spinResult && (
        <ResultModal result={spinResult} onClose={closeResult} />
      )}

    </div>
  );
}
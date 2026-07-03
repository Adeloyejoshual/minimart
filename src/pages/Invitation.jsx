// src/pages/Invitation.jsx

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
}                         from "react";
import { useNavigate, Link } from "react-router-dom";
import { QRCodeCanvas }   from "qrcode.react";
import {
  FaCopy, FaShareAlt, FaWhatsapp, FaFacebookF,
  FaTelegramPlane, FaTwitter, FaCheckCircle,
  FaUserPlus, FaGift, FaEdit, FaSave,
  FaPaperPlane, FaHourglassHalf, FaTrophy,
  FaInfoCircle, FaArrowLeft, FaLink,
}                         from "react-icons/fa";
import "../styles/Invitation.css";

/* ═══════════════════════════════════════════════════════════════
   ENV
═══════════════════════════════════════════════════════════════ */
const APP_URL  = import.meta.env.VITE_APP_URL  || "https://loemart.com";
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

/* ═══════════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") || null;

const authH = () => ({
  Authorization : `Bearer ${getToken()}`,
  "Content-Type": "application/json",
});

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 60)     return "just now";
  if (s < 3_600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
};

const avatarColors = [
  "#2563eb","#10b981","#f59e0b","#8b5cf6",
  "#ef4444","#0891b2","#e8630a","#059669",
];

const colorFor = (str = "") =>
  avatarColors[
    [...str].reduce((a, c) => a + c.charCodeAt(0), 0) % avatarColors.length
  ];

const initialsOf = (name = "") =>
  name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

/* ═══════════════════════════════════════════════════════════════
   BADGE CONFIG
═══════════════════════════════════════════════════════════════ */
const BADGE = {
  joined    : { label: "Joined",          cls: "badge-joined",    icon: <FaCheckCircle    size={10}/> },
  pending   : { label: "Pending",         cls: "badge-pending",   icon: <FaHourglassHalf  size={10}/> },
  completed : { label: "First Listing ✓", cls: "badge-completed", icon: <FaTrophy          size={10}/> },
};

/* ═══════════════════════════════════════════════════════════════
   MOCK API  — replace with real fetch calls
═══════════════════════════════════════════════════════════════ */
const mockFetchReferralStats = async () => {
  await new Promise((r) => setTimeout(r, 900));
  return {
    invitesSent      : 14,
    successfulSignups: 7,
    pendingInvites   : 3,
    rewardsEarned    : "₦3,500",
  };
};

const mockFetchInviteHistory = async () => {
  await new Promise((r) => setTimeout(r, 1_100));
  return [
    { id: 1, name: "John Eze",    createdAt: new Date(Date.now() - 86_400_000).toISOString(),  status: "joined"    },
    { id: 2, name: "Mary Okafor", createdAt: new Date(Date.now() - 172_800_000).toISOString(), status: "pending"   },
    { id: 3, name: "David Bello", createdAt: new Date(Date.now() - 604_800_000).toISOString(), status: "completed" },
    { id: 4, name: "Amaka Uche",  createdAt: new Date(Date.now() - 1_209_600_000).toISOString(),status: "joined"   },
    { id: 5, name: "Chidi Nwosu", createdAt: new Date(Date.now() - 2_592_000_000).toISOString(),status: "pending"  },
  ];
};

/* ═══════════════════════════════════════════════════════════════
   STATS CONFIG
═══════════════════════════════════════════════════════════════ */
const STATS_CONFIG = [
  { key: "invitesSent",       label: "Invites Sent",        icon: <FaPaperPlane  />, color: "#2563eb", bg: "#eff6ff" },
  { key: "successfulSignups", label: "Successful Sign-ups", icon: <FaUserPlus    />, color: "#10b981", bg: "#ecfdf5" },
  { key: "pendingInvites",    label: "Pending Invites",     icon: <FaHourglassHalf/>, color: "#f59e0b", bg: "#fffbeb" },
  { key: "rewardsEarned",     label: "Rewards Earned",      icon: <FaGift        />, color: "#8b5cf6", bg: "#f5f3ff" },
];

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function Invitation() {
  const navigate = useNavigate();

  /* ── Auth / user ── */
  /* Replace this block with your real auth context, e.g:
     const { user } = useAuth();                         */
  const [user] = useState({
    username     : "JOSHUA247",
    referralCode : "JOSHUA247",
    displayName  : "Joshua",
  });

  /* ── Derived invite data ── */
  const inviteCode = user?.referralCode || user?.username || "—";
  const inviteLink = `${APP_URL}/invite/${inviteCode}`;

  const defaultMessage =
    `Join me on Loemart — the smart marketplace for buying and selling everything ` +
    `from phones and electronics to fashion, vehicles, property, and more.\n\n` +
    `Use my invitation code: ${inviteCode}\n\nSign up here:\n${inviteLink}\n\nSee you on Loemart! 🚀`;

  /* ── State ── */
  const [message,   setMessage]   = useState(defaultMessage);
  const [isEditing, setIsEditing] = useState(false);
  const [copied,    setCopied]    = useState({ code: false, link: false, msg: false });
  const [toast,     setToast]     = useState({ show: false, text: "" });

  const [stats,       setStats]       = useState(null);
  const [statsLoad,   setStatsLoad]   = useState(true);
  const [history,     setHistory]     = useState([]);
  const [histLoad,    setHistLoad]    = useState(true);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/invite");
  }, [navigate]);

  /* ── Fetch data ── */
  useEffect(() => {
    mockFetchReferralStats()
      .then(setStats)
      .finally(() => setStatsLoad(false));

    mockFetchInviteHistory()
      .then(setHistory)
      .finally(() => setHistLoad(false));

    /* Real API example:
    fetch(`${API}/referrals/stats`,   { headers: authH() })
      .then(r => r.json()).then(d => setStats(d))
      .finally(() => setStatsLoad(false));

    fetch(`${API}/referrals/history`, { headers: authH() })
      .then(r => r.json()).then(d => setHistory(d.history || []))
      .finally(() => setHistLoad(false));
    */
  }, []);

  /* ── Toast ── */
  const showToast = useCallback((text) => {
    setToast({ show: true, text });
    setTimeout(() => setToast({ show: false, text: "" }), 2_500);
  }, []);

  /* ── Copy ── */
  const handleCopy = useCallback(
    (text, type, label) => {
      navigator.clipboard.writeText(text).catch(() => {});
      setCopied((p) => ({ ...p, [type]: true }));
      showToast(`✅ ${label} copied`);
      setTimeout(() => setCopied((p) => ({ ...p, [type]: false })), 2_200);
    },
    [showToast]
  );

  /* ── Share ── */
  const openUrl = (url) => window.open(url, "_blank", "noopener,noreferrer");

  const handleNativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join Loemart",
          text : "Buy and sell anything on Loemart.",
          url  : inviteLink,
        });
      } else {
        handleCopy(inviteLink, "link", "Invite link");
      }
    } catch (_) {}
  };

  const shareOnWhatsApp = () =>
    openUrl(`https://wa.me/?text=${encodeURIComponent(message)}`);
  const shareOnFacebook = () =>
    openUrl(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteLink)}`);
  const shareOnTwitter = () =>
    openUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`);
  const shareOnTelegram = () =>
    openUrl(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(message)}`);

  /* ── QR download ── */
  const downloadQR = () => {
    const canvas = document.getElementById("loemart-invite-qr");
    if (!canvas) return;
    const link    = document.createElement("a");
    link.download = `loemart-invite-${inviteCode}.png`;
    link.href     = canvas.toDataURL("image/png");
    link.click();
    showToast("📥 QR code downloaded");
  };

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */
  return (
    <div className="inv-page">
      <div className="inv-container">

        {/* ── Toast ── */}
        <div
          className={`inv-toast${toast.show ? " show" : ""}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {toast.text}
        </div>

        {/* ── Topbar ── */}
        <div className="inv-topbar">
          <button
            className="inv-back-btn"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <FaArrowLeft size={16} aria-hidden="true" />
          </button>
          <div>
            <p className="inv-topbar-title">Invite Friends</p>
            <p className="inv-topbar-sub">Earn bonus spins &amp; rewards</p>
          </div>
        </div>

        {/* ═══════════════════════════════════════
            HEADER
        ═══════════════════════════════════════ */}
        <div className="inv-header">
          <div className="inv-header-icon" aria-hidden="true">
            <FaUserPlus size={28} color="#fff" />
          </div>
          <h1>Invite Friends</h1>
          <p>
            Share Loemart with your friends and family. When they join using your
            invitation, you'll both become part of a trusted marketplace where
            buying and selling is simple, fast, and secure.
          </p>
        </div>

        {/* ═══════════════════════════════════════
            INFO BANNER
        ═══════════════════════════════════════ */}
        <div className="inv-info-banner" role="note">
          <FaInfoCircle size={18} style={{ flexShrink: 0 }} aria-hidden="true" />
          <span>
            Invite your friends to join Loemart and help grow our marketplace.
            Each successful signup earns you{" "}
            <strong>+1 bonus spin</strong> on the Spin &amp; Win wheel!{" "}
            <Link to="/spin" style={{ color: "#1e40af", fontWeight: 700 }}>
              Go spin →
            </Link>
          </span>
        </div>

        {/* ═══════════════════════════════════════
            INVITE CODE
        ═══════════════════════════════════════ */}
        <div className="inv-card">
          <h2 className="inv-card-title">
            <FaGift size={16} color="#2563eb" aria-hidden="true" />
            Your Invite Code
          </h2>
          <div
            className="inv-code-box"
            role="group"
            aria-label={`Your invite code is ${inviteCode}`}
          >
            <span className="inv-code-text" aria-label={`Invite code: ${inviteCode}`}>
              {inviteCode}
            </span>
            <button
              className={`inv-copy-btn${copied.code ? " copied" : ""}`}
              onClick={() => handleCopy(inviteCode, "code", "Invite code")}
              aria-label={copied.code ? "Invite code copied" : "Copy invite code"}
            >
              {copied.code
                ? <><FaCheckCircle size={13} aria-hidden="true" /> Copied</>
                : <><FaCopy size={13} aria-hidden="true" /> Copy Code</>}
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════
            INVITE LINK + SHARE
        ═══════════════════════════════════════ */}
        <div className="inv-card">
          <h2 className="inv-card-title">
            <FaLink size={14} color="#2563eb" aria-hidden="true" />
            Your Invite Link
          </h2>

          {/* Link row */}
          <div className="inv-link-box" aria-label={`Your invite link: ${inviteLink}`}>
            <span className="inv-link-text" aria-hidden="true">{inviteLink}</span>
            <button
              className={`inv-copy-btn${copied.link ? " copied" : ""}`}
              onClick={() => handleCopy(inviteLink, "link", "Invite link")}
              aria-label={copied.link ? "Invite link copied" : "Copy invite link"}
            >
              {copied.link
                ? <><FaCheckCircle size={13} aria-hidden="true" /> Copied</>
                : <><FaCopy size={13} aria-hidden="true" /> Copy</>}
            </button>
          </div>

          {/* Share grid */}
          <div className="inv-share-grid" role="group" aria-label="Share via">
            <button
              className="inv-share-btn btn-share"
              onClick={handleNativeShare}
              aria-label="Share invite link"
            >
              <FaShareAlt size={14} aria-hidden="true" /> Share
            </button>
            <button
              className="inv-share-btn btn-whatsapp"
              onClick={shareOnWhatsApp}
              aria-label="Share on WhatsApp"
            >
              <FaWhatsapp size={15} aria-hidden="true" /> WhatsApp
            </button>
            <button
              className="inv-share-btn btn-facebook"
              onClick={shareOnFacebook}
              aria-label="Share on Facebook"
            >
              <FaFacebookF size={14} aria-hidden="true" /> Facebook
            </button>
            <button
              className="inv-share-btn btn-twitter"
              onClick={shareOnTwitter}
              aria-label="Share on Twitter"
            >
              <FaTwitter size={14} aria-hidden="true" /> Twitter
            </button>
            <button
              className="inv-share-btn btn-telegram"
              onClick={shareOnTelegram}
              aria-label="Share on Telegram"
              style={{ gridColumn: "span 1" }}
            >
              <FaTelegramPlane size={14} aria-hidden="true" /> Telegram
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════
            INVITATION MESSAGE
        ═══════════════════════════════════════ */}
        <div className="inv-card">
          <div className="inv-msg-header">
            <h2 className="inv-card-title" style={{ marginBottom: 0 }}>
              Invitation Message
            </h2>
            <button
              className="inv-edit-btn"
              onClick={() => setIsEditing((e) => !e)}
              aria-label={isEditing ? "Save message" : "Edit message"}
              aria-pressed={isEditing}
            >
              {isEditing
                ? <><FaSave size={12} aria-hidden="true" /> Save</>
                : <><FaEdit size={12} aria-hidden="true" /> Edit</>}
            </button>
          </div>

          {isEditing ? (
            <textarea
              className="inv-msg-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              aria-label="Edit invitation message"
            />
          ) : (
            <div
              className="inv-msg-preview"
              aria-label="Invitation message preview"
            >
              {message.split("\n").map((line, i) => (
                <span key={i}>{line}<br /></span>
              ))}
            </div>
          )}

          <button
            className="inv-copy-msg-btn"
            onClick={() => handleCopy(message, "msg", "Message")}
            aria-label="Copy invitation message"
          >
            <FaCopy size={13} aria-hidden="true" /> Copy Message
          </button>
        </div>

        {/* ═══════════════════════════════════════
            QR CODE
        ═══════════════════════════════════════ */}
        <div className="inv-card">
          <h2 className="inv-card-title">
            QR Code
          </h2>
          <p className="inv-qr-sub">
            Let friends scan this to join Loemart instantly
          </p>

          <div className="inv-qr-box" aria-label={`QR code for invite link ${inviteLink}`}>
            <QRCodeCanvas
              id="loemart-invite-qr"
              value={inviteLink}
              size={180}
              includeMargin
              bgColor="#ffffff"
              fgColor="#1e3a5f"
              aria-label="Invite QR code"
            />
            <p className="inv-qr-note">Scan to join · {inviteLink}</p>
          </div>

          <button
            className="inv-download-btn"
            onClick={downloadQR}
            aria-label="Download QR code as image"
          >
            📥 Download QR Code
          </button>
        </div>

        {/* ═══════════════════════════════════════
            REFERRAL STATS
        ═══════════════════════════════════════ */}
        <div className="inv-card">
          <h2 className="inv-card-title">
            📊 Your Referral Stats
          </h2>

          {statsLoad ? (
            <div className="inv-loading" aria-busy="true" aria-label="Loading stats">
              <div className="inv-spinner" />
              <span>Loading stats…</span>
            </div>
          ) : (
            <div className="inv-stats-grid" role="list" aria-label="Referral statistics">
              {STATS_CONFIG.map((s) => (
                <div
                  key={s.key}
                  className="inv-stat-card"
                  role="listitem"
                  style={{ backgroundColor: s.bg }}
                  aria-label={`${s.label}: ${stats?.[s.key] ?? "—"}`}
                >
                  <div className="inv-stat-icon" style={{ color: s.color }} aria-hidden="true">
                    {s.icon}
                  </div>
                  <div className="inv-stat-value" style={{ color: s.color }}>
                    {stats?.[s.key] ?? "—"}
                  </div>
                  <div className="inv-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════
            HOW IT WORKS
        ═══════════════════════════════════════ */}
        <div className="inv-card">
          <h2 className="inv-card-title">
            🚀 How It Works
          </h2>
          <div className="inv-how-wrap">
            {[
              {
                title : "Share your invite code",
                sub   : "Copy your code or link and share it with friends",
                icon  : "📤",
              },
              {
                title : "Friend signs up",
                sub   : "They create an account using your invite code",
                icon  : "👤",
              },
              {
                title : "They verify their email",
                sub   : "Email verification confirms the referral",
                icon  : "✅",
              },
              {
                title : "You earn a bonus spin",
                sub   : "Instantly receive +1 spin on the Spin & Win wheel",
                icon  : "🎡",
              },
            ].map((step, i) => (
              <div key={i} className="inv-how-step">
                <div className="inv-how-num" aria-hidden="true">{i + 1}</div>
                <span style={{ fontSize: 20 }} aria-hidden="true">{step.icon}</span>
                <div className="inv-how-content">
                  <p className="inv-how-title">{step.title}</p>
                  <p className="inv-how-sub">{step.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════
            INVITE HISTORY
        ═══════════════════════════════════════ */}
        <div className="inv-card">
          <h2 className="inv-card-title">
            🕐 Recent Invitations
          </h2>

          {histLoad ? (
            <div className="inv-loading" aria-busy="true" aria-label="Loading invite history">
              <div className="inv-spinner" />
              <span>Loading history…</span>
            </div>
          ) : history.length === 0 ? (
            <div className="inv-empty" aria-label="No invitations sent yet">
              <div className="inv-empty-icon" aria-hidden="true">📭</div>
              <p>No invitations sent yet</p>
              <span>Share your code above to get started!</span>
            </div>
          ) : (
            <div className="inv-history-list" role="list" aria-label="Invite history">
              {history.map((item) => {
                const badge  = BADGE[item.status] || BADGE.pending;
                const color  = colorFor(item.name);
                const inits  = initialsOf(item.name);

                return (
                  <div
                    key={item.id}
                    className="inv-history-item"
                    role="listitem"
                    aria-label={`${item.name} — ${badge.label}`}
                  >
                    <div
                      className="inv-history-avatar"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    >
                      {inits}
                    </div>
                    <div className="inv-history-info">
                      <p className="inv-history-name">{item.name}</p>
                      <p className="inv-history-status">{timeAgo(item.createdAt)}</p>
                    </div>
                    <span className={`inv-history-badge ${badge.cls}`} aria-label={badge.label}>
                      {badge.icon} {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Terms */}
          <div className="inv-terms">
            Referral rewards are credited only after a referred user creates an account
            and meets the eligibility requirements.{" "}
            <Link to="/terms">Learn more</Link>
          </div>
        </div>

        {/* ═══════════════════════════════════════
            SPIN CTA
        ═══════════════════════════════════════ */}
        <Link
          to="/spin"
          style={{
            display         : "flex",
            alignItems      : "center",
            gap             : "14px",
            padding         : "18px 20px",
            background      : "linear-gradient(135deg, #1e3a5f, #2563eb)",
            borderRadius    : "16px",
            textDecoration  : "none",
            color           : "#fff",
            marginBottom    : "16px",
            boxShadow       : "0 4px 20px rgba(37,99,235,.3)",
            transition      : "opacity .15s",
          }}
          aria-label="Go to Spin and Win wheel"
          onMouseEnter={(e) => (e.currentTarget.style.opacity = ".9")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <span style={{ fontSize: 36 }} aria-hidden="true">🎡</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, fontSize: 15, margin: "0 0 3px" }}>
              Use Your Bonus Spins
            </p>
            <p style={{ fontSize: 12, opacity: .8, margin: 0 }}>
              Each referral signup = +1 free spin on the wheel
            </p>
          </div>
          <span style={{ fontSize: 20, opacity: .7 }} aria-hidden="true">→</span>
        </Link>

        {/* ── Footer ── */}
        <div className="inv-footer">
          The more friends you invite, the bigger Loemart grows! 🚀
          <br />
          <span style={{ fontSize: 12 }}>
            © {new Date().getFullYear()} Loemart · All rights reserved
          </span>
        </div>

      </div>
    </div>
  );
}
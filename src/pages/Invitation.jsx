// src/pages/Invitation.jsx

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { QRCodeCanvas }      from "qrcode.react";
import {
  FaCopy, FaShareAlt, FaWhatsapp, FaFacebookF,
  FaTelegramPlane, FaTwitter, FaCheckCircle,
  FaUserPlus, FaGift, FaEdit, FaSave,
  FaPaperPlane, FaHourglassHalf, FaTrophy,
  FaInfoCircle, FaArrowLeft, FaLink,
} from "react-icons/fa";
import "../styles/Invitation.css";

/* ═══════════════════════════════════════════════════
   ENV
═══════════════════════════════════════════════════ */
const APP_URL  = import.meta.env.VITE_APP_URL      || "https://loemart.com";
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

/* ═══════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") || null;

const authH = () => ({
  Authorization  : `Bearer ${getToken()}`,
  "Content-Type" : "application/json",
});

/* ═══════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════ */
const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 60)     return "just now";
  if (s < 3_600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
};

/* ═══════════════════════════════════════════════════
   STATUS BADGES
═══════════════════════════════════════════════════ */
const STATUS = {
  pending  : { label: "Pending",  cls: "badge-pending",   icon: <FaHourglassHalf size={10} /> },
  verified : { label: "Verified", cls: "badge-verified",  icon: <FaCheckCircle   size={10} /> },
  rewarded : { label: "Rewarded", cls: "badge-rewarded",  icon: <FaTrophy        size={10} /> },
  rejected : { label: "Rejected", cls: "badge-rejected",  icon: null },
};

/* ═══════════════════════════════════════════════════
   STATS CONFIG
═══════════════════════════════════════════════════ */
const STATS = [
  { key: "total_invites",         label: "Total Invites",   icon: <FaPaperPlane />,    color: "#2563eb", bg: "#eff6ff" },
  { key: "successful_signups",    label: "Sign-ups",        icon: <FaUserPlus />,      color: "#10b981", bg: "#ecfdf5" },
  { key: "pending_invites",       label: "Pending",         icon: <FaHourglassHalf />, color: "#f59e0b", bg: "#fffbeb" },
  { key: "bonus_spins_remaining", label: "Spins Left",      icon: <FaGift />,          color: "#8b5cf6", bg: "#f5f3ff" },
];

/* ═══════════════════════════════════════════════════
   SHARE BUTTONS CONFIG
═══════════════════════════════════════════════════ */
const SHARE_BUTTONS = (inviteLink, message) => [
  { cls: "btn-share",    label: "Share",    icon: <FaShareAlt size={14} />,      fn: null },
  { cls: "btn-whatsapp", label: "WhatsApp", icon: <FaWhatsapp size={15} />,      fn: () => window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank") },
  { cls: "btn-facebook", label: "Facebook", icon: <FaFacebookF size={14} />,     fn: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteLink)}`, "_blank") },
  { cls: "btn-twitter",  label: "Twitter",  icon: <FaTwitter size={14} />,       fn: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`, "_blank") },
  { cls: "btn-telegram", label: "Telegram", icon: <FaTelegramPlane size={14} />, fn: () => window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(message)}`, "_blank") },
];

/* ═══════════════════════════════════════════════════
   EVENT ICONS
═══════════════════════════════════════════════════ */
const EVENT_ICON = {
  signed_up      : "👋",
  email_verified : "✅",
  reward_granted : "🎁",
  rejected       : "❌",
};

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════ */
export default function Invitation() {
  const navigate = useNavigate();

  /* ── State ── */
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [message,   setMessage]   = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [copied,    setCopied]    = useState({});
  const [toast,     setToast]     = useState({ show: false, text: "" });
  const [tab,       setTab]       = useState("activity");

  /* ── Auth guard ── */
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/invite");
  }, [navigate]);

  /* ── Fetch dashboard ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/referrals/dashboard`, { headers: authH() });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const d = await res.json();
      setData(d);

      const code = d.referral_code;
      const link = `${APP_URL}/invite/${code}`;
      setMessage(
        `Join me on Loemart — the smart marketplace for buying and selling ` +
        `everything from phones to fashion, vehicles, property, and more.\n\n` +
        `Use my invitation code: ${code}\n\nSign up here:\n${link}\n\nSee you on Loemart! 🚀`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Derived ── */
  const inviteCode = data?.referral_code || "—";
  const inviteLink = `${APP_URL}/invite/${inviteCode}`;

  /* ── Toast ── */
  const showToast = useCallback((text) => {
    setToast({ show: true, text });
    setTimeout(() => setToast({ show: false, text: "" }), 2_500);
  }, []);

  /* ── Copy ── */
  const handleCopy = useCallback((text, key, label) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied((p) => ({ ...p, [key]: true }));
    showToast(`✅ ${label} copied`);
    setTimeout(() => setCopied((p) => ({ ...p, [key]: false })), 2_200);
  }, [showToast]);

  /* ── Native share ── */
  const handleNativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Join Loemart", url: inviteLink });
      } else {
        handleCopy(inviteLink, "link", "Invite link");
      }
    } catch (_) {}
  };

  /* ── QR download ── */
  const downloadQR = () => {
    const canvas = document.getElementById("loemart-qr");
    if (!canvas) return;
    const a    = document.createElement("a");
    a.download = `loemart-invite-${inviteCode}.png`;
    a.href     = canvas.toDataURL("image/png");
    a.click();
    showToast("📥 QR code downloaded");
  };

  /* ── Share buttons with native share injected ── */
  const shareButtons = SHARE_BUTTONS(inviteLink, message);
  shareButtons[0].fn = handleNativeShare;

  /* ═══════════════════════════════════════════════
     LOADING STATE
  ═══════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="inv-page">
        <div className="inv-container">
          <div className="inv-full-loading" aria-busy="true">
            <div className="inv-spinner-lg" />
            <p>Loading your invite dashboard…</p>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
     ERROR STATE
  ═══════════════════════════════════════════════ */
  if (error) {
    return (
      <div className="inv-page">
        <div className="inv-container">
          <div className="inv-error-state">
            <span aria-hidden="true">⚠️</span>
            <p>Could not load your invite page</p>
            <small>{error}</small>
            <button onClick={fetchData} className="inv-retry-btn">Try Again</button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════ */
  return (
    <div className="inv-page">
      <div className="inv-container">

        {/* Toast */}
        <div className={`inv-toast${toast.show ? " show" : ""}`} role="status" aria-live="polite">
          {toast.text}
        </div>

        {/* Topbar */}
        <div className="inv-topbar">
          <button className="inv-back-btn" onClick={() => navigate(-1)} aria-label="Go back">
            <FaArrowLeft size={16} aria-hidden="true" />
          </button>
          <div>
            <p className="inv-topbar-title">Invite Friends</p>
            <p className="inv-topbar-sub">
              {data?.stats?.bonus_spins_remaining || 0} bonus spin
              {data?.stats?.bonus_spins_remaining !== 1 ? "s" : ""} available
            </p>
          </div>
          <Link to="/spin" className="inv-spin-shortcut" aria-label="Go to Spin & Win">
            🎡 Spin
          </Link>
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
            Share Loemart with friends. Each verified signup earns you{" "}
            <strong>+1 bonus spin</strong> on the wheel!
          </p>

          {/* Quick stats */}
          <div className="inv-header-stats">
            {[
              { val: data?.stats?.total_invites      || 0, label: "Invited"    },
              { val: data?.stats?.successful_signups || 0, label: "Signed up"  },
              { val: data?.stats?.bonus_spins_remaining || 0, label: "Spins left" },
            ].map((s, i, arr) => (
              <React.Fragment key={s.label}>
                <div className="inv-header-stat">
                  <span>{s.val}</span>
                  <small>{s.label}</small>
                </div>
                {i < arr.length - 1 && <div className="inv-header-stat-divider" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Info banner */}
        <div className="inv-info-banner" role="note">
          <FaInfoCircle size={18} style={{ flexShrink: 0 }} aria-hidden="true" />
          <span>
            Each successful signup earns you <strong>+1 bonus spin</strong>.{" "}
            <Link to="/spin" style={{ color: "#1e40af", fontWeight: 700 }}>Go spin →</Link>
          </span>
        </div>

        {/* ═══════════════════════════════════════
            INVITE CODE
        ═══════════════════════════════════════ */}
        <div className="inv-card">
          <h2 className="inv-card-title">
            <FaGift size={15} color="#2563eb" aria-hidden="true" />
            Your Invite Code
          </h2>
          <div className="inv-code-box">
            <span className="inv-code-text">{inviteCode}</span>
            <button
              className={`inv-copy-btn${copied.code ? " copied" : ""}`}
              onClick={() => handleCopy(inviteCode, "code", "Invite code")}
              aria-label={copied.code ? "Copied!" : "Copy invite code"}
            >
              {copied.code
                ? <><FaCheckCircle size={13} /> Copied</>
                : <><FaCopy size={13} /> Copy Code</>}
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════
            INVITE LINK + SHARE
        ═══════════════════════════════════════ */}
        <div className="inv-card">
          <h2 className="inv-card-title">
            <FaLink size={13} color="#2563eb" aria-hidden="true" />
            Your Invite Link
          </h2>

          <div className="inv-link-box">
            <span className="inv-link-text">{inviteLink}</span>
            <button
              className={`inv-copy-btn${copied.link ? " copied" : ""}`}
              onClick={() => handleCopy(inviteLink, "link", "Invite link")}
              aria-label={copied.link ? "Copied!" : "Copy invite link"}
            >
              {copied.link
                ? <><FaCheckCircle size={13} /> Copied</>
                : <><FaCopy size={13} /> Copy</>}
            </button>
          </div>

          <div className="inv-share-grid" role="group" aria-label="Share options">
            {shareButtons.map((btn) => (
              <button
                key={btn.label}
                className={`inv-share-btn ${btn.cls}`}
                onClick={btn.fn}
                aria-label={`Share on ${btn.label}`}
              >
                <span aria-hidden="true">{btn.icon}</span> {btn.label}
              </button>
            ))}
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
              aria-label={isEditing ? "Save" : "Edit message"}
            >
              {isEditing
                ? <><FaSave size={12} /> Save</>
                : <><FaEdit size={12} /> Edit</>}
            </button>
          </div>

          {isEditing ? (
            <textarea
              className="inv-msg-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={7}
              aria-label="Edit invitation message"
            />
          ) : (
            <div className="inv-msg-preview">
              {message.split("\n").map((line, i) => (
                <span key={i}>{line}<br /></span>
              ))}
            </div>
          )}

          <button
            className="inv-copy-msg-btn"
            onClick={() => handleCopy(message, "msg", "Message")}
            aria-label="Copy message"
          >
            <FaCopy size={13} /> Copy Message
          </button>
        </div>

        {/* ═══════════════════════════════════════
            QR CODE
        ═══════════════════════════════════════ */}
        <div className="inv-card">
          <h2 className="inv-card-title">QR Code</h2>
          <p className="inv-qr-sub">Scan to join Loemart instantly</p>

          <div className="inv-qr-box">
            <QRCodeCanvas
              id="loemart-qr"
              value={inviteLink}
              size={160}
              includeMargin
              bgColor="#ffffff"
              fgColor="#1e3a5f"
            />
            <p className="inv-qr-note">{inviteLink}</p>
          </div>

          <button className="inv-download-btn" onClick={downloadQR} aria-label="Download QR code">
            📥 Download QR Code
          </button>
        </div>

        {/* ═══════════════════════════════════════
            STATS GRID
        ═══════════════════════════════════════ */}
        <div className="inv-card">
          <h2 className="inv-card-title">📊 Referral Stats</h2>
          <div className="inv-stats-grid" role="list">
            {STATS.map((s) => (
              <div
                key={s.key}
                className="inv-stat-card"
                role="listitem"
                style={{ backgroundColor: s.bg }}
              >
                <div className="inv-stat-icon" style={{ color: s.color }}>{s.icon}</div>
                <div className="inv-stat-value" style={{ color: s.color }}>
                  {data?.stats?.[s.key] ?? 0}
                </div>
                <div className="inv-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════
            TABS: ACTIVITY / EVENTS / HOW
        ═══════════════════════════════════════ */}
        <div className="inv-card">

          {/* Tab nav */}
          <div className="inv-tab-nav" role="tablist">
            {[
              { key: "activity", label: "👥 Activity",      count: data?.activity?.length || 0 },
              { key: "events",   label: "⚡ Events",        count: data?.events?.length   || 0 },
              { key: "how",      label: "❓ How It Works",  count: 0 },
            ].map((t) => (
              <button
                key={t.key}
                className={`inv-tab-btn${tab === t.key ? " active" : ""}`}
                onClick={() => setTab(t.key)}
                role="tab"
                aria-selected={tab === t.key}
              >
                {t.label}
                {t.count > 0 && <span className="inv-tab-count">{t.count}</span>}
              </button>
            ))}
          </div>

          {/* ── Activity ── */}
          {tab === "activity" && (
            data?.activity?.length ? (
              <div className="inv-activity-list" role="list">
                {data.activity.map((item) => {
                  const badge = STATUS[item.status] || STATUS.pending;
                  return (
                    <div key={item.id} className="inv-activity-item" role="listitem">

                      {/* Avatar */}
                      <div className="inv-activity-avatar-wrap">
                        {item.avatar_url ? (
                          <img src={item.avatar_url} alt={item.name} className="inv-activity-avatar-img" />
                        ) : (
                          <div className="inv-activity-avatar" style={{ backgroundColor: item.color }}>
                            {item.initials}
                          </div>
                        )}
                        {item.status === "rewarded" && (
                          <div className="inv-activity-dot" aria-hidden="true" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="inv-activity-info">
                        <p className="inv-activity-name">{item.name}</p>
                        <p className="inv-activity-time">Joined {timeAgo(item.joined_at)}</p>

                        {/* Progress timeline */}
                        <div className="inv-activity-timeline">
                          <span className={`inv-tl-dot ${["pending","verified","rewarded"].includes(item.status) ? "done" : ""}`} />
                          <span className="inv-tl-line" />
                          <span className={`inv-tl-dot ${["verified","rewarded"].includes(item.status) ? "done" : ""}`} />
                          <span className="inv-tl-line" />
                          <span className={`inv-tl-dot ${item.status === "rewarded" ? "done" : ""}`} />
                        </div>
                        <div className="inv-activity-steps">
                          <span>Signed up</span>
                          <span>Verified</span>
                          <span>Rewarded</span>
                        </div>
                      </div>

                      {/* Right */}
                      <div className="inv-activity-right">
                        <span className={`inv-history-badge ${badge.cls}`}>
                          {badge.icon} {badge.label}
                        </span>
                        {item.status === "rewarded" && (
                          <span className="inv-reward-pill">🎡 +{item.reward_value} Spin</span>
                        )}
                        {item.status === "pending" && (
                          <span className="inv-pending-pill">Awaiting verification</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="inv-empty">
                <div className="inv-empty-icon">📭</div>
                <p>No referrals yet</p>
                <span>Share your invite code to get started!</span>
              </div>
            )
          )}

          {/* ── Events ── */}
          {tab === "events" && (
            data?.events?.length ? (
              <div className="inv-events-feed" role="log">
                {data.events.map((ev, i) => (
                  <div key={i} className="inv-event-item">
                    <span className="inv-event-icon">
                      {EVENT_ICON[ev.type] || "📌"}
                    </span>
                    <div className="inv-event-body">
                      <p className="inv-event-desc">
                        <strong>{ev.referee_name}</strong>{" "}
                        {ev.description?.toLowerCase() || ev.type.replace(/_/g, " ")}
                      </p>
                      <p className="inv-event-time">{timeAgo(ev.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="inv-empty">
                <div className="inv-empty-icon">📋</div>
                <p>No events yet</p>
                <span>Events appear here when friends sign up</span>
              </div>
            )
          )}

          {/* ── How It Works ── */}
          {tab === "how" && (
            <div className="inv-how-wrap">
              {[
                { icon: "📤", title: "Share your invite code",   sub: "Copy your code or link and share it with friends" },
                { icon: "👤", title: "Friend signs up",          sub: "They create a Loemart account using your invite code" },
                { icon: "✅", title: "They verify their email",   sub: "Email verification confirms the referral is genuine" },
                { icon: "🎡", title: "You earn a bonus spin",     sub: "Instantly receive +1 spin on the Spin & Win wheel!" },
                { icon: "🏆", title: "Use your spins",            sub: "Win coupons, discounts, airtime and more on the wheel" },
              ].map((step, i) => (
                <div key={i} className="inv-how-step">
                  <div className="inv-how-num">{i + 1}</div>
                  <span style={{ fontSize: 22 }}>{step.icon}</span>
                  <div className="inv-how-content">
                    <p className="inv-how-title">{step.title}</p>
                    <p className="inv-how-sub">{step.sub}</p>
                  </div>
                </div>
              ))}
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
        <Link to="/spin" className="inv-spin-cta" aria-label="Go to Spin & Win">
          <span style={{ fontSize: 36 }}>🎡</span>
          <div style={{ flex: 1 }}>
            <p className="inv-spin-cta-title">Use Your Bonus Spins</p>
            <p className="inv-spin-cta-sub">
              {(data?.stats?.bonus_spins_remaining || 0) > 0
                ? `You have ${data.stats.bonus_spins_remaining} bonus spin${data.stats.bonus_spins_remaining !== 1 ? "s" : ""} ready!`
                : "Invite friends to earn bonus spins!"}
            </p>
          </div>
          <span className="inv-spin-cta-arrow">→</span>
        </Link>

        <p className="inv-footer">
          © {new Date().getFullYear()} Loemart · All rights reserved
        </p>
      </div>
    </div>
  );
}
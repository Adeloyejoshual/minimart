// src/pages/Invitation.jsx

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useNavigate, Link } from "react-router-dom";
import { QRCodeCanvas }      from "qrcode.react";
import {
  FaCopy,
  FaShareAlt,
  FaWhatsapp,
  FaFacebookF,
  FaTelegramPlane,
  FaTwitter,
  FaCheckCircle,
  FaUserPlus,
  FaGift,
  FaEdit,
  FaSave,
  FaPaperPlane,
  FaHourglassHalf,
  FaTrophy,
  FaInfoCircle,
  FaArrowLeft,
  FaLink,
  FaSync,
  FaChevronRight,
} from "react-icons/fa";
import "../styles/Invitation.css";

/* ══════════════════════════════════════════════════════════════
   CONFIG
══════════════════════════════════════════════════════════════ */
const APP_URL  = import.meta.env.VITE_APP_URL      || "https://loemart.com";
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api/referrals`;

/* ══════════════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const authHeaders = () => ({
  Authorization  : `Bearer ${getToken()}`,
  "Content-Type" : "application/json",
});

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 60)     return "just now";
  if (s < 3_600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
};

const buildInviteLink = (code) => `${APP_URL}/invite/${code}`;

const buildMessage = (code, link) =>
  `Join me on Loemart — the smart marketplace for buying and selling ` +
  `everything from phones to fashion, vehicles, property, and more.\n\n` +
  `Use my invitation code: ${code}\n\nSign up here:\n${link}\n\nSee you on Loemart! 🚀`;

/* ══════════════════════════════════════════════════════════════
   STATUS CONFIG
══════════════════════════════════════════════════════════════ */
const STATUS_CFG = {
  pending  : { label: "Pending",          cls: "badge-pending",   icon: <FaHourglassHalf size={10} /> },
  verified : { label: "Verified",         cls: "badge-verified",  icon: <FaCheckCircle   size={10} /> },
  rewarded : { label: "Rewarded",         cls: "badge-rewarded",  icon: <FaTrophy        size={10} /> },
  rejected : { label: "Rejected",         cls: "badge-rejected",  icon: null                          },
};

/* ══════════════════════════════════════════════════════════════
   STATS CONFIG
══════════════════════════════════════════════════════════════ */
const STATS_CFG = [
  {
    key   : "total_invites",
    label : "Total Invites",
    icon  : <FaPaperPlane />,
    color : "#2563eb",
    bg    : "#eff6ff",
  },
  {
    key   : "successful_signups",
    label : "Successful Sign-ups",
    icon  : <FaUserPlus />,
    color : "#10b981",
    bg    : "#ecfdf5",
  },
  {
    key   : "pending_invites",
    label : "Pending",
    icon  : <FaHourglassHalf />,
    color : "#f59e0b",
    bg    : "#fffbeb",
  },
  {
    key   : "bonus_spins_remaining",
    label : "Spins Remaining",
    icon  : <FaGift />,
    color : "#8b5cf6",
    bg    : "#f5f3ff",
  },
];

/* ══════════════════════════════════════════════════════════════
   EVENT ICONS
══════════════════════════════════════════════════════════════ */
const EVENT_ICON = {
  signed_up      : "👋",
  email_verified : "✅",
  reward_granted : "🎁",
  rejected       : "❌",
};

/* ══════════════════════════════════════════════════════════════
   TABS CONFIG
══════════════════════════════════════════════════════════════ */
const TABS = [
  { key: "activity", label: "👥 Activity"     },
  { key: "events",   label: "⚡ Events"       },
  { key: "how",      label: "❓ How It Works" },
];

const HOW_STEPS = [
  { icon: "📤", title: "Share your invite code",    sub: "Copy your code or link and share it anywhere" },
  { icon: "👤", title: "Friend signs up",           sub: "They register using your invite code"          },
  { icon: "✅", title: "They verify their email",   sub: "Confirms the referral is genuine"              },
  { icon: "🎡", title: "You earn a bonus spin",     sub: "Instantly get +1 spin on the Spin & Win wheel" },
  { icon: "🏆", title: "Use your spins",            sub: "Win coupons, discounts, airtime and more"      },
];

const SHARE_PLATFORMS = (link, message) => [
  {
    cls   : "btn-share",
    label : "Share",
    icon  : <FaShareAlt size={14} />,
    fn    : null, // injected later (native share)
  },
  {
    cls   : "btn-whatsapp",
    label : "WhatsApp",
    icon  : <FaWhatsapp size={15} />,
    fn    : () => window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener"),
  },
  {
    cls   : "btn-facebook",
    label : "Facebook",
    icon  : <FaFacebookF size={14} />,
    fn    : () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, "_blank", "noopener"),
  },
  {
    cls   : "btn-twitter",
    label : "Twitter",
    icon  : <FaTwitter size={14} />,
    fn    : () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`, "_blank", "noopener"),
  },
  {
    cls   : "btn-telegram",
    label : "Telegram",
    icon  : <FaTelegramPlane size={14} />,
    fn    : () => window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}`, "_blank", "noopener"),
  },
];

/* ══════════════════════════════════════════════════════════════
   ACTIVITY ITEM
══════════════════════════════════════════════════════════════ */
function ActivityItem({ item }) {
  const badge  = STATUS_CFG[item.status] || STATUS_CFG.pending;
  const stages = ["pending", "verified", "rewarded"];

  return (
    <div className="inv-activity-item" role="listitem">

      {/* Avatar */}
      <div className="inv-activity-avatar-wrap">
        {item.avatar_url ? (
          <img
            src={item.avatar_url}
            alt={item.name}
            className="inv-activity-avatar-img"
          />
        ) : (
          <div
            className="inv-activity-avatar"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          >
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
        <div
          className="inv-activity-timeline"
          role="progressbar"
          aria-label={`Status: ${badge.label}`}
        >
          {stages.map((stage, i) => {
            const done = stages.indexOf(item.status) >= i;
            return (
              <React.Fragment key={stage}>
                <span className={`inv-tl-dot${done ? " done" : ""}`} />
                {i < stages.length - 1 && (
                  <span className="inv-tl-line" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="inv-activity-steps" aria-hidden="true">
          <span>Signed up</span>
          <span>Verified</span>
          <span>Rewarded</span>
        </div>
      </div>

      {/* Right side */}
      <div className="inv-activity-right">
        <span
          className={`inv-history-badge ${badge.cls}`}
          aria-label={`Status: ${badge.label}`}
        >
          {badge.icon} {badge.label}
        </span>

        {item.status === "rewarded" && (
          <span className="inv-reward-pill" aria-label={`+${item.reward_value} bonus spin`}>
            🎡 +{item.reward_value} Spin
          </span>
        )}

        {item.status === "pending" && (
          <span className="inv-pending-pill">Awaiting verification</span>
        )}

        {item.status === "verified" && (
          <span className="inv-pending-pill" style={{ color: "#2563eb" }}>
            Processing reward…
          </span>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   EVENTS FEED
══════════════════════════════════════════════════════════════ */
function EventsFeed({ events }) {
  if (!events?.length) return null;

  return (
    <div className="inv-events-feed" role="log" aria-live="polite">
      {events.map((ev, i) => (
        <div key={i} className="inv-event-item">
          <span className="inv-event-icon" aria-hidden="true">
            {EVENT_ICON[ev.type] || "📌"}
          </span>
          <div className="inv-event-body">
            <p className="inv-event-desc">
              <strong>{ev.referee_name}</strong>{" "}
              {ev.description?.toLowerCase() ||
               ev.type.replace(/_/g, " ")}
            </p>
            <p className="inv-event-time">{timeAgo(ev.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SKELETON LOADER
══════════════════════════════════════════════════════════════ */
function SkeletonCard({ rows = 3 }) {
  return (
    <div className="inv-card" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="inv-skeleton"
          style={{
            height       : i === 0 ? 18 : 14,
            width        : i === 0 ? "60%" : `${70 + Math.random() * 20}%`,
            marginBottom : 10,
          }}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function Invitation() {
  const navigate = useNavigate();

  /* ── Data state ── */
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [error,     setError]     = useState(null);

  /* ── UI state ── */
  const [message,   setMessage]   = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [copied,    setCopied]    = useState({});
  const [toast,     setToast]     = useState({ show: false, text: "" });
  const [tab,       setTab]       = useState("activity");

  const toastTimer = useRef(null);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/invite");
  }, [navigate]);

  /* ── Fetch dashboard ── */
  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else         setRefreshing(true);
    setError(null);

    try {
      const res = await fetch(`${API}/dashboard`, {
        headers: authHeaders(),
      });

      if (res.status === 401) {
        navigate("/auth?redirect=/invite");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `${res.status} ${res.statusText}`);
      }

      const d = await res.json();
      setData(d);

      /* Build default message once */
      const code = d.referral_code;
      if (code) {
        const link = buildInviteLink(code);
        setMessage(buildMessage(code, link));
      }

    } catch (err) {
      console.error("[Invitation] fetch error:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  /* ── Derived values ── */
  const inviteCode = data?.referral_code || "—";
  const inviteLink = buildInviteLink(inviteCode);

  /* ── Toast ── */
  const showToast = useCallback((text) => {
    clearTimeout(toastTimer.current);
    setToast({ show: true, text });
    toastTimer.current = setTimeout(
      () => setToast({ show: false, text: "" }),
      2_500
    );
  }, []);

  /* ── Copy ── */
  const handleCopy = useCallback(
    (text, key, label) => {
      navigator.clipboard.writeText(text).catch(() => {});
      setCopied((p) => ({ ...p, [key]: true }));
      showToast(`✅ ${label} copied`);
      setTimeout(() => setCopied((p) => ({ ...p, [key]: false })), 2_200);
    },
    [showToast]
  );

  /* ── Native share ── */
  const handleNativeShare = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title : "Join Loemart",
          text  : "Buy and sell anything on Loemart.",
          url   : inviteLink,
        });
      } else {
        handleCopy(inviteLink, "link", "Invite link");
      }
    } catch (_) {}
  }, [inviteLink, handleCopy]);

  /* ── QR download ── */
  const downloadQR = useCallback(() => {
    const canvas = document.getElementById("loemart-invite-qr");
    if (!canvas) return;
    const a    = document.createElement("a");
    a.download = `loemart-invite-${inviteCode}.png`;
    a.href     = canvas.toDataURL("image/png");
    a.click();
    showToast("📥 QR code downloaded");
  }, [inviteCode, showToast]);

  /* ── Share buttons (inject native share) ── */
  const shareButtons = useMemo(() => {
    const btns = SHARE_PLATFORMS(inviteLink, message);
    btns[0].fn = handleNativeShare;
    return btns;
  }, [inviteLink, message, handleNativeShare]);

  /* ── Cleanup timer on unmount ── */
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* ══════════════════════════════════════════════════════════
     LOADING STATE
  ══════════════════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="inv-page">
        <div className="inv-container">
          <div className="inv-full-loading" aria-busy="true" aria-label="Loading invite dashboard">
            <div className="inv-spinner-lg" />
            <p>Loading your invite dashboard…</p>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     ERROR STATE
  ══════════════════════════════════════════════════════════ */
  if (error) {
    return (
      <div className="inv-page">
        <div className="inv-container">
          <div className="inv-error-state" role="alert">
            <span aria-hidden="true">⚠️</span>
            <p>Could not load your invite page</p>
            <small>{error}</small>
            <button
              className="inv-retry-btn"
              onClick={() => fetchDashboard()}
              aria-label="Retry loading"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     MAIN RENDER
  ══════════════════════════════════════════════════════════ */
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

        {/* ══════════════════════════════════════════════
            TOPBAR
        ══════════════════════════════════════════════ */}
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
            <p className="inv-topbar-sub">
              {(data?.stats?.bonus_spins_remaining ?? 0)} bonus spin
              {data?.stats?.bonus_spins_remaining !== 1 ? "s" : ""} available
            </p>
          </div>

          {/* Refresh button */}
          <button
            className="inv-refresh-btn"
            onClick={() => fetchDashboard(true)}
            disabled={refreshing}
            aria-label="Refresh referral data"
          >
            <FaSync
              size={13}
              style={{
                animation: refreshing ? "inv-spin 0.75s linear infinite" : "none",
              }}
              aria-hidden="true"
            />
          </button>

          {/* Spin shortcut */}
          <Link
            to="/spin"
            className="inv-spin-shortcut"
            aria-label="Go to Spin and Win"
          >
            🎡 Spin
          </Link>
        </div>

        {/* ══════════════════════════════════════════════
            HEADER
        ══════════════════════════════════════════════ */}
        <div className="inv-header">
          <div className="inv-header-icon" aria-hidden="true">
            <FaUserPlus size={28} color="#fff" />
          </div>
          <h1>Invite Friends</h1>
          <p>
            Share Loemart with friends. Each verified signup earns you{" "}
            <strong>+1 bonus spin</strong> on the wheel!
          </p>

          {/* Quick stats row */}
          <div className="inv-header-stats" role="list" aria-label="Quick stats">
            {[
              { val: data?.stats?.total_invites      ?? 0, label: "Invited"   },
              { val: data?.stats?.successful_signups ?? 0, label: "Signed up" },
              { val: data?.stats?.bonus_spins_remaining ?? 0, label: "Spins"  },
            ].map((s, i, arr) => (
              <React.Fragment key={s.label}>
                <div className="inv-header-stat" role="listitem">
                  <span>{s.val}</span>
                  <small>{s.label}</small>
                </div>
                {i < arr.length - 1 && (
                  <div className="inv-header-stat-divider" aria-hidden="true" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── Info banner ── */}
        <div className="inv-info-banner" role="note">
          <FaInfoCircle size={17} style={{ flexShrink: 0 }} aria-hidden="true" />
          <span>
            Each verified signup earns you{" "}
            <strong>+1 bonus spin</strong>.{" "}
            <Link to="/spin" style={{ color: "#1e40af", fontWeight: 700 }}>
              Go spin →
            </Link>
          </span>
        </div>

        {/* ══════════════════════════════════════════════
            INVITE CODE
        ══════════════════════════════════════════════ */}
        <div className="inv-card">
          <h2 className="inv-card-title">
            <FaGift size={15} color="#2563eb" aria-hidden="true" />
            Your Invite Code
          </h2>

          <div
            className="inv-code-box"
            aria-label={`Your invite code is ${inviteCode}`}
          >
            <span className="inv-code-text">{inviteCode}</span>
            <button
              className={`inv-copy-btn${copied.code ? " copied" : ""}`}
              onClick={() => handleCopy(inviteCode, "code", "Invite code")}
              aria-label={copied.code ? "Invite code copied" : "Copy invite code"}
            >
              {copied.code
                ? <><FaCheckCircle size={13} aria-hidden="true" /> Copied</>
                : <><FaCopy        size={13} aria-hidden="true" /> Copy Code</>}
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            INVITE LINK + SHARE
        ══════════════════════════════════════════════ */}
        <div className="inv-card">
          <h2 className="inv-card-title">
            <FaLink size={13} color="#2563eb" aria-hidden="true" />
            Your Invite Link
          </h2>

          {/* Link row */}
          <div className="inv-link-box" aria-label={`Invite link: ${inviteLink}`}>
            <span className="inv-link-text" aria-hidden="true">
              {inviteLink}
            </span>
            <button
              className={`inv-copy-btn${copied.link ? " copied" : ""}`}
              onClick={() => handleCopy(inviteLink, "link", "Invite link")}
              aria-label={copied.link ? "Copied" : "Copy invite link"}
            >
              {copied.link
                ? <><FaCheckCircle size={13} aria-hidden="true" /> Copied</>
                : <><FaCopy        size={13} aria-hidden="true" /> Copy</>}
            </button>
          </div>

          {/* Share grid */}
          <div
            className="inv-share-grid"
            role="group"
            aria-label="Share on social media"
          >
            {shareButtons.map((btn) => (
              <button
                key={btn.label}
                className={`inv-share-btn ${btn.cls}`}
                onClick={btn.fn}
                aria-label={`Share on ${btn.label}`}
              >
                <span aria-hidden="true">{btn.icon}</span>
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            INVITATION MESSAGE
        ══════════════════════════════════════════════ */}
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
              rows={7}
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

        {/* ══════════════════════════════════════════════
            QR CODE
        ══════════════════════════════════════════════ */}
        <div className="inv-card">
          <h2 className="inv-card-title">QR Code</h2>
          <p className="inv-qr-sub">Scan to join Loemart instantly</p>

          <div
            className="inv-qr-box"
            aria-label={`QR code for invite link ${inviteLink}`}
          >
            <QRCodeCanvas
              id="loemart-invite-qr"
              value={inviteLink}
              size={160}
              includeMargin
              bgColor="#ffffff"
              fgColor="#1e3a5f"
            />
            <p className="inv-qr-note">{inviteLink}</p>
          </div>

          <button
            className="inv-download-btn"
            onClick={downloadQR}
            aria-label="Download QR code as image"
          >
            📥 Download QR Code
          </button>
        </div>

        {/* ══════════════════════════════════════════════
            STATS GRID
        ══════════════════════════════════════════════ */}
        <div className="inv-card">
          <h2 className="inv-card-title">📊 Referral Stats</h2>

          <div className="inv-stats-grid" role="list" aria-label="Referral statistics">
            {STATS_CFG.map((s) => (
              <div
                key={s.key}
                className="inv-stat-card"
                role="listitem"
                style={{ backgroundColor: s.bg }}
                aria-label={`${s.label}: ${data?.stats?.[s.key] ?? 0}`}
              >
                <div
                  className="inv-stat-icon"
                  style={{ color: s.color }}
                  aria-hidden="true"
                >
                  {s.icon}
                </div>
                <div className="inv-stat-value" style={{ color: s.color }}>
                  {data?.stats?.[s.key] ?? 0}
                </div>
                <div className="inv-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            TABS: ACTIVITY / EVENTS / HOW IT WORKS
        ══════════════════════════════════════════════ */}
        <div className="inv-card">

          {/* Tab nav */}
          <div className="inv-tab-nav" role="tablist" aria-label="Referral sections">
            {TABS.map((t) => {
              const count =
                t.key === "activity" ? (data?.activity?.length ?? 0) :
                t.key === "events"   ? (data?.events?.length   ?? 0) : 0;

              return (
                <button
                  key={t.key}
                  className={`inv-tab-btn${tab === t.key ? " active" : ""}`}
                  onClick={() => setTab(t.key)}
                  role="tab"
                  aria-selected={tab === t.key}
                  aria-label={t.label}
                >
                  {t.label}
                  {count > 0 && (
                    <span className="inv-tab-count" aria-hidden="true">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Activity tab ── */}
          {tab === "activity" && (
            <div role="tabpanel" aria-label="Referral activity">
              <h2 className="inv-card-title" style={{ marginTop: 16 }}>
                👥 Referral Activity
              </h2>

              {!data?.activity?.length ? (
                <div className="inv-empty" aria-label="No referrals yet">
                  <div className="inv-empty-icon" aria-hidden="true">📭</div>
                  <p>No referrals yet</p>
                  <span>Share your invite code to get started!</span>
                </div>
              ) : (
                <div className="inv-activity-list" role="list">
                  {data.activity.map((item) => (
                    <ActivityItem key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Events tab ── */}
          {tab === "events" && (
            <div role="tabpanel" aria-label="Recent events">
              <h2 className="inv-card-title" style={{ marginTop: 16 }}>
                ⚡ Recent Events
              </h2>

              {!data?.events?.length ? (
                <div className="inv-empty" aria-label="No events yet">
                  <div className="inv-empty-icon" aria-hidden="true">📋</div>
                  <p>No events yet</p>
                  <span>Events appear here when friends sign up</span>
                </div>
              ) : (
                <EventsFeed events={data.events} />
              )}
            </div>
          )}

          {/* ── How it works tab ── */}
          {tab === "how" && (
            <div role="tabpanel" aria-label="How it works">
              <h2 className="inv-card-title" style={{ marginTop: 16 }}>
                ❓ How It Works
              </h2>
              <div className="inv-how-wrap">
                {HOW_STEPS.map((step, i) => (
                  <div key={i} className="inv-how-step">
                    <div className="inv-how-num" aria-hidden="true">{i + 1}</div>
                    <span style={{ fontSize: 22 }} aria-hidden="true">{step.icon}</span>
                    <div className="inv-how-content">
                      <p className="inv-how-title">{step.title}</p>
                      <p className="inv-how-sub">{step.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Terms */}
          <div className="inv-terms">
            Referral rewards are credited only after a referred user creates an
            account and meets the eligibility requirements.{" "}
            <Link to="/terms">Learn more</Link>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            SPIN & WIN CTA
        ══════════════════════════════════════════════ */}
        <Link
          to="/spin"
          className="inv-spin-cta"
          aria-label="Go to Spin and Win wheel"
        >
          <span style={{ fontSize: 36 }} aria-hidden="true">🎡</span>
          <div style={{ flex: 1 }}>
            <p className="inv-spin-cta-title">Use Your Bonus Spins</p>
            <p className="inv-spin-cta-sub">
              {(data?.stats?.bonus_spins_remaining ?? 0) > 0
                ? `You have ${data.stats.bonus_spins_remaining} bonus spin${
                    data.stats.bonus_spins_remaining !== 1 ? "s" : ""
                  } ready!`
                : "Invite friends to earn bonus spins!"}
            </p>
          </div>
          <FaChevronRight
            size={16}
            style={{ opacity: 0.6, flexShrink: 0 }}
            aria-hidden="true"
          />
        </Link>

        {/* ── Footer ── */}
        <p className="inv-footer">
          © {new Date().getFullYear()} Loemart · All rights reserved
        </p>

      </div>
    </div>
  );
}
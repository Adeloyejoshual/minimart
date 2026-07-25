// ════════════════════════════════════════════════════════════
// FILE: src/pages/Invitation.jsx
// ════════════════════════════════════════════════════════════

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
  FaExclamationTriangle,
} from "react-icons/fa";
import "../styles/Invitation.css";

/* ══════════════════════════════════════════════════════════════
   SVG ICON COMPONENTS (transparent backgrounds, replace all emoji)
══════════════════════════════════════════════════════════════ */

const SvgRocket = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M12 2C12 2 4.5 9.5 4.5 14.5C4.5 17.5 7 20 10 20.5L12 22L14 20.5C17 20 19.5 17.5 19.5 14.5C19.5 9.5 12 2 12 2Z" fill="#F97316" />
    <path d="M12 2C12 2 8 8 8 13C8 15.2 9.8 17 12 17C14.2 17 16 15.2 16 13C16 8 12 2 12 2Z" fill="#EF4444" />
    <path d="M12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z" fill="#FDE68A" />
    <path d="M3 16L6 14L5 18L3 16Z" fill="#F97316" />
    <path d="M21 16L18 14L19 18L21 16Z" fill="#F97316" />
  </svg>
);

const SvgWave = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M7.5 15.5L5.5 13.5C5.1 13.1 4.5 13.1 4.1 13.5C3.7 13.9 3.7 14.5 4.1 14.9L7.5 18.3" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M11.5 11.5L5.5 5.5C5.1 5.1 4.5 5.1 4.1 5.5C3.7 5.9 3.7 6.5 4.1 6.9L10.1 12.9" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M13.5 9.5L8.5 4.5C8.1 4.1 7.5 4.1 7.1 4.5C6.7 4.9 6.7 5.5 7.1 5.9L12.1 10.9" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M15.5 11.5L11.5 7.5C11.1 7.1 10.5 7.1 10.1 7.5C9.7 7.9 9.7 8.5 10.1 8.9L14.1 12.9" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M15.5 11.5L18.5 14.5C20.7 16.7 20.7 20.3 18.5 22.5" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="18" cy="4" r="1.5" fill="#F59E0B" />
    <circle cx="20" cy="7" r="1" fill="#F59E0B" />
  </svg>
);

const SvgCheckMark = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="12" cy="12" r="10" fill="#10B981" />
    <path d="M7 12.5L10.5 16L17 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SvgGiftBox = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="3" y="10" width="18" height="11" rx="2" fill="#8B5CF6" />
    <rect x="2" y="7" width="20" height="4" rx="1" fill="#A78BFA" />
    <rect x="11" y="7" width="2" height="14" fill="#FDE68A" />
    <path d="M12 7C12 7 9 4 7 4C5.5 4 5 5.5 6 6.5C7 7.5 12 7 12 7Z" fill="#F472B6" />
    <path d="M12 7C12 7 15 4 17 4C18.5 4 19 5.5 18 6.5C17 7.5 12 7 12 7Z" fill="#F472B6" />
  </svg>
);

const SvgCrossMark = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="12" cy="12" r="10" fill="#EF4444" />
    <path d="M8 8L16 16M16 8L8 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const SvgPin = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="#EF4444" />
    <circle cx="12" cy="9" r="3" fill="white" />
  </svg>
);

const SvgFerrisWheel = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="12" cy="10" r="8" stroke="#8B5CF6" strokeWidth="2" fill="none" />
    <circle cx="12" cy="10" r="2" fill="#8B5CF6" />
    <line x1="12" y1="2" x2="12" y2="8" stroke="#F59E0B" strokeWidth="1.5" />
    <line x1="12" y1="12" x2="12" y2="18" stroke="#10B981" strokeWidth="1.5" />
    <line x1="4.34" y1="5.34" x2="9.17" y2="8.59" stroke="#EF4444" strokeWidth="1.5" />
    <line x1="14.83" y1="11.41" x2="19.66" y2="14.66" stroke="#3B82F6" strokeWidth="1.5" />
    <line x1="19.66" y1="5.34" x2="14.83" y2="8.59" stroke="#F472B6" strokeWidth="1.5" />
    <line x1="9.17" y1="11.41" x2="4.34" y2="14.66" stroke="#06B6D4" strokeWidth="1.5" />
    <line x1="9" y1="18" x2="7" y2="22" stroke="#6B7280" strokeWidth="1.5" />
    <line x1="15" y1="18" x2="17" y2="22" stroke="#6B7280" strokeWidth="1.5" />
    <line x1="6" y1="22" x2="18" y2="22" stroke="#6B7280" strokeWidth="2" />
  </svg>
);

const SvgPeople = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="9" cy="7" r="3" fill="#3B82F6" />
    <path d="M3 19C3 15.69 5.69 14 9 14C12.31 14 15 15.69 15 19" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
    <circle cx="17" cy="8" r="2.5" fill="#60A5FA" />
    <path d="M16 14C18.76 14 21 15.69 21 18" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const SvgLightning = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M13 2L4 14H11L10 22L20 10H13L13 2Z" fill="#F59E0B" />
  </svg>
);

const SvgQuestionMark = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="12" cy="12" r="10" fill="#6366F1" />
    <path d="M9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5V13" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="16" r="1" fill="white" />
  </svg>
);

const SvgChart = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="3" y="12" width="4" height="8" rx="1" fill="#3B82F6" />
    <rect x="10" y="6" width="4" height="14" rx="1" fill="#10B981" />
    <rect x="17" y="9" width="4" height="11" rx="1" fill="#F59E0B" />
  </svg>
);

const SvgMailbox = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="3" y="8" width="18" height="11" rx="2" fill="#9CA3AF" />
    <path d="M3 10L12 15L21 10" stroke="#6B7280" strokeWidth="1.5" />
    <rect x="10" y="4" width="4" height="5" rx="1" fill="#D1D5DB" />
    <line x1="14" y1="6" x2="17" y2="6" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const SvgClipboard = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="5" y="4" width="14" height="17" rx="2" fill="#D1D5DB" />
    <rect x="8" y="2" width="8" height="3" rx="1" fill="#9CA3AF" />
    <line x1="8" y1="10" x2="16" y2="10" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="8" y1="13" x2="14" y2="13" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="8" y1="16" x2="12" y2="16" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const SvgUpload = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M12 16V4M12 4L8 8M12 4L16 8" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 14V18C4 19.1 4.9 20 6 20H18C19.1 20 20 19.1 20 18V14" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const SvgUser = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="12" cy="8" r="4" fill="#3B82F6" />
    <path d="M4 20C4 16.69 7.58 14 12 14C16.42 14 20 16.69 20 20" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const SvgTrophy = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M7 4H17V10C17 13.31 14.76 16 12 16C9.24 16 7 13.31 7 10V4Z" fill="#F59E0B" />
    <path d="M7 6H4C4 9 5.5 10 7 10" stroke="#F59E0B" strokeWidth="1.5" />
    <path d="M17 6H20C20 9 18.5 10 17 10" stroke="#F59E0B" strokeWidth="1.5" />
    <rect x="10" y="16" width="4" height="3" fill="#D97706" />
    <rect x="8" y="19" width="8" height="2" rx="1" fill="#D97706" />
  </svg>
);

const SvgDownload = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M12 4V16M12 16L8 12M12 16L16 12" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 18V20C4 20.55 4.45 21 5 21H19C19.55 21 20 20.55 20 20V18" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

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
  localStorage.getItem("token")             ||
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

const buildInviteLink = (code) =>
  code && code !== "—" ? `${APP_URL}/invite/${code}` : "";

const buildMessage = (code, link) =>
  `Join me on Loemart — the smart marketplace for buying and selling ` +
  `everything from phones to fashion, vehicles, property, and more.\n\n` +
  `Use my invitation code: ${code}\n\nSign up here:\n${link}\n\nSee you on Loemart!`;

/* ══════════════════════════════════════════════════════════════
   STATUS CONFIG
══════════════════════════════════════════════════════════════ */
const STATUS_CFG = {
  pending  : { label: "Pending",  cls: "badge-pending",  icon: <FaHourglassHalf size={10} /> },
  verified : { label: "Verified", cls: "badge-verified", icon: <FaCheckCircle   size={10} /> },
  rewarded : { label: "Rewarded", cls: "badge-rewarded", icon: <FaTrophy        size={10} /> },
  rejected : { label: "Rejected", cls: "badge-rejected", icon: null                          },
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
  signed_up      : <SvgWave size={18} />,
  email_verified : <SvgCheckMark size={18} />,
  reward_granted : <SvgGiftBox size={18} />,
  rejected       : <SvgCrossMark size={18} />,
};

/* ══════════════════════════════════════════════════════════════
   TABS CONFIG
══════════════════════════════════════════════════════════════ */
const TABS = [
  { key: "activity", label: "Activity",     icon: <SvgPeople size={14} />       },
  { key: "events",   label: "Events",       icon: <SvgLightning size={14} />    },
  { key: "how",      label: "How It Works", icon: <SvgQuestionMark size={14} /> },
];

const HOW_STEPS = [
  { icon: <SvgUpload size={22} />,     title: "Share your invite code",  sub: "Copy your code or link and share it anywhere"       },
  { icon: <SvgUser size={22} />,       title: "Friend signs up",         sub: "They register using your invite code"                },
  { icon: <SvgCheckMark size={22} />,  title: "They verify their email", sub: "Confirms the referral is genuine"                    },
  { icon: <SvgFerrisWheel size={22} />,title: "You earn a bonus spin",   sub: "Instantly get +1 spin on the Spin & Win wheel"      },
  { icon: <SvgTrophy size={22} />,     title: "Use your spins",          sub: "Win coupons, discounts, airtime and more"            },
];

/* ══════════════════════════════════════════════════════════════
   SHARE PLATFORMS
══════════════════════════════════════════════════════════════ */
const SHARE_PLATFORM_DEFS = [
  {
    cls   : "btn-share",
    label : "Share",
    icon  : <FaShareAlt    size={14} />,
    build : null,
  },
  {
    cls   : "btn-whatsapp",
    label : "WhatsApp",
    icon  : <FaWhatsapp    size={15} />,
    build : (link, msg) => () =>
      window.open(
        `https://wa.me/?text=${encodeURIComponent(msg)}`,
        "_blank",
        "noopener"
      ),
  },
  {
    cls   : "btn-facebook",
    label : "Facebook",
    icon  : <FaFacebookF   size={14} />,
    build : (link) => () =>
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
        "_blank",
        "noopener"
      ),
  },
  {
    cls   : "btn-twitter",
    label : "Twitter",
    icon  : <FaTwitter     size={14} />,
    build : (link, msg) => () =>
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}`,
        "_blank",
        "noopener"
      ),
  },
  {
    cls   : "btn-telegram",
    label : "Telegram",
    icon  : <FaTelegramPlane size={14} />,
    build : (link, msg) => () =>
      window.open(
        `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(msg)}`,
        "_blank",
        "noopener"
      ),
  },
];

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
══════════════════════════════════════════════════════════════ */

/* ── Activity Item ── */
const STAGES = ["pending", "verified", "rewarded"];

function ActivityItem({ item }) {
  const badge       = STATUS_CFG[item.status] ?? STATUS_CFG.pending;
  const stageIndex  = STAGES.indexOf(item.status);

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
          aria-valuenow={stageIndex + 1}
          aria-valuemin={1}
          aria-valuemax={STAGES.length}
          aria-label={`Status: ${badge.label}`}
        >
          {STAGES.map((stage, i) => (
            <React.Fragment key={stage}>
              <span className={`inv-tl-dot${stageIndex >= i ? " done" : ""}`} />
              {i < STAGES.length - 1 && (
                <span className="inv-tl-line" />
              )}
            </React.Fragment>
          ))}
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
          <span
            className="inv-reward-pill"
            aria-label={`+${item.reward_value} bonus spin`}
          >
            <SvgFerrisWheel size={14} /> +{item.reward_value} Spin
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

/* ── Events Feed ── */
function EventsFeed({ events }) {
  if (!events?.length) return null;

  return (
    <div className="inv-events-feed" role="log" aria-live="polite">
      {events.map((ev, i) => (
        <div key={`${ev.type}-${ev.created_at}-${i}`} className="inv-event-item">
          <span className="inv-event-icon" aria-hidden="true">
            {EVENT_ICON[ev.type] ?? <SvgPin size={18} />}
          </span>
          <div className="inv-event-body">
            <p className="inv-event-desc">
              <strong>{ev.referee_name}</strong>{" "}
              {ev.description?.toLowerCase() ?? ev.type.replace(/_/g, " ")}
            </p>
            <p className="inv-event-time">{timeAgo(ev.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Skeleton Loader ── */
function SkeletonCard({ rows = 3 }) {
  return (
    <div className="inv-card" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="inv-skeleton"
          style={{
            height       : i === 0 ? 18 : 14,
            width        : i === 0 ? "60%" : `${75 + (i * 7) % 20}%`,
            marginBottom : 10,
          }}
        />
      ))}
    </div>
  );
}

/* ── No-code Banner ── */
function NoCodeBanner({ onGenerate, generating }) {
  return (
    <div className="inv-no-code-banner" role="alert">
      <FaExclamationTriangle size={16} aria-hidden="true" />
      <span>You don't have an invite code yet.</span>
      <button
        className="inv-generate-btn"
        onClick={onGenerate}
        disabled={generating}
        aria-label="Generate invite code"
        aria-busy={generating}
      >
        {generating ? "Generating…" : "Generate Code"}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function Invitation() {
  const navigate = useNavigate();

  /* ── Data state ── */
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);

  /* ── UI state ── */
  const [message,    setMessage]    = useState("");
  const [isEditing,  setIsEditing]  = useState(false);
  const [copied,     setCopied]     = useState({});
  const [toast,      setToast]      = useState({ show: false, text: "" });
  const [tab,        setTab]        = useState("activity");
  const [generating, setGenerating] = useState(false);

  const toastTimer = useRef(null);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/invite");
  }, [navigate]);

  /* ── Toast ── */
  const showToast = useCallback((text) => {
    clearTimeout(toastTimer.current);
    setToast({ show: true, text });
    toastTimer.current = setTimeout(
      () => setToast({ show: false, text: "" }),
      2_500
    );
  }, []);

  /* ── Cleanup timer on unmount ── */
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* ── Fetch dashboard ── */
  const fetchDashboard = useCallback(
    async (silent = false) => {
      silent ? setRefreshing(true) : setLoading(true);
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

        if (d.referral_code) {
          const link = buildInviteLink(d.referral_code);
          setMessage((prev) =>
            prev ? prev : buildMessage(d.referral_code, link)
          );
        }

      } catch (err) {
        console.error("[Invitation] fetch error:", err.message);
        setError(err.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  /* ── Generate code on demand ── */
  const handleGenerateCode = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API}/generate-code`, {
        method  : "POST",
        headers : authHeaders(),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.message || `${res.status} ${res.statusText}`);
      }

      const newCode = body.referral_code;
      if (!newCode) throw new Error("No code returned from server.");

      setData((prev) => ({ ...prev, referral_code: newCode }));

      const link = buildInviteLink(newCode);
      setMessage(buildMessage(newCode, link));
      showToast("Invite code generated!");

    } catch (err) {
      console.error("[Invitation] generate-code error:", err.message);
      showToast(err.message);
    } finally {
      setGenerating(false);
    }
  }, [showToast]);

  /* ── Derived values ── */
  const inviteCode = data?.referral_code ?? null;
  const inviteLink = inviteCode ? buildInviteLink(inviteCode) : "";
  const hasCode    = Boolean(inviteCode);

  /* ── Copy ── */
  const handleCopy = useCallback(
    (text, key, label) => {
      if (!text) return;
      navigator.clipboard.writeText(text).catch(() => {});
      setCopied((p) => ({ ...p, [key]: true }));
      showToast(`${label} copied`);
      setTimeout(
        () => setCopied((p) => ({ ...p, [key]: false })),
        2_200
      );
    },
    [showToast]
  );

  /* ── Native share ── */
  const handleNativeShare = useCallback(async () => {
    if (!inviteLink) return;
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
    } catch (_) {
      /* User cancelled share */
    }
  }, [inviteLink, handleCopy]);

  /* ── Share buttons ── */
  const shareButtons = useMemo(
    () =>
      SHARE_PLATFORM_DEFS.map((def) => ({
        ...def,
        fn: def.build === null
          ? handleNativeShare
          : def.build(inviteLink, message),
      })),
    [inviteLink, message, handleNativeShare]
  );

  /* ── QR download ── */
  const downloadQR = useCallback(() => {
    const canvas = document.getElementById("loemart-invite-qr");
    if (!canvas) return;
    const a    = document.createElement("a");
    a.download = `loemart-invite-${inviteCode}.png`;
    a.href     = canvas.toDataURL("image/png");
    a.click();
    showToast("QR code downloaded");
  }, [inviteCode, showToast]);

  /* ══════════════════════════════════════════════════════════
     LOADING STATE
  ══════════════════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="inv-page">
        <div className="inv-container">
          <div
            className="inv-full-loading"
            aria-busy="true"
            aria-label="Loading invite dashboard"
          >
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
            <FaExclamationTriangle size={32} aria-hidden="true" />
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
  const spinsRemaining = data?.stats?.bonus_spins_remaining ?? 0;

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
              {spinsRemaining} bonus spin{spinsRemaining !== 1 ? "s" : ""} available
            </p>
          </div>

          <button
            className="inv-refresh-btn"
            onClick={() => fetchDashboard(true)}
            disabled={refreshing}
            aria-label="Refresh referral data"
            aria-busy={refreshing}
          >
            <FaSync
              size={13}
              style={{
                animation: refreshing
                  ? "inv-spin 0.75s linear infinite"
                  : "none",
              }}
              aria-hidden="true"
            />
          </button>

          <Link
            to="/spin"
            className="inv-spin-shortcut"
            aria-label="Go to Spin and Win"
          >
            <SvgFerrisWheel size={16} /> Spin
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
              { val: data?.stats?.total_invites       ?? 0, label: "Invited"   },
              { val: data?.stats?.successful_signups  ?? 0, label: "Signed up" },
              { val: spinsRemaining,                         label: "Spins"     },
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
            Each verified signup earns you <strong>+1 bonus spin</strong>.{" "}
            <Link to="/spin" style={{ color: "#1e40af", fontWeight: 700 }}>
              Go spin →
            </Link>
          </span>
        </div>

        {/* ── No-code banner ── */}
        {!hasCode && (
          <NoCodeBanner
            onGenerate={handleGenerateCode}
            generating={generating}
          />
        )}

        {/* ══════════════════════════════════════════════
            INVITE CODE
        ══════════════════════════════════════════════ */}
        <div className="inv-card">
          <h2 className="inv-card-title">
            <FaGift size={15} color="#2563eb" aria-hidden="true" />
            Your Invite Code
          </h2>

          {hasCode ? (
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
                {copied.code ? (
                  <><FaCheckCircle size={13} aria-hidden="true" /> Copied</>
                ) : (
                  <><FaCopy size={13} aria-hidden="true" /> Copy Code</>
                )}
              </button>
            </div>
          ) : (
            <p className="inv-no-code-msg">
              Generate an invite code to start inviting friends.
            </p>
          )}
        </div>

        {/* ══════════════════════════════════════════════
            INVITE LINK + SHARE
        ══════════════════════════════════════════════ */}
        <div className="inv-card">
          <h2 className="inv-card-title">
            <FaLink size={13} color="#2563eb" aria-hidden="true" />
            Your Invite Link
          </h2>

          {hasCode ? (
            <>
              {/* Link row */}
              <div
                className="inv-link-box"
                aria-label={`Invite link: ${inviteLink}`}
              >
                <span className="inv-link-text" aria-hidden="true">
                  {inviteLink}
                </span>
                <button
                  className={`inv-copy-btn${copied.link ? " copied" : ""}`}
                  onClick={() => handleCopy(inviteLink, "link", "Invite link")}
                  aria-label={copied.link ? "Copied" : "Copy invite link"}
                >
                  {copied.link ? (
                    <><FaCheckCircle size={13} aria-hidden="true" /> Copied</>
                  ) : (
                    <><FaCopy size={13} aria-hidden="true" /> Copy</>
                  )}
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
                    disabled={!hasCode}
                    aria-label={`Share on ${btn.label}`}
                  >
                    <span aria-hidden="true">{btn.icon}</span>
                    {btn.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="inv-no-code-msg">
              Your invite link will appear here once you generate a code.
            </p>
          )}
        </div>

        {/* ══════════════════════════════════════════════
            INVITATION MESSAGE
        ══════════════════════════════════════════════ */}
        <div className="inv-card">
          <div className="inv-msg-header">
            <h2 className="inv-card-title" style={{ marginBottom: 0 }}>
              Invitation Message
            </h2>
            {hasCode && (
              <button
                className="inv-edit-btn"
                onClick={() => setIsEditing((e) => !e)}
                aria-label={isEditing ? "Save message" : "Edit message"}
                aria-pressed={isEditing}
              >
                {isEditing ? (
                  <><FaSave size={12} aria-hidden="true" /> Save</>
                ) : (
                  <><FaEdit size={12} aria-hidden="true" /> Edit</>
                )}
              </button>
            )}
          </div>

          {hasCode ? (
            <>
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
            </>
          ) : (
            <p className="inv-no-code-msg">
              Your invitation message will appear once you have a code.
            </p>
          )}
        </div>

        {/* ══════════════════════════════════════════════
            QR CODE
        ══════════════════════════════════════════════ */}
        <div className="inv-card">
          <h2 className="inv-card-title">QR Code</h2>
          <p className="inv-qr-sub">Scan to join Loemart instantly</p>

          {hasCode ? (
            <>
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
                <SvgDownload size={16} /> Download QR Code
              </button>
            </>
          ) : (
            <p className="inv-no-code-msg">
              QR code will appear once you generate your invite code.
            </p>
          )}
        </div>

        {/* ══════════════════════════════════════════════
            STATS GRID
        ══════════════════════════════════════════════ */}
        <div className="inv-card">
          <h2 className="inv-card-title">
            <SvgChart size={16} /> Referral Stats
          </h2>

          <div
            className="inv-stats-grid"
            role="list"
            aria-label="Referral statistics"
          >
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
          <div
            className="inv-tab-nav"
            role="tablist"
            aria-label="Referral sections"
          >
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
                  id={`tab-${t.key}`}
                  aria-selected={tab === t.key}
                  aria-controls={`tabpanel-${t.key}`}
                  aria-label={t.label}
                >
                  <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", marginRight: 4 }}>
                    {t.icon}
                  </span>
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
            <div
              id="tabpanel-activity"
              role="tabpanel"
              aria-labelledby="tab-activity"
            >
              <h2 className="inv-card-title" style={{ marginTop: 16 }}>
                <SvgPeople size={16} /> Referral Activity
              </h2>

              {!data?.activity?.length ? (
                <div className="inv-empty" aria-label="No referrals yet">
                  <div className="inv-empty-icon" aria-hidden="true">
                    <SvgMailbox size={40} />
                  </div>
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
            <div
              id="tabpanel-events"
              role="tabpanel"
              aria-labelledby="tab-events"
            >
              <h2 className="inv-card-title" style={{ marginTop: 16 }}>
                <SvgLightning size={16} /> Recent Events
              </h2>

              {!data?.events?.length ? (
                <div className="inv-empty" aria-label="No events yet">
                  <div className="inv-empty-icon" aria-hidden="true">
                    <SvgClipboard size={40} />
                  </div>
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
            <div
              id="tabpanel-how"
              role="tabpanel"
              aria-labelledby="tab-how"
            >
              <h2 className="inv-card-title" style={{ marginTop: 16 }}>
                <SvgQuestionMark size={16} /> How It Works
              </h2>
              <div className="inv-how-wrap">
                {HOW_STEPS.map((step, i) => (
                  <div key={i} className="inv-how-step">
                    <div className="inv-how-num" aria-hidden="true">{i + 1}</div>
                    <span style={{ display: "inline-flex" }} aria-hidden="true">
                      {step.icon}
                    </span>
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
          <span style={{ display: "inline-flex" }} aria-hidden="true">
            <SvgFerrisWheel size={36} />
          </span>
          <div style={{ flex: 1 }}>
            <p className="inv-spin-cta-title">Use Your Bonus Spins</p>
            <p className="inv-spin-cta-sub">
              {spinsRemaining > 0
                ? `You have ${spinsRemaining} bonus spin${
                    spinsRemaining !== 1 ? "s" : ""
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
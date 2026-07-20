/**
 * src/pages/CommunityGuidelines/CommunityGuidelines.jsx
 *
 * Static page — no API calls, no auth required.
 * Fully responsive, uses global design tokens.
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./CommunityGuidelines.css";

/* ════════════════════════════════════════════════════════════
   SVG ICONS
════════════════════════════════════════════════════════════ */
const ChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronDown = ({ open }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    className={`cg-chevron ${open ? "cg-chevron--open" : ""}`}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const HeartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5
             5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78
             1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ScaleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" />
    <polyline points="8 8 4 12 8 16" />
    <polyline points="16 8 20 12 16 16" />
  </svg>
);

const BlockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0
             1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const MessageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const FileTextIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const CopyrightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M14.83 14.83a4 4 0 1 1 0-5.66" />
  </svg>
);

const FlagIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const GavelIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 10l-2.5 2.5L8 9l2.5-2.5" />
    <path d="M17.5 6.5l-3-3" />
    <path d="M10 13.5l-3.5 3.5" />
    <path d="M3 21l3-3" />
    <path d="M21 3l-7 7" />
  </svg>
);

const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

/* ════════════════════════════════════════════════════════════
   GUIDELINES DATA
════════════════════════════════════════════════════════════ */
const SECTIONS = [
  {
    id     : "respect",
    num    : 1,
    title  : "Be Respectful",
    Icon   : HeartIcon,
    color  : "#E91E63",
    points : [
      "Treat everyone with courtesy and respect.",
      "Avoid harassment, bullying, discrimination, or hate speech.",
      "Do not threaten, intimidate, or abuse other users.",
    ],
  },
  {
    id     : "honest",
    num    : 2,
    title  : "Be Honest",
    Icon   : CheckIcon,
    color  : "#15803D",
    points : [
      "Provide accurate information in listings and profiles.",
      "Describe products truthfully.",
      "Use real photos of the item whenever possible.",
      "Do not mislead buyers or sellers.",
    ],
  },
  {
    id     : "fair",
    num    : 3,
    title  : "Buy and Sell Fairly",
    Icon   : ScaleIcon,
    color  : "#0284C7",
    points : [
      "Honour agreed prices and payment terms.",
      "Ship or deliver items as promised.",
      "Make payments promptly.",
      "Do not manipulate prices or deceive other users.",
    ],
  },
  {
    id     : "prohibited",
    num    : 4,
    title  : "Prohibited Items",
    Icon   : BlockIcon,
    color  : "#DC2626",
    intro  : "Do not list or sell items that are illegal or restricted, including:",
    points : [
      "Illegal drugs",
      "Weapons and explosives",
      "Counterfeit products",
      "Stolen goods",
      "Dangerous or hazardous materials",
      "Adult or explicit content",
      "Human organs or body parts",
      "Wildlife products prohibited by law",
      "Fraudulent documents",
      "Any item prohibited by applicable laws",
    ],
  },
  {
    id     : "fraud",
    num    : 5,
    title  : "No Fraud or Scams",
    Icon   : AlertIcon,
    color  : "#D97706",
    intro  : "Users must not:",
    points : [
      "Create fake listings.",
      "Impersonate another person or business.",
      "Use fake payment confirmations.",
      "Conduct phishing or identity theft.",
      "Request payments outside approved methods if prohibited.",
      "Attempt to defraud buyers or sellers.",
    ],
  },
  {
    id     : "communication",
    num    : 6,
    title  : "Keep Communication Safe",
    Icon   : MessageIcon,
    color  : "#7C3AED",
    points : [
      "Keep conversations respectful.",
      "Avoid spam or repeated unsolicited messages.",
      "Do not send malicious links or harmful files.",
      "Never ask for sensitive information such as passwords or verification codes.",
    ],
  },
  {
    id     : "privacy",
    num    : 7,
    title  : "Protect Privacy",
    Icon   : LockIcon,
    color  : "#0891B2",
    points : [
      "Respect the privacy of other users.",
      "Do not share another person's personal information without permission.",
      "Use personal information only for completing legitimate transactions.",
    ],
  },
  {
    id     : "listings",
    num    : 8,
    title  : "Accurate Listings",
    Icon   : FileTextIcon,
    color  : "#059669",
    intro  : "Listings should:",
    points : [
      "Include clear titles.",
      "Use genuine photos.",
      "State the correct condition.",
      "Include accurate pricing.",
      "Clearly disclose defects or damage.",
    ],
  },
  {
    id     : "ip",
    num    : 9,
    title  : "Intellectual Property",
    Icon   : CopyrightIcon,
    color  : "#6366F1",
    points : [
      "Only upload content you own or have permission to use.",
      "Do not copy another user's photos or descriptions.",
      "Respect trademarks, copyrights, and patents.",
    ],
  },
  {
    id     : "report",
    num    : 10,
    title  : "Report Problems",
    Icon   : FlagIcon,
    color  : "#F43F5E",
    intro  : "Help keep Loemart safe by reporting:",
    points : [
      "Fraudulent listings",
      "Suspicious behaviour",
      "Harassment",
      "Counterfeit items",
      "Illegal products",
      "Abuse of the platform",
    ],
  },
  {
    id     : "account",
    num    : 11,
    title  : "Account Responsibility",
    Icon   : UserIcon,
    color  : "#2563EB",
    intro  : "You are responsible for:",
    points : [
      "Keeping your account secure.",
      "Maintaining accurate account information.",
      "Not sharing your login credentials.",
      "All activities carried out through your account.",
    ],
  },
  {
    id     : "consequences",
    num    : 12,
    title  : "Consequences of Violations",
    Icon   : GavelIcon,
    color  : "#B91C1C",
    intro  : "If these guidelines are violated, Loemart may:",
    points : [
      "Remove listings.",
      "Remove content.",
      "Issue warnings.",
      "Temporarily restrict account features.",
      "Suspend accounts.",
      "Permanently ban accounts.",
      "Report illegal activities to relevant authorities where required.",
    ],
  },
  {
    id     : "community",
    num    : 13,
    title  : "Help Build a Trusted Community",
    Icon   : UsersIcon,
    color  : "#FF5C00",
    points : [
      "Every member contributes to making Loemart a trusted marketplace. By using the platform, you agree to act honestly, respectfully, and responsibly while following these Community Guidelines and all applicable laws.",
    ],
  },
];

/* ════════════════════════════════════════════════════════════
   ACCORDION ITEM
════════════════════════════════════════════════════════════ */
function GuidelineItem({ section, isOpen, onToggle }) {
  const { num, title, Icon, color, intro, points } = section;
  const contentRef = useRef(null);

  return (
    <div className={`cg-item ${isOpen ? "cg-item--open" : ""}`}>
      <button
        type="button"
        className="cg-item__trigger"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`cg-panel-${section.id}`}
      >
        <span className="cg-item__num" style={{ background: color }}>
          {num}
        </span>

        <span className="cg-item__icon" style={{ color }}>
          <Icon />
        </span>

        <span className="cg-item__title">{title}</span>

        <span className="cg-item__chevron">
          <ChevronDown open={isOpen} />
        </span>
      </button>

      <div
        id={`cg-panel-${section.id}`}
        className={`cg-item__panel ${isOpen ? "cg-item__panel--open" : ""}`}
      >
        <div className="cg-item__panel-inner" ref={contentRef}>
          {intro && <p className="cg-item__intro">{intro}</p>}

          <ul className="cg-item__list">
            {points.map((point, i) => (
              <li key={i} className="cg-item__point">
                <span className="cg-item__bullet" style={{ background: color }} />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TABLE OF CONTENTS — quick jump links
════════════════════════════════════════════════════════════ */
function TableOfContents({ onJump }) {
  return (
    <div className="cg-toc">
      <p className="cg-toc__label">Quick Navigation</p>
      <div className="cg-toc__chips">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="cg-toc__chip"
            onClick={() => onJump(s.id)}
          >
            <span className="cg-toc__chip-num">{s.num}</span>
            {s.title}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════════ */
export default function CommunityGuidelines() {
  const navigate = useNavigate();
  const [openId, setOpenId] = useState(null);

  /* Expand all on large screens by default */
  const [expandAll, setExpandAll] = useState(false);

  const toggle = (id) => {
    if (expandAll) {
      setExpandAll(false);
      setOpenId(id);
      return;
    }
    setOpenId((prev) => (prev === id ? null : id));
  };

  const jumpTo = (id) => {
    setOpenId(id);
    setTimeout(() => {
      document
        .getElementById(`cg-panel-${id}`)
        ?.closest(".cg-item")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const toggleAll = () => {
    setExpandAll((v) => !v);
    if (!expandAll) setOpenId(null);
  };

  return (
    <div className="cg-page">

      {/* Header */}
      <header className="cg-header">
        <button
          type="button"
          className="cg-header__back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ChevronLeft />
        </button>
        <h1 className="cg-header__title">Community Guidelines</h1>
        <div className="cg-header__spacer" />
      </header>

      <main className="cg-main">

        {/* Hero */}
        <section className="cg-hero">
          <div className="cg-hero__icon-wrap">
            <ShieldIcon />
          </div>
          <h2 className="cg-hero__title">Standards for All Users</h2>
          <p className="cg-hero__desc">
            Understand the standards of behaviour expected on Loemart.
            These guidelines help keep the marketplace safe, fair,
            and respectful for everyone.
          </p>
        </section>

        {/* TOC */}
        <TableOfContents onJump={jumpTo} />

        {/* Expand / Collapse all */}
        <div className="cg-toolbar">
          <button
            type="button"
            className="cg-toolbar__btn"
            onClick={toggleAll}
          >
            {expandAll ? "Collapse All" : "Expand All"}
          </button>
        </div>

        {/* Sections */}
        <div className="cg-sections">
          {SECTIONS.map((section) => (
            <GuidelineItem
              key={section.id}
              section={section}
              isOpen={expandAll || openId === section.id}
              onToggle={() => toggle(section.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <footer className="cg-footer">
          <p className="cg-footer__text">
            These guidelines may be updated from time to time.
            Continued use of Loemart constitutes acceptance of
            the latest version.
          </p>
          <p className="cg-footer__copy">
            © {new Date().getFullYear()} Loemart Technologies Ltd.
            All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  );
}
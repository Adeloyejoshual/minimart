/**
 * src/pages/PrivacyPolicy/PrivacyPolicy.jsx
 *
 * Static page — no API calls, no auth required.
 * Accordion sections, quick navigation, design tokens.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./PrivacyPolicy.css";

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
    className={`pp-chevron ${open ? "pp-chevron--open" : ""}`}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const DatabaseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const ZapIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6"  cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59"  y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51"  x2="8.59"  y2="10.49" />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const CookieIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="8"  cy="9"  r="1" fill="currentColor" />
    <circle cx="14" cy="15" r="1" fill="currentColor" />
    <circle cx="15" cy="9"  r="1" fill="currentColor" />
    <path d="M8.5 15a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill="currentColor" />
  </svg>
);

const UserCheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <polyline points="16 11 18 13 22 9" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
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

const ExternalLinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const MessageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

/* ════════════════════════════════════════════════════════════
   POLICY DATA
════════════════════════════════════════════════════════════ */
const SECTIONS = [
  {
    id    : "collect",
    num   : 1,
    title : "Information We Collect",
    Icon  : DatabaseIcon,
    color : "#2563EB",
    subsections: [
      {
        subtitle: "Information You Provide",
        points  : [
          "Full name",
          "Email address",
          "Phone number",
          "Profile photo (optional)",
          "Business information (if applicable)",
          "Delivery or pickup information",
          "Messages sent through the platform",
          "Payment-related information where applicable",
        ],
      },
      {
        subtitle: "Information We Collect Automatically",
        points  : [
          "Device information",
          "IP address",
          "Browser or app information",
          "Operating system",
          "Log data",
          "Usage activity",
          "Cookies and similar technologies",
        ],
      },
    ],
  },
  {
    id    : "use",
    num   : 2,
    title : "How We Use Your Information",
    Icon  : ZapIcon,
    color : "#7C3AED",
    intro : "We use your information to:",
    points: [
      "Create and manage your account.",
      "Facilitate buying and selling.",
      "Process transactions where applicable.",
      "Verify user identity.",
      "Improve platform performance and security.",
      "Personalize your experience.",
      "Send account notifications and important updates.",
      "Respond to customer support requests.",
      "Detect fraud, abuse, and unauthorized activities.",
      "Comply with legal obligations.",
    ],
  },
  {
    id    : "share",
    num   : 3,
    title : "Sharing Your Information",
    Icon  : ShareIcon,
    color : "#0891B2",
    intro : "We may share your information:",
    points: [
      "With buyers or sellers when necessary to complete a transaction.",
      "With trusted service providers who help operate Loemart.",
      "When required by law or legal process.",
      "To protect the safety, rights, and property of Loemart, our users, or the public.",
      "During a business transfer such as a merger, acquisition, or sale of assets.",
    ],
    note  : "We do not sell your personal information to third parties.",
  },
  {
    id    : "security",
    num   : 4,
    title : "Data Security",
    Icon  : LockIcon,
    color : "#15803D",
    body  : "We use reasonable administrative, technical, and organizational measures to protect your information from unauthorized access, disclosure, alteration, or destruction. However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.",
  },
  {
    id    : "cookies",
    num   : 5,
    title : "Cookies and Similar Technologies",
    Icon  : CookieIcon,
    color : "#D97706",
    intro : "We use cookies and similar technologies to:",
    points: [
      "Keep you signed in.",
      "Remember your preferences.",
      "Improve site performance.",
      "Analyze platform usage.",
      "Enhance security.",
    ],
    note  : "You may control cookies through your browser or device settings, although disabling them may affect some features.",
  },
  {
    id    : "rights",
    num   : 6,
    title : "Your Privacy Rights",
    Icon  : UserCheckIcon,
    color : "#E11D48",
    intro : "Depending on applicable law, you may have the right to:",
    points: [
      "Access your personal information.",
      "Correct inaccurate information.",
      "Delete your account or personal information.",
      "Request a copy of your data.",
      "Withdraw consent where processing is based on consent.",
      "Object to certain types of data processing.",
    ],
    note  : "Requests may be subject to legal or operational limitations.",
  },
  {
    id    : "retention",
    num   : 7,
    title : "Data Retention",
    Icon  : ClockIcon,
    color : "#0284C7",
    intro : "We retain your information only for as long as necessary to:",
    points: [
      "Provide our services.",
      "Resolve disputes.",
      "Enforce our agreements.",
      "Meet legal and regulatory requirements.",
    ],
    note  : "When information is no longer required, we will securely delete or anonymize it where appropriate.",
  },
  {
    id    : "children",
    num   : 8,
    title : "Children's Privacy",
    Icon  : ShieldIcon,
    color : "#7C3AED",
    body  : "Loemart is not intended for children under the age required by applicable law. We do not knowingly collect personal information from children. If we become aware that such information has been collected, we will take reasonable steps to remove it.",
  },
  {
    id    : "third-party",
    num   : 9,
    title : "Third-Party Services",
    Icon  : ExternalLinkIcon,
    color : "#6366F1",
    body  : "Loemart may contain links to or integrate with third-party services. We are not responsible for the privacy practices or content of those third parties. We encourage you to review their privacy policies before using their services.",
  },
  {
    id    : "changes",
    num   : 10,
    title : "Changes to This Privacy Policy",
    Icon  : RefreshIcon,
    color : "#0891B2",
    body  : "We may update this Privacy Policy from time to time. When significant changes are made, we will notify users through the platform or by other appropriate means. Continued use of Loemart after updates means you accept the revised Privacy Policy.",
  },
  {
    id    : "contact",
    num   : 11,
    title : "Contact Us",
    Icon  : MessageIcon,
    color : "#FF5C00",
    body  : "If you have questions, concerns, or requests regarding this Privacy Policy or your personal information, please contact the Loemart support team through the available support channels within the platform.",
  },
];

/* ════════════════════════════════════════════════════════════
   ACCORDION ITEM
════════════════════════════════════════════════════════════ */
function PolicyItem({ section, isOpen, onToggle }) {
  const { num, title, Icon, color, intro, body, note, points, subsections } = section;

  return (
    <div className={`pp-item ${isOpen ? "pp-item--open" : ""}`}>

      {/* Trigger */}
      <button
        type="button"
        className="pp-item__trigger"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`pp-panel-${section.id}`}
      >
        <span className="pp-item__num" style={{ background: color }}>
          {num}
        </span>
        <span className="pp-item__icon" style={{ color }}>
          <Icon />
        </span>
        <span className="pp-item__title">{title}</span>
        <span className="pp-item__chevron">
          <ChevronDown open={isOpen} />
        </span>
      </button>

      {/* Panel */}
      <div
        id={`pp-panel-${section.id}`}
        className={`pp-item__panel ${isOpen ? "pp-item__panel--open" : ""}`}
      >
        <div className="pp-item__panel-inner">

          {/* Plain body paragraph */}
          {body && <p className="pp-item__body">{body}</p>}

          {/* Intro + simple list */}
          {intro && <p className="pp-item__intro">{intro}</p>}
          {points && (
            <ul className="pp-item__list">
              {points.map((pt, i) => (
                <li key={i} className="pp-item__point">
                  <span className="pp-item__bullet" style={{ background: color }} />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Subsections (for section 1) */}
          {subsections && subsections.map((sub, si) => (
            <div key={si} className="pp-subsection">
              <h4 className="pp-subsection__title">{sub.subtitle}</h4>
              <ul className="pp-item__list">
                {sub.points.map((pt, i) => (
                  <li key={i} className="pp-item__point">
                    <span className="pp-item__bullet" style={{ background: color }} />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Note / disclaimer */}
          {note && (
            <div className="pp-item__note" style={{ borderColor: color }}>
              <span className="pp-item__note-dot" style={{ background: color }} />
              <p>{note}</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TABLE OF CONTENTS
════════════════════════════════════════════════════════════ */
function TableOfContents({ onJump }) {
  return (
    <div className="pp-toc">
      <p className="pp-toc__label">Quick Navigation</p>
      <div className="pp-toc__chips">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="pp-toc__chip"
            onClick={() => onJump(s.id)}
          >
            <span className="pp-toc__chip-num">{s.num}</span>
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
export default function PrivacyPolicy() {
  const navigate   = useNavigate();
  const [openId,   setOpenId]   = useState(null);
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
        .getElementById(`pp-panel-${id}`)
        ?.closest(".pp-item")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const toggleAll = () => {
    setExpandAll((v) => !v);
    if (!expandAll) setOpenId(null);
  };

  return (
    <div className="pp-page">

      {/* Header */}
      <header className="pp-header">
        <button
          type="button"
          className="pp-header__back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ChevronLeft />
        </button>
        <h1 className="pp-header__title">Privacy Policy</h1>
        <div className="pp-header__spacer" />
      </header>

      <main className="pp-main">

        {/* Hero */}
        <section className="pp-hero">
          <div className="pp-hero__icon-wrap">
            <ShieldIcon />
          </div>
          <h2 className="pp-hero__title">Your Privacy Matters</h2>
          <p className="pp-hero__desc">
            At Loemart, we value your privacy and are committed to
            protecting your personal information. This policy explains
            what we collect, how we use it, and the choices you have
            regarding your data.
          </p>
          <span className="pp-hero__effective">
            Effective Date: [Insert Date]
          </span>
        </section>

        {/* Highlight strip */}
        <div className="pp-highlight">
          <div className="pp-highlight__item">
            <span className="pp-highlight__icon">🔒</span>
            <span>We protect your data</span>
          </div>
          <div className="pp-highlight__divider" />
          <div className="pp-highlight__item">
            <span className="pp-highlight__icon">🚫</span>
            <span>We never sell your info</span>
          </div>
          <div className="pp-highlight__divider" />
          <div className="pp-highlight__item">
            <span className="pp-highlight__icon">✅</span>
            <span>You control your data</span>
          </div>
        </div>

        {/* Table of contents */}
        <TableOfContents onJump={jumpTo} />

        {/* Expand / Collapse all */}
        <div className="pp-toolbar">
          <button
            type="button"
            className="pp-toolbar__btn"
            onClick={toggleAll}
          >
            {expandAll ? "Collapse All" : "Expand All"}
          </button>
        </div>

        {/* Sections */}
        <div className="pp-sections">
          {SECTIONS.map((section) => (
            <PolicyItem
              key={section.id}
              section={section}
              isOpen={expandAll || openId === section.id}
              onToggle={() => toggle(section.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <footer className="pp-footer">
          <p className="pp-footer__text">
            By using Loemart, you agree to the practices described
            in this Privacy Policy.
          </p>
          <p className="pp-footer__copy">
            © {new Date().getFullYear()} Loemart Technologies Ltd.
            All rights reserved.
          </p>
        </footer>

      </main>
    </div>
  );
}
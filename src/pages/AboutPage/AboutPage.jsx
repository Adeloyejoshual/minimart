/**
 * src/pages/AboutPage/AboutPage.jsx
 *
 * Static page — no API calls, no auth required.
 * Accordion sections, design tokens, fully responsive.
 */

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./AboutPage.css";

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
    className={`ab-chevron ${open ? "ab-chevron--open" : ""}`}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const TargetIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const ZapIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const HeartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06
             a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78
             1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
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

const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02
                     12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const LightbulbIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="9"  y1="18" x2="15" y2="18" />
    <line x1="10" y1="22" x2="14" y2="22" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18
             10 6 6 0 0 0 6 10c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1
             8.91 14" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const GrowthIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

const MessageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const StoreIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

/* ════════════════════════════════════════════════════════════
   DATA
════════════════════════════════════════════════════════════ */
const FEATURES = [
  "Buy products from trusted sellers.",
  "Sell products to customers locally and beyond.",
  "Manage your listings with ease.",
  "Communicate directly with buyers and sellers.",
  "Track your marketplace activities.",
  "Receive notifications about orders, offers, and updates.",
  "Report inappropriate content or suspicious activities.",
  "Access customer support whenever you need assistance.",
];

const WHY_ITEMS = [
  {
    Icon  : ShieldIcon,
    color : "#15803D",
    title : "Trusted Marketplace",
    desc  : "We are committed to creating an environment where buyers and sellers can interact with confidence.",
  },
  {
    Icon  : HeartIcon,
    color : "#E11D48",
    title : "User-Focused Experience",
    desc  : "Our platform is designed with simplicity and ease of use in mind, making it accessible for everyone.",
  },
  {
    Icon  : CheckCircleIcon,
    color : "#0284C7",
    title : "Secure Platform",
    desc  : "We continuously work to improve security measures that help protect user accounts, personal information, and marketplace activities.",
  },
  {
    Icon  : UsersIcon,
    color : "#7C3AED",
    title : "Fair Community",
    desc  : "We promote respectful interactions and expect all members to follow our Community Guidelines.",
  },
  {
    Icon  : MessageIcon,
    color : "#D97706",
    title : "Dedicated Support",
    desc  : "Our support team is available to assist with account issues, disputes, technical problems, and general inquiries.",
  },
];

const VALUES = [
  {
    Icon  : StarIcon,
    color : "#D97706",
    title : "Trust",
    desc  : "Building confidence between buyers, sellers, and the Loemart community.",
  },
  {
    Icon  : CheckCircleIcon,
    color : "#15803D",
    title : "Integrity",
    desc  : "Operating with honesty, transparency, and accountability.",
  },
  {
    Icon  : LightbulbIcon,
    color : "#6366F1",
    title : "Innovation",
    desc  : "Continuously improving our platform with new ideas and technologies.",
  },
  {
    Icon  : UsersIcon,
    color : "#0891B2",
    title : "Community",
    desc  : "Supporting individuals, entrepreneurs, and businesses as they grow.",
  },
  {
    Icon  : ShieldIcon,
    color : "#E11D48",
    title : "Safety",
    desc  : "Providing policies, tools, and moderation that help keep our marketplace secure.",
  },
];

const SECTIONS = [
  {
    id    : "mission",
    num   : 1,
    title : "Our Mission",
    Icon  : TargetIcon,
    color : "#FF5C00",
    body  : "Our mission is to empower individuals and businesses by providing a marketplace that is safe, innovative, and easy to use. We aim to remove barriers to commerce by connecting people, supporting entrepreneurs, and creating opportunities for everyone to buy and sell with confidence.",
  },
  {
    id    : "vision",
    num   : 2,
    title : "Our Vision",
    Icon  : EyeIcon,
    color : "#7C3AED",
    body  : "Our vision is to become one of the most trusted digital marketplaces, connecting communities and businesses through technology while promoting fairness, transparency, and economic growth.",
  },
  {
    id    : "features",
    num   : 3,
    title : "What You Can Do on Loemart",
    Icon  : ZapIcon,
    color : "#0284C7",
    intro : "Loemart offers a range of features designed to make your marketplace experience seamless.",
    points: FEATURES,
    note  : "As Loemart continues to grow, new features and improvements will be introduced to better serve our community.",
  },
  {
    id      : "why",
    num     : 4,
    title   : "Why Choose Loemart",
    Icon    : StarIcon,
    color   : "#D97706",
    cards   : WHY_ITEMS,
  },
  {
    id      : "values",
    num     : 5,
    title   : "Our Core Values",
    Icon    : HeartIcon,
    color   : "#E11D48",
    cards   : VALUES,
  },
  {
    id    : "safety",
    num   : 6,
    title : "Our Commitment to Safety",
    Icon  : ShieldIcon,
    color : "#15803D",
    body  : "Creating a safe marketplace is one of our highest priorities. Loemart works to reduce fraud, misleading listings, scams, spam, and abusive behavior through platform monitoring, reporting tools, account moderation, and enforcement of our Community Guidelines. Users are encouraged to report suspicious activity so appropriate action can be taken.",
  },
  {
    id    : "privacy",
    num   : 7,
    title : "Privacy Matters",
    Icon  : CheckCircleIcon,
    color : "#0891B2",
    body  : "We respect your privacy and are committed to protecting your personal information. Our Privacy Policy explains what information we collect, how we use it, how we protect it, and the choices available to you regarding your data.",
    link  : { to: "/privacy", label: "Read our Privacy Policy" },
  },
  {
    id    : "community",
    num   : 8,
    title : "Community Standards",
    Icon  : UsersIcon,
    color : "#6366F1",
    body  : "Every member of Loemart is expected to contribute to a respectful and trustworthy marketplace. Our Community Guidelines outline acceptable behavior and help ensure that buyers and sellers interact fairly, honestly, and respectfully.",
    link  : { to: "/community-guidelines", label: "Read our Community Guidelines" },
  },
  {
    id    : "growth",
    num   : 9,
    title : "Growing Together",
    Icon  : GrowthIcon,
    color : "#059669",
    body  : "Loemart is built for individuals, entrepreneurs, small businesses, and established brands alike. Whether you're selling your first product or managing a growing business, we're committed to providing the tools, support, and opportunities you need to succeed. As our community expands, we'll continue investing in better features, improved security, and enhanced user experiences.",
  },
  {
    id    : "contact",
    num   : 10,
    title : "Contact Us",
    Icon  : MessageIcon,
    color : "#FF5C00",
    body  : "If you have questions, feedback, or need assistance, our support team is here to help.",
    links : [
      { to: "/help",    label: "Visit the Help Center" },
      { to: "/support", label: "Contact Support" },
    ],
  },
];

/* ════════════════════════════════════════════════════════════
   CARD GRID — reused in Why + Values sections
════════════════════════════════════════════════════════════ */
function CardGrid({ cards }) {
  return (
    <div className="ab-card-grid">
      {cards.map((card, i) => {
        const Icon = card.Icon;
        return (
          <div key={i} className="ab-card">
            <span className="ab-card__icon" style={{ color: card.color }}>
              <Icon />
            </span>
            <h4 className="ab-card__title">{card.title}</h4>
            <p className="ab-card__desc">{card.desc}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   ACCORDION ITEM
════════════════════════════════════════════════════════════ */
function AboutItem({ section, isOpen, onToggle }) {
  const {
    num, title, Icon, color,
    body, intro, points, note, cards, link, links,
  } = section;

  return (
    <div className={`ab-item ${isOpen ? "ab-item--open" : ""}`}>

      <button
        type="button"
        className="ab-item__trigger"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`ab-panel-${section.id}`}
      >
        <span className="ab-item__num" style={{ background: color }}>
          {num}
        </span>
        <span className="ab-item__icon" style={{ color }}>
          <Icon />
        </span>
        <span className="ab-item__title">{title}</span>
        <span className="ab-item__chevron">
          <ChevronDown open={isOpen} />
        </span>
      </button>

      <div
        id={`ab-panel-${section.id}`}
        className={`ab-item__panel ${isOpen ? "ab-item__panel--open" : ""}`}
      >
        <div className="ab-item__panel-inner">

          {body && <p className="ab-item__body">{body}</p>}

          {intro && <p className="ab-item__intro">{intro}</p>}

          {points && (
            <ul className="ab-item__list">
              {points.map((pt, i) => (
                <li key={i} className="ab-item__point">
                  <span className="ab-item__bullet" style={{ background: color }} />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          )}

          {cards && <CardGrid cards={cards} />}

          {note && (
            <div className="ab-item__note" style={{ borderColor: color }}>
              <span className="ab-item__note-dot" style={{ background: color }} />
              <p>{note}</p>
            </div>
          )}

          {link && (
            <Link to={link.to} className="ab-item__link" style={{ color }}>
              {link.label} →
            </Link>
          )}

          {links && (
            <div className="ab-item__links">
              {links.map((l, i) => (
                <Link key={i} to={l.to} className="ab-item__link" style={{ color }}>
                  {l.label} →
                </Link>
              ))}
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
    <div className="ab-toc">
      <p className="ab-toc__label">Quick Navigation</p>
      <div className="ab-toc__chips">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="ab-toc__chip"
            onClick={() => onJump(s.id)}
          >
            <span className="ab-toc__chip-num">{s.num}</span>
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
export default function AboutPage() {
  const navigate    = useNavigate();
  const [openId,    setOpenId]    = useState(null);
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
        .getElementById(`ab-panel-${id}`)
        ?.closest(".ab-item")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const toggleAll = () => {
    setExpandAll((v) => !v);
    if (!expandAll) setOpenId(null);
  };

  return (
    <div className="ab-page">

      {/* Header */}
      <header className="ab-header">
        <button
          type="button"
          className="ab-header__back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ChevronLeft />
        </button>
        <h1 className="ab-header__title">About Loemart</h1>
        <div className="ab-header__spacer" />
      </header>

      <main className="ab-main">

        {/* Hero */}
        <section className="ab-hero">
          <div className="ab-hero__orb ab-hero__orb--1" />
          <div className="ab-hero__orb ab-hero__orb--2" />

          <div className="ab-hero__content">
            <div className="ab-hero__icon-wrap">
              <StoreIcon />
            </div>
            <h2 className="ab-hero__title">Welcome to Loemart</h2>
            <p className="ab-hero__desc">
              A modern online marketplace that connects buyers and sellers
              in a trusted, secure, and community-driven environment.
              Whether you're looking to discover great products, grow your
              business, or reach more customers — Loemart makes it simple,
              reliable, and accessible.
            </p>
          </div>

          {/* Stat strip */}
          <div className="ab-hero__stats">
            <div className="ab-hero__stat">
              <span className="ab-hero__stat-icon" style={{ color: "#FF5C00" }}>
                <UsersIcon />
              </span>
              <span className="ab-hero__stat-label">For Everyone</span>
            </div>
            <div className="ab-hero__stat-divider" />
            <div className="ab-hero__stat">
              <span className="ab-hero__stat-icon" style={{ color: "#15803D" }}>
                <ShieldIcon />
              </span>
              <span className="ab-hero__stat-label">Secure & Trusted</span>
            </div>
            <div className="ab-hero__stat-divider" />
            <div className="ab-hero__stat">
              <span className="ab-hero__stat-icon" style={{ color: "#7C3AED" }}>
                <GrowthIcon />
              </span>
              <span className="ab-hero__stat-label">Built to Grow</span>
            </div>
          </div>
        </section>

        {/* TOC */}
        <TableOfContents onJump={jumpTo} />

        {/* Expand / Collapse all */}
        <div className="ab-toolbar">
          <button
            type="button"
            className="ab-toolbar__btn"
            onClick={toggleAll}
          >
            {expandAll ? "Collapse All" : "Expand All"}
          </button>
        </div>

        {/* Sections */}
        <div className="ab-sections">
          {SECTIONS.map((section) => (
            <AboutItem
              key={section.id}
              section={section}
              isOpen={expandAll || openId === section.id}
              onToggle={() => toggle(section.id)}
            />
          ))}
        </div>

        {/* Thank you banner */}
        <div className="ab-thanks">
          <div className="ab-thanks__shine" aria-hidden="true" />
          <span className="ab-thanks__icon"><HeartIcon /></span>
          <div>
            <p className="ab-thanks__title">Thank You</p>
            <p className="ab-thanks__body">
              Thank you for being part of the Loemart community. Together,
              we're building more than a marketplace — we're creating a
              trusted platform where people can discover opportunities,
              grow businesses, and connect with confidence.
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="ab-footer">
          <p className="ab-footer__copy">
            © {new Date().getFullYear()} Loemart Technologies Ltd.
            All rights reserved.
          </p>
          <div className="ab-footer__links">
            <Link to="/terms">Terms</Link>
            <span>·</span>
            <Link to="/privacy">Privacy</Link>
            <span>·</span>
            <Link to="/community-guidelines">Guidelines</Link>
            <span>·</span>
            <Link to="/support">Support</Link>
          </div>
        </footer>

      </main>
    </div>
  );
}
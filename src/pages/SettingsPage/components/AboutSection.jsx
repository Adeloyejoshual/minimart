/**
 * src/pages/SettingsPage/components/AboutSection.jsx
 *
 * About section — dropdown accordion style.
 * Each item expands to show a brief description + navigate button.
 * App version row removed as requested.
 * SVG icons, uses design tokens.
 */

import { useState }    from "react";
import { useNavigate } from "react-router-dom";

import SettingsSection from "./SettingsSection.jsx";
import "../styles/AboutSection.css";

/* ────────────────────────────────────────────────────────────
   SVG ICONS
──────────────────────────────────────────────────────────── */
const FileTextIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8"  y2="13" />
    <line x1="16" y1="17" x2="8"  y2="17" />
    <line x1="10" y1="9"  x2="8"  y2="9"  />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    className={`about-dd__chevron ${open ? "about-dd__chevron--open" : ""}`}
    aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/* ────────────────────────────────────────────────────────────
   DATA
──────────────────────────────────────────────────────────── */
const ITEMS = [
  {
    key   : "terms",
    to    : "/terms",
    Icon  : FileTextIcon,
    label : "Terms & Conditions",
    desc  : "Usage rules and policies",
    body  : "Review the rules and agreements that govern your use of Loemart, including buying, selling, payments, and account conduct.",
    cta   : "Read Terms",
  },
  {
    key   : "privacy",
    to    : "/privacy",
    Icon  : ShieldIcon,
    label : "Privacy Policy",
    desc  : "How we handle your data",
    body  : "Learn how Loemart collects, stores, and protects your personal information. Your privacy and data security matter to us.",
    cta   : "Read Privacy Policy",
  },
  {
    key   : "community",
    to    : "/community-guidelines",
    Icon  : UsersIcon,
    label : "Community Guidelines",
    desc  : "Standards for all users",
    body  : "Understand the standards of behaviour expected on Loemart. These guidelines help keep the marketplace safe, fair, and respectful for everyone.",
    cta   : "Read Guidelines",
  },
];

/* ────────────────────────────────────────────────────────────
   COMPONENT
──────────────────────────────────────────────────────────── */
export default function AboutSection() {
  const navigate = useNavigate();
  const [openKey, setOpenKey] = useState(null);

  const toggle = (key) =>
    setOpenKey((prev) => (prev === key ? null : key));

  return (
    <SettingsSection title="About">
      <div className="about-dd">
        {ITEMS.map((item, index) => {
          const isOpen = openKey === item.key;
          const isLast = index === ITEMS.length - 1;
          const Icon   = item.Icon;

          return (
            <div
              key={item.key}
              className={[
                "about-dd__item",
                isOpen ? "about-dd__item--open" : "",
                isLast ? "about-dd__item--last" : "",
              ].join(" ")}
            >
              {/* Trigger row */}
              <button
                type="button"
                className="about-dd__trigger"
                onClick={() => toggle(item.key)}
                aria-expanded={isOpen}
                aria-controls={`about-panel-${item.key}`}
              >
                <div className="about-dd__left">
                  <span className="about-dd__icon">
                    <Icon />
                  </span>
                  <div className="about-dd__text">
                    <span className="about-dd__label">{item.label}</span>
                    <span className="about-dd__desc">{item.desc}</span>
                  </div>
                </div>

                <span className="about-dd__right">
                  <ChevronIcon open={isOpen} />
                </span>
              </button>

              {/* Dropdown panel */}
              <div
                id={`about-panel-${item.key}`}
                className={`about-dd__panel ${isOpen ? "about-dd__panel--open" : ""}`}
              >
                <div className="about-dd__panel-inner">
                  <p className="about-dd__body">{item.body}</p>

                  <button
                    type="button"
                    className="about-dd__action"
                    onClick={() => navigate(item.to)}
                  >
                    {item.cta}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SettingsSection>
  );
}
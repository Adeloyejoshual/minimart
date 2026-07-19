import { useState }   from "react";
import { useNavigate } from "react-router-dom";

import SettingsSection from "./SettingsSection.jsx";
import "../styles/SupportSection.css";

/* ────────────────────────────────────────────────────────────
   SVG ICONS
──────────────────────────────────────────────────────────── */
const SupportIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const HelpIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`support-dd__chevron ${open ? "support-dd__chevron--open" : ""}`}
    aria-hidden="true"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ITEMS = [
  {
    key   : "support",
    to    : "/support",
    Icon  : SupportIcon,
    label : "Help & Support",
    desc  : "Tickets, disputes, appeals",
    body  :
      "Get direct help from Loemart support. Manage tickets, report problems, handle disputes, submit appeals, and contact the team.",
    cta   : "Open Support Hub",
  },
  {
    key   : "help",
    to    : "/help",
    Icon  : HelpIcon,
    label : "Help Center",
    desc  : "Browse FAQs and articles",
    body  :
      "Find answers to common questions, read step-by-step guides, and learn how Loemart features work.",
    cta   : "Open Help Center",
  },
];

/* ────────────────────────────────────────────────────────────
   COMPONENT
──────────────────────────────────────────────────────────── */
export default function SupportSection() {
  const navigate = useNavigate();
  const [openKey, setOpenKey] = useState(null);

  const toggle = (key) => {
    setOpenKey((prev) => (prev === key ? null : key));
  };

  return (
    <SettingsSection title="Support">
      <div className="support-dd">
        {ITEMS.map((item, index) => {
          const isOpen = openKey === item.key;
          const isLast = index === ITEMS.length - 1;
          const Icon   = item.Icon;

          return (
            <div
              key={item.key}
              className={[
                "support-dd__item",
                isOpen ? "support-dd__item--open" : "",
                isLast ? "support-dd__item--last" : "",
              ].join(" ")}
            >
              <button
                type="button"
                className="support-dd__trigger"
                onClick={() => toggle(item.key)}
                aria-expanded={isOpen}
                aria-controls={`support-panel-${item.key}`}
              >
                <div className="support-dd__left">
                  <span className="support-dd__icon">
                    <Icon />
                  </span>

                  <div className="support-dd__text">
                    <span className="support-dd__label">{item.label}</span>
                    <span className="support-dd__desc">{item.desc}</span>
                  </div>
                </div>

                <span className="support-dd__right">
                  <ChevronIcon open={isOpen} />
                </span>
              </button>

              <div
                id={`support-panel-${item.key}`}
                className={`support-dd__panel ${isOpen ? "support-dd__panel--open" : ""}`}
              >
                <div className="support-dd__panel-inner">
                  <p className="support-dd__body">{item.body}</p>

                  <button
                    type="button"
                    className="support-dd__action"
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
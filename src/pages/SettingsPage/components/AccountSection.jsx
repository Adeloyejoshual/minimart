/**
 * src/pages/SettingsPage/components/AccountSection.jsx
 *
 * Account settings — dropdown accordion style.
 * Items inside:
 *   - Edit Profile      → navigates to /profile/edit
 *   - Change Password   → navigates to /settings/change-password
 *   - Two-Factor Auth   → disabled, coming soon
 *
 * Email and phone removed as requested.
 * SVG icons, design tokens, own scoped stylesheet.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import SettingsSection from "./SettingsSection.jsx";
import "../styles/AccountSection.css";

/* ════════════════════════════════════════════════════════════
   SVG ICONS
════════════════════════════════════════════════════════════ */
const AccountMainIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const KeyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778
             5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22
             7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    className={`acct-dd__chevron ${open ? "acct-dd__chevron--open" : ""}`}
    aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

/* ════════════════════════════════════════════════════════════
   ITEMS CONFIG
════════════════════════════════════════════════════════════ */
const ACCOUNT_ITEMS = [
  {
    key      : "profile",
    Icon     : UserIcon,
    label    : "Edit Profile",
    desc     : "Update your name, bio and photo",
    to       : "/profile/edit",
    disabled : false,
    badge    : null,
  },
  {
    key      : "password",
    Icon     : KeyIcon,
    label    : "Change Password",
    desc     : "Update your login password",
    to       : "/settings/change-password",
    disabled : false,
    badge    : null,
  },
  {
    key      : "2fa",
    Icon     : ShieldIcon,
    label    : "Two-Factor Authentication",
    desc     : "Add an extra layer of security",
    to       : null,
    disabled : true,
    badge    : "Coming Soon",
  },
];

/* ════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════ */
export default function AccountSection({ settings }) {
  const { user } = settings;
  const navigate  = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <SettingsSection title="Account">
      <div className="acct-dd">

        {/* Trigger row */}
        <button
          type="button"
          className="acct-dd__trigger"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="acct-dd-panel"
        >
          <div className="acct-dd__left">
            <span className="acct-dd__icon">
              <AccountMainIcon />
            </span>
            <div className="acct-dd__text">
              <span className="acct-dd__label">Account Settings</span>
              <span className="acct-dd__desc">
                {user?.name ?? "Profile, password and security"}
              </span>
            </div>
          </div>
          <span className="acct-dd__right">
            <ChevronIcon open={open} />
          </span>
        </button>

        {/* Dropdown panel */}
        <div
          id="acct-dd-panel"
          className={`acct-dd__panel ${open ? "acct-dd__panel--open" : ""}`}
        >
          <div className="acct-dd__panel-inner">
            {ACCOUNT_ITEMS.map((item, i) => {
              const Icon   = item.Icon;
              const isLast = i === ACCOUNT_ITEMS.length - 1;

              if (item.disabled) {
                return (
                  <div
                    key={item.key}
                    className={`acct-dd__action acct-dd__action--disabled ${
                      isLast ? "acct-dd__action--last" : ""
                    }`}
                    aria-disabled="true"
                  >
                    <span className="acct-dd__action-icon">
                      <Icon />
                    </span>
                    <div className="acct-dd__action-text">
                      <span className="acct-dd__action-label">
                        {item.label}
                      </span>
                      <span className="acct-dd__action-desc">{item.desc}</span>
                    </div>
                    {item.badge && (
                      <span className="acct-dd__badge">{item.badge}</span>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={item.key}
                  type="button"
                  className={`acct-dd__action ${
                    isLast ? "acct-dd__action--last" : ""
                  }`}
                  onClick={() => navigate(item.to)}
                >
                  <span className="acct-dd__action-icon">
                    <Icon />
                  </span>
                  <div className="acct-dd__action-text">
                    <span className="acct-dd__action-label">{item.label}</span>
                    <span className="acct-dd__action-desc">{item.desc}</span>
                  </div>
                  <span className="acct-dd__action-arrow">
                    <ArrowRightIcon />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </SettingsSection>
  );
}
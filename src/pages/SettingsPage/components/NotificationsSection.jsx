/**
 * src/pages/SettingsPage/components/NotificationsSection.jsx
 *
 * Dropdown accordion — click to expand, toggle notifications inside.
 * SVG icons, design tokens, own scoped stylesheet.
 */

import { useState } from "react";
import SettingsSection from "./SettingsSection.jsx";
import "../styles/NotificationsSection.css";

/* ── SVG Icons ── */
const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <polyline points="22,7 12,13 2,7" />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    className={`notif-dd__chevron ${open ? "notif-dd__chevron--open" : ""}`}
    aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const NotifMainIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    <path d="M2 2l20 20" opacity="0" />
  </svg>
);

/* ── Toggle items data ── */
const ITEMS = [
  {
    key   : "push",
    Icon  : BellIcon,
    label : "Push Notifications",
    desc  : "Alerts for messages and activity",
  },
  {
    key   : "email",
    Icon  : MailIcon,
    label : "Email Notifications",
    desc  : "Updates sent to your inbox",
  },
];

/* ── Component ── */
export default function NotificationsSection({ settings }) {
  const { notifPrefs, toggleNotif } = settings;
  const [open, setOpen] = useState(false);

  return (
    <SettingsSection title="Notifications">
      <div className="notif-dd">

        {/* Trigger */}
        <button
          type="button"
          className="notif-dd__trigger"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="notif-dd-panel"
        >
          <div className="notif-dd__left">
            <span className="notif-dd__icon">
              <NotifMainIcon />
            </span>
            <div className="notif-dd__text">
              <span className="notif-dd__label">Notification Preferences</span>
              <span className="notif-dd__desc">
                Control how you receive alerts
              </span>
            </div>
          </div>
          <span className="notif-dd__right">
            <ChevronIcon open={open} />
          </span>
        </button>

        {/* Panel */}
        <div
          id="notif-dd-panel"
          className={`notif-dd__panel ${open ? "notif-dd__panel--open" : ""}`}
        >
          <div className="notif-dd__panel-inner">
            {ITEMS.map((item, i) => {
              const Icon    = item.Icon;
              const checked = notifPrefs[item.key] ?? true;
              const isLast  = i === ITEMS.length - 1;

              return (
                <div
                  key={item.key}
                  className={`notif-dd__row ${isLast ? "notif-dd__row--last" : ""}`}
                >
                  <div className="notif-dd__row-left">
                    <span className="notif-dd__row-icon">
                      <Icon />
                    </span>
                    <div className="notif-dd__row-text">
                      <span className="notif-dd__row-label">{item.label}</span>
                      <span className="notif-dd__row-desc">{item.desc}</span>
                    </div>
                  </div>

                  <label
                    className={`notif-toggle ${checked ? "notif-toggle--on" : ""}`}
                    aria-label={`Toggle ${item.label}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleNotif(item.key)}
                    />
                    <span className="notif-toggle__track">
                      <span className="notif-toggle__thumb" />
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
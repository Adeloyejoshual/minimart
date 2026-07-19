/**
 * src/pages/SettingsPage/components/PreferencesSection.jsx
 *
 * Appearance (Light / Dark / System) — pill group with SVG icons
 * Language section removed as requested.
 * Own scoped stylesheet imported below.
 */

import SettingsSection from "./SettingsSection.jsx";
import "../styles/PreferencesSection.css";

/* ── SVG icons — transparent, inherits currentColor ── */

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1"  x2="12" y2="3"  />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22"  y1="4.22"  x2="5.64"  y2="5.64"  />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1"  y1="12" x2="3"  y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36" />
    <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SystemIcon = () => (
  <svg viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8"  y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const PaletteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="13.5" cy="6.5"  r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5"  cy="7.5"  r=".5" fill="currentColor" />
    <circle cx="6.5"  cy="12.5" r=".5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688
             0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64
             1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554
             C21.965 6.012 17.461 2 12 2z" />
  </svg>
);

/* ── Theme config ── */
const THEME_OPTIONS = [
  { value: "light",  label: "Light",  Icon: SunIcon    },
  { value: "dark",   label: "Dark",   Icon: MoonIcon   },
  { value: "system", label: "System", Icon: SystemIcon },
];

/* ════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════ */
export default function PreferencesSection({ settings }) {
  const { theme, setTheme } = settings;

  return (
    <SettingsSection title="Preferences">
      <div className="pref-section">

        {/* ── Appearance row ── */}
        <div className="pref-row">
          <div className="pref-row__left">
            <span className="pref-row__icon" aria-hidden="true">
              <PaletteIcon />
            </span>
            <span className="pref-row__label">Appearance</span>
          </div>

          <div className="pref-row__control">
            <div
              className="pref-theme-group"
              role="group"
              aria-label="Select theme"
            >
              {THEME_OPTIONS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  className={[
                    "pref-theme-btn",
                    theme === value ? "pref-theme-btn--active" : "",
                  ].join(" ").trim()}
                  onClick={() => setTheme(value)}
                  aria-pressed={theme === value}
                  aria-label={`${label} theme`}
                >
                  <Icon />
                  <span className="pref-theme-btn__label">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </SettingsSection>
  );
}
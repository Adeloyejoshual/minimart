import SettingsSection from "./SettingsSection.jsx";
import SettingsItem    from "./SettingsItem.jsx";

const THEME_LABELS = {
  light  : "☀️  Light",
  dark   : "🌙  Dark",
  system : "⚙️  System",
};

export default function PreferencesSection({ settings }) {
  const {
    theme, setTheme, THEMES,
    language, setLanguage, LANGUAGES,
  } = settings;

  return (
    <SettingsSection title="Preferences">

      {/* Appearance */}
      <SettingsItem
        icon="🎨"
        label="Appearance"
        control={
          <select
            className="settings-select"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            aria-label="Select theme"
          >
            {THEMES.map((t) => (
              <option key={t} value={t}>
                {THEME_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        }
      />

      {/* Language */}
      <SettingsItem
        icon="🌐"
        label="Language"
        last
        control={
          <select
            className="settings-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label="Select language"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        }
      />

    </SettingsSection>
  );
}
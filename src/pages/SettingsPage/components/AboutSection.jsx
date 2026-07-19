import SettingsSection from "./SettingsSection.jsx";
import SettingsItem    from "./SettingsItem.jsx";

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "1.0.0";

export default function AboutSection() {
  return (
    <SettingsSection title="About">

      <SettingsItem
        icon="📄"
        label="Terms &amp; Conditions"
        to="/terms"
      />

      <SettingsItem
        icon="🔐"
        label="Privacy Policy"
        to="/privacy"
      />

      <SettingsItem
        icon="🤝"
        label="Community Guidelines"
        to="/community-guidelines"
      />

      <SettingsItem
        icon="ℹ️"
        label="App Version"
        sublabel={`v${APP_VERSION}`}
        last
      />

    </SettingsSection>
  );
}
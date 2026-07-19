import SettingsSection from "./SettingsSection.jsx";
import SettingsItem    from "./SettingsItem.jsx";

export default function PrivacySection() {
  return (
    <SettingsSection title="Privacy &amp; Security">

      <SettingsItem
        icon="🔒"
        label="Privacy Settings"
        to="/settings/privacy"
      />

      <SettingsItem
        icon="🚫"
        label="Blocked Users"
        to="/settings/blocked"
      />

      <SettingsItem
        icon="📋"
        label="Login Activity"
        to="/settings/login-activity"
      />

      <SettingsItem
        icon="💻"
        label="Active Sessions"
        to="/settings/sessions"
        last
      />

    </SettingsSection>
  );
}
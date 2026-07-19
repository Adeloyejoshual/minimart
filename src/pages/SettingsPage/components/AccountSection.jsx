import SettingsSection from "./SettingsSection.jsx";
import SettingsItem    from "./SettingsItem.jsx";

export default function AccountSection({ settings }) {
  const { user } = settings;

  return (
    <SettingsSection title="Account">

      <SettingsItem
        icon="👤"
        label="Edit Profile"
        sublabel={user?.name ?? "Update your name, bio and photo"}
        to="/profile/edit"
      />

      <SettingsItem
        icon="🔑"
        label="Change Password"
        to="/settings/change-password"
      />

      <SettingsItem
        icon="✉️"
        label="Email Address"
        sublabel={user?.email ?? "Not set"}
        to="/settings/email"
      />

      <SettingsItem
        icon="📱"
        label="Phone Number"
        sublabel={user?.phone ?? "Not set"}
        to="/settings/phone"
      />

      <SettingsItem
        icon="🛡️"
        label="Two-Factor Authentication"
        badge="Coming Soon"
        disabled
        last
      />

    </SettingsSection>
  );
}
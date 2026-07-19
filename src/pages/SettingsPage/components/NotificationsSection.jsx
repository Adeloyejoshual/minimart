import SettingsSection from "./SettingsSection.jsx";
import SettingsItem    from "./SettingsItem.jsx";
import Toggle          from "./Toggle.jsx";

export default function NotificationsSection({ settings }) {
  const { notifPrefs, toggleNotif } = settings;

  return (
    <SettingsSection title="Notifications">

      <SettingsItem
        icon="🔔"
        label="Push Notifications"
        sublabel="Alerts for messages and activity"
        control={
          <Toggle
            id="notif-push"
            label="Toggle push notifications"
            checked={notifPrefs.push}
            onChange={() => toggleNotif("push")}
          />
        }
      />

      <SettingsItem
        icon="📧"
        label="Email Notifications"
        sublabel="Updates sent to your inbox"
        last
        control={
          <Toggle
            id="notif-email"
            label="Toggle email notifications"
            checked={notifPrefs.email}
            onChange={() => toggleNotif("email")}
          />
        }
      />

    </SettingsSection>
  );
}
/**
 * src/pages/SettingsPage/SettingsPage.jsx
 * Container — composes section components, owns no business logic.
 */

import { useOutletContext } from "react-router-dom";
import { useSettings }      from "./hooks/useSettings.js";

import SettingsHeader        from "./components/SettingsHeader.jsx";
import AccountSection        from "./components/AccountSection.jsx";
import PreferencesSection    from "./components/PreferencesSection.jsx";
import NotificationsSection  from "./components/NotificationsSection.jsx";
import PrivacySection        from "./components/PrivacySection.jsx";
import SupportSection        from "./components/SupportSection.jsx";
import AboutSection          from "./components/AboutSection.jsx";
import DangerZone            from "./components/DangerZone.jsx";
import Toast                 from "./components/Toast.jsx";

import "./SettingsPage.css";

export default function SettingsPage() {
  /* Pull user + logout from your existing app context / outlet */
  let user     = null;
  let onLogout = null;
  try {
    const ctx = useOutletContext();
    user      = ctx?.user     ?? null;
    onLogout  = ctx?.onLogout ?? null;
  } catch { /* not inside an outlet — fine */ }

  const settings = useSettings({ user, onLogout });

  return (
    <div className="settings-page">
      <SettingsHeader />

      <main className="settings-main">
        <AccountSection       settings={settings} />
        <PreferencesSection   settings={settings} />
        <NotificationsSection settings={settings} />
        <PrivacySection       settings={settings} />
        <SupportSection       settings={settings} />
        <AboutSection         settings={settings} />
        <DangerZone           settings={settings} />
      </main>

      {settings.toast && (
        <Toast
          type={settings.toast.type}
          message={settings.toast.msg}
        />
      )}
    </div>
  );
}
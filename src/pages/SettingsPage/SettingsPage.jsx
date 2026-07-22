// ════════════════════════════════════════════════════════════
// FILE: src/pages/SettingsPage/SettingsPage.jsx
// Container — composes section components, owns no business logic.
// ════════════════════════════════════════════════════════════

import { useSettings } from "./hooks/useSettings.js";

import SettingsHeader       from "./components/SettingsHeader.jsx";
import AccountSection       from "./components/AccountSection.jsx";
import PreferencesSection   from "./components/PreferencesSection.jsx";
import NotificationsSection from "./components/NotificationsSection.jsx";
import PrivacySection       from "./components/PrivacySection.jsx";
import SupportSection       from "./components/SupportSection.jsx";
import AboutSection         from "./components/AboutSection.jsx";
import DangerZone           from "./components/DangerZone.jsx";
import Toast                from "./components/Toast.jsx";

import "./SettingsPage.css";

/*
  Props
  ─────
  user      — the authenticated user object from App.jsx state
  onLogout  — handleLogout(navigateFn) from App.jsx

  Both are passed directly from the route in App.jsx:
    <SettingsPage user={user} onLogout={handleLogout} />

  We do NOT use useOutletContext() because App.jsx renders
  SettingsPage as a direct route element, not inside an Outlet.
  Using useOutletContext() outside an Outlet silently returns
  null, which means onLogout would never arrive and DangerZone
  logout would break.
*/
export default function SettingsPage({ user, onLogout }) {
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

        {/*
          DangerZone receives settings which includes onLogout.
          DangerZone calls settings.onLogout(navigate) so that
          App.jsx handleLogout can navigate to /auth from inside
          the Router context.
        */}
        <DangerZone settings={settings} />
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
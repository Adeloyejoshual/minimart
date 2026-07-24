import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Card } from "../adminlayout/atoms";
import { TOGGLES } from "../adminlayout/nav";

export default function System({ system, toggleSystem, confirm }) {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  /* ── Get logged-in admin info ── */
  const admin = (() => {
    try { return JSON.parse(localStorage.getItem("admin") || "null"); }
    catch { return null; }
  })();

  /* ── Sign out this device ── */
  const handleLogout = () => {
    confirm({
      title:   "Sign Out?",
      body:    "You will need to log in again to access the admin panel.",
      confirm: "Sign Out",
      action:  () => {
        setLoggingOut(true);
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin");
        toast.success("Signed out successfully");
        setTimeout(() => {
          navigate("/admin/login", { replace: true });
        }, 300);
      },
    });
  };

  /* ── Sign out all devices ── */
  const handleLogoutAllDevices = () => {
    confirm({
      title:   "Sign Out From All Devices?",
      body:    "This will end every active admin session on all devices you are logged in on.",
      danger:  true,
      confirm: "Sign Out Everywhere",
      action:  async () => {
        setLoggingOut(true);
        const token = localStorage.getItem("admin_token");

        // Best-effort call to revoke all server-side sessions
        try {
          await fetch(
            `${import.meta.env.VITE_API_BASE_URL}/api/admin/logout-all`,
            {
              method    : "POST",
              headers   : { Authorization: `Bearer ${token}` },
              keepalive : true,
            }
          );
        } catch {}

        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin");
        toast.success("Signed out from all devices");
        setTimeout(() => {
          navigate("/admin/login", { replace: true });
        }, 300);
      },
    });
  };

  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>System Control</h1>
          <div className="ph-sub">Platform-wide toggles and configuration</div>
        </div>
      </div>

      {/* ── Platform Switches ── */}
      <Card title="Platform Switches">
        {TOGGLES.map(({ key, label, desc, danger }) => (
          <div key={key} className="toggle-row">
            <div className="toggle-info">
              <h4>{label}</h4>
              <p>{desc}</p>
            </div>
            <button
              className={`sw ${system[key] ? "on" : "off"}`}
              role="switch"
              aria-checked={system[key]}
              aria-label={label}
              onClick={() =>
                confirm({
                  title:   `${system[key] ? "Disable" : "Enable"} ${label}?`,
                  body:    "This will take effect immediately across the platform.",
                  danger,
                  confirm: system[key] ? "Turn Off" : "Turn On",
                  action:  () => toggleSystem(key, system),
                })
              }
            />
          </div>
        ))}
      </Card>

      {/* ── Account Session ── */}
      <Card title="Account Session">
        {admin && (
          <div style={{
            padding      : "12px 16px",
            background   : "#3b82f61a",
            border       : "1px solid #3b82f640",
            borderRadius : 8,
            marginBottom : 14,
            fontSize     : ".8rem",
            color        : "#93c5fd",
          }}>
            👤 Signed in as <b>{admin.name}</b> ({admin.email}) —
            Role: <b>{admin.role}</b>
          </div>
        )}

        <div className="toggle-row">
          <div className="toggle-info">
            <h4>Sign Out</h4>
            <p>End your current admin session on this device only.</p>
          </div>
          <button
            className="btn b-solid"
            disabled={loggingOut}
            onClick={handleLogout}
            style={{ minWidth: 120 }}
          >
            {loggingOut ? "…" : "Sign Out"}
          </button>
        </div>

        <div className="toggle-row">
          <div className="toggle-info">
            <h4>Sign Out From All Devices</h4>
            <p>End every active admin session across all devices you are signed in on.</p>
          </div>
          <button
            className="btn b-red"
            disabled={loggingOut}
            onClick={handleLogoutAllDevices}
            style={{ minWidth: 120 }}
          >
            {loggingOut ? "…" : "Sign Out All"}
          </button>
        </div>
      </Card>

      {/* ── Danger Zone ── */}
      <Card title="Danger Zone">
        <div className="danger-zone">
          <h4>Hard Reset (coming soon)</h4>
          <p>Clear all sessions, revoke tokens, and force re-login for every user and admin.</p>
          <button className="btn b-red" disabled>Force Re-Login All</button>
        </div>
        <div className="danger-zone" style={{ margin: "0 18px 18px" }}>
          <h4>Flush Cache (coming soon)</h4>
          <p>Clear Redis trending, search, and session caches.</p>
          <button className="btn b-amber" disabled>Flush Redis Cache</button>
        </div>
      </Card>
    </>
  );
}
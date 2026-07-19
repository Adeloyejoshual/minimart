/**
 * src/pages/SettingsPage/components/PrivacySection.jsx
 *
 * Privacy & Security section with inline panels for:
 *   - Privacy Settings   → inline toggles (no separate page needed)
 *   - Blocked Users      → inline list with unblock action
 *   - Login Activity     → inline timeline
 *   - Active Sessions    → inline list with revoke action
 *
 * All icons are transparent SVGs using design tokens.
 * Own scoped stylesheet imported below.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import SettingsSection from "./SettingsSection.jsx";
import SettingsItem    from "./SettingsItem.jsx";
import "../styles/PrivacySection.css";

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS
═══════════════════════════════════════════════════════════════ */
const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const BlockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

const ActivityIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const MonitorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8"  y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6"  x2="6"  y2="18" />
    <line x1="6"  y1="6"  x2="18" y2="18" />
  </svg>
);

const MobileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

const DesktopIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8"  y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const TabletIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8
             a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0
             1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72
             -1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const LogInIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <polyline points="10 17 15 12 10 7" />
    <line x1="15" y1="12" x2="3" y2="12" />
  </svg>
);

const LogOutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const KeyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778
             7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5
             7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token");

const apiFetch = async (path, options = {}) => {
  const token = getToken();
  const res   = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type" : "application/json",
      Authorization  : `Bearer ${token}`,
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? `Request failed (${res.status})`);
  return data;
};

const timeAgo = (dateStr) => {
  if (!dateStr) return "Unknown";
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 2)  return "Just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  });
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const DeviceIcon = ({ type }) => {
  if (type === "mobile")  return <MobileIcon  />;
  if (type === "tablet")  return <TabletIcon  />;
  return <DesktopIcon />;
};

const actionLabel = (action) => {
  const map = {
    login                : "Signed in",
    login_failed         : "Failed sign-in attempt",
    logout               : "Signed out",
    password_changed     : "Password changed",
    email_changed        : "Email changed",
    phone_changed        : "Phone number changed",
    session_revoked      : "Session revoked",
    all_sessions_revoked : "All other sessions revoked",
  };
  return map[action] ?? action.replace(/_/g, " ");
};

const actionIcon = (action) => {
  if (action === "login")               return <LogInIcon  />;
  if (action === "logout")              return <LogOutIcon />;
  if (action === "login_failed")        return <BlockIcon  />;
  if (action.includes("password"))      return <KeyIcon    />;
  if (action.includes("session"))       return <MonitorIcon />;
  return <ShieldCheckIcon />;
};

/* ═══════════════════════════════════════════════════════════════
   DRAWER — reusable slide-up panel
═══════════════════════════════════════════════════════════════ */
function Drawer({ title, onClose, children, loading }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    /* Prevent body scroll while open */
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleOverlay = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      className="privacy-drawer-overlay"
      ref={overlayRef}
      onClick={handleOverlay}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="privacy-drawer">
        <div className="privacy-drawer__header">
          <h3 className="privacy-drawer__title">{title}</h3>
          <button
            type="button"
            className="privacy-drawer__close"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="privacy-drawer__body">
          {loading ? (
            <div className="privacy-loading" role="status">
              <span className="privacy-spinner" />
              <span>Loading…</span>
            </div>
          ) : children}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PRIVACY SETTINGS PANEL
═══════════════════════════════════════════════════════════════ */
function PrivacySettingsDrawer({ onClose }) {
  const [prefs, setPrefs] = useState({
    show_online_status   : true,
    show_last_seen       : true,
    show_profile_to      : "everyone",  // "everyone" | "followers" | "none"
    show_phone           : false,
    allow_messages_from  : "everyone",  // "everyone" | "followers" | "none"
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const toggle = (key) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      /* Your preferences endpoint — fire and forget for now */
      await apiFetch("/settings/preferences", {
        method : "PATCH",
        body   : JSON.stringify({ privacy: prefs }),
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1_200);
    } catch {
      /* non-critical */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer title="Privacy Settings" onClose={onClose}>

      {/* Online status */}
      <PrivacyToggleRow
        icon={<MonitorIcon />}
        label="Show online status"
        sublabel="Let others see when you're active"
        checked={prefs.show_online_status}
        onChange={() => toggle("show_online_status")}
      />

      {/* Last seen */}
      <PrivacyToggleRow
        icon={<ActivityIcon />}
        label="Show last seen"
        sublabel="Let others see when you were last active"
        checked={prefs.show_last_seen}
        onChange={() => toggle("show_last_seen")}
      />

      {/* Phone visibility */}
      <PrivacyToggleRow
        icon={<MobileIcon />}
        label="Show phone number"
        sublabel="Display your number on your profile"
        checked={prefs.show_phone}
        onChange={() => toggle("show_phone")}
      />

      {/* Profile visibility */}
      <div className="privacy-select-row">
        <div className="privacy-select-row__left">
          <span className="privacy-select-row__icon">
            <UserIcon />
          </span>
          <div>
            <p className="privacy-select-row__label">Profile visible to</p>
            <p className="privacy-select-row__sub">Who can view your profile</p>
          </div>
        </div>
        <select
          className="privacy-select"
          value={prefs.show_profile_to}
          onChange={(e) =>
            setPrefs((p) => ({ ...p, show_profile_to: e.target.value }))
          }
        >
          <option value="everyone">Everyone</option>
          <option value="followers">Followers</option>
          <option value="none">Only me</option>
        </select>
      </div>

      {/* Messages from */}
      <div className="privacy-select-row privacy-select-row--last">
        <div className="privacy-select-row__left">
          <span className="privacy-select-row__icon">
            <EyeIcon />
          </span>
          <div>
            <p className="privacy-select-row__label">Receive messages from</p>
            <p className="privacy-select-row__sub">Control who can message you</p>
          </div>
        </div>
        <select
          className="privacy-select"
          value={prefs.allow_messages_from}
          onChange={(e) =>
            setPrefs((p) => ({ ...p, allow_messages_from: e.target.value }))
          }
        >
          <option value="everyone">Everyone</option>
          <option value="followers">Followers</option>
          <option value="none">No one</option>
        </select>
      </div>

      {/* Save */}
      <div className="privacy-drawer__footer">
        <button
          type="button"
          className="privacy-btn privacy-btn--cancel"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="privacy-btn privacy-btn--save"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <><span className="privacy-spinner privacy-spinner--sm" />Saving…</>
          ) : saved ? "✓ Saved" : "Save"}
        </button>
      </div>

    </Drawer>
  );
}

function PrivacyToggleRow({ icon, label, sublabel, checked, onChange }) {
  return (
    <div className="privacy-toggle-row">
      <div className="privacy-toggle-row__left">
        <span className="privacy-toggle-row__icon">{icon}</span>
        <div>
          <p className="privacy-toggle-row__label">{label}</p>
          {sublabel && (
            <p className="privacy-toggle-row__sub">{sublabel}</p>
          )}
        </div>
      </div>
      <label className={`privacy-toggle ${checked ? "privacy-toggle--on" : ""}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only"
        />
        <span className="privacy-toggle__track">
          <span className="privacy-toggle__thumb" />
        </span>
      </label>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BLOCKED USERS PANEL
═══════════════════════════════════════════════════════════════ */
function BlockedUsersDrawer({ onClose }) {
  const [blocked,    setBlocked]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [unblocking, setUnblocking] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/settings/blocked-users");
      setBlocked(data.blocked_users ?? []);
    } catch {
      setBlocked([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUnblock = async (blockId, name) => {
    if (!window.confirm(`Unblock ${name}?`)) return;
    setUnblocking(blockId);
    try {
      await apiFetch(`/settings/blocked-users/${blockId}`, { method: "DELETE" });
      setBlocked((prev) => prev.filter((b) => b.block_id !== blockId));
    } catch { /* non-critical */ }
    finally { setUnblocking(null); }
  };

  return (
    <Drawer title="Blocked Users" onClose={onClose} loading={loading}>
      {!loading && blocked.length === 0 && (
        <div className="privacy-empty">
          <BlockIcon />
          <p>No blocked users</p>
        </div>
      )}

      {blocked.map((b) => (
        <div key={b.block_id} className="blocked-user-row">
          <div className="blocked-user-row__avatar">
            {b.profile_image
              ? <img src={b.profile_image} alt={b.name} />
              : <span>{(b.name ?? "?")[0].toUpperCase()}</span>
            }
          </div>

          <div className="blocked-user-row__info">
            <p className="blocked-user-row__name">{b.name ?? "Unknown user"}</p>
            {b.username && (
              <p className="blocked-user-row__username">@{b.username}</p>
            )}
            <p className="blocked-user-row__date">
              Blocked {timeAgo(b.blocked_at)}
            </p>
          </div>

          <button
            type="button"
            className="blocked-user-row__btn"
            onClick={() => handleUnblock(b.block_id, b.name)}
            disabled={unblocking === b.block_id}
          >
            {unblocking === b.block_id
              ? <span className="privacy-spinner privacy-spinner--sm" />
              : "Unblock"
            }
          </button>
        </div>
      ))}
    </Drawer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LOGIN ACTIVITY PANEL
═══════════════════════════════════════════════════════════════ */
function LoginActivityDrawer({ onClose }) {
  const [activity, setActivity] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch("/settings/login-activity");
        setActivity(data.login_activity ?? []);
      } catch {
        setActivity([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Drawer title="Login Activity" onClose={onClose} loading={loading}>
      {!loading && activity.length === 0 && (
        <div className="privacy-empty">
          <ActivityIcon />
          <p>No recent activity</p>
        </div>
      )}

      <div className="activity-timeline">
        {activity.map((item, i) => {
          const isLast    = i === activity.length - 1;
          const isFailed  = item.action === "login_failed";

          return (
            <div
              key={item.id}
              className={[
                "activity-row",
                isFailed ? "activity-row--warn" : "",
                isLast   ? "activity-row--last"  : "",
              ].filter(Boolean).join(" ")}
            >
              <div className={`activity-row__dot ${isFailed ? "activity-row__dot--warn" : ""}`}>
                <span>{actionIcon(item.action)}</span>
              </div>

              <div className="activity-row__content">
                <p className="activity-row__action">
                  {actionLabel(item.action)}
                </p>
                <p className="activity-row__meta">
                  {item.ip_address}
                  {item.device ? ` · ${item.device}` : ""}
                </p>
                <p className="activity-row__time">
                  {formatDate(item.created_at)}
                </p>
              </div>

              <span className="activity-row__ago">
                {timeAgo(item.created_at)}
              </span>
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ACTIVE SESSIONS PANEL
═══════════════════════════════════════════════════════════════ */
function ActiveSessionsDrawer({ onClose }) {
  const [sessions,  setSessions]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [revoking,  setRevoking]  = useState(null);
  const [revokeAll, setRevokeAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/settings/sessions");
      setSessions(data.sessions ?? []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRevoke = async (id) => {
    setRevoking(id);
    try {
      await apiFetch(`/settings/sessions/${id}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch { /* non-critical */ }
    finally { setRevoking(null); }
  };

  const handleRevokeAll = async () => {
    if (!window.confirm("Log out of all other devices?")) return;
    setRevokeAll(true);
    try {
      await apiFetch("/settings/sessions", { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.is_current));
    } catch { /* non-critical */ }
    finally { setRevokeAll(false); }
  };

  const others = sessions.filter((s) => !s.is_current);

  return (
    <Drawer title="Active Sessions" onClose={onClose} loading={loading}>
      {!loading && sessions.length === 0 && (
        <div className="privacy-empty">
          <MonitorIcon />
          <p>No active sessions</p>
        </div>
      )}

      {sessions.map((s) => (
        <div
          key={s.id}
          className={`session-row ${s.is_current ? "session-row--current" : ""}`}
        >
          <span className={`session-row__icon ${s.is_current ? "session-row__icon--current" : ""}`}>
            <DeviceIcon type={s.device_type} />
          </span>

          <div className="session-row__info">
            <div className="session-row__name-row">
              <p className="session-row__name">{s.device_name ?? "Unknown device"}</p>
              {s.is_current && (
                <span className="session-row__badge">This device</span>
              )}
            </div>
            <p className="session-row__meta">
              {s.ip_address ?? "Unknown IP"}
            </p>
            <p className="session-row__time">
              {s.is_current
                ? "Active now"
                : `Last active ${timeAgo(s.last_active)}`
              }
            </p>
          </div>

          {!s.is_current && (
            <button
              type="button"
              className="session-row__btn"
              onClick={() => handleRevoke(s.id)}
              disabled={revoking === s.id}
            >
              {revoking === s.id
                ? <span className="privacy-spinner privacy-spinner--sm" />
                : "Revoke"
              }
            </button>
          )}
        </div>
      ))}

      {/* Revoke all other sessions */}
      {others.length > 1 && (
        <div className="privacy-drawer__footer privacy-drawer__footer--border">
          <button
            type="button"
            className="privacy-btn privacy-btn--danger privacy-btn--full"
            onClick={handleRevokeAll}
            disabled={revokeAll}
          >
            {revokeAll
              ? <><span className="privacy-spinner privacy-spinner--sm" />Logging out…</>
              : `Log out of ${others.length} other device${others.length !== 1 ? "s" : ""}`
            }
          </button>
        </div>
      )}
    </Drawer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PRIVACY SECTION
═══════════════════════════════════════════════════════════════ */
export default function PrivacySection() {
  const [panel, setPanel] = useState(null);
  // panel: null | "privacy" | "blocked" | "activity" | "sessions"

  const close = useCallback(() => setPanel(null), []);

  return (
    <>
      <SettingsSection title="Privacy & Security">

        <SettingsItem
          icon={<LockIcon />}
          label="Privacy Settings"
          sublabel="Control who sees your profile and activity"
          onClick={() => setPanel("privacy")}
        />

        <SettingsItem
          icon={<BlockIcon />}
          label="Blocked Users"
          sublabel="Manage accounts you have blocked"
          onClick={() => setPanel("blocked")}
        />

        <SettingsItem
          icon={<ActivityIcon />}
          label="Login Activity"
          sublabel="Recent sign-ins and security events"
          onClick={() => setPanel("activity")}
        />

        <SettingsItem
          icon={<MonitorIcon />}
          label="Active Sessions"
          sublabel="Devices currently signed in to your account"
          onClick={() => setPanel("sessions")}
          last
        />

      </SettingsSection>

      {/* ── Panels ── */}
      {panel === "privacy"  && <PrivacySettingsDrawer onClose={close} />}
      {panel === "blocked"  && <BlockedUsersDrawer    onClose={close} />}
      {panel === "activity" && <LoginActivityDrawer   onClose={close} />}
      {panel === "sessions" && <ActiveSessionsDrawer  onClose={close} />}
    </>
  );
}
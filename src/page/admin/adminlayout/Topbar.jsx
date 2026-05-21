import { NAV } from "./nav";

const initials = (s = "") => {
  const words = s.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "SA";
  return words.map((w) => w[0]).join("").toUpperCase().slice(0, 2);
};

export default function Topbar({ page, adminName, notifCount }) {
  const label = NAV.find((n) => n.id === page)?.label || page;
  return (
    <div className="topbar">
      <span className="topbar-title">{label}</span>
      <div className="topbar-right">
        <div className="live-chip">
          <span className="live-dot" />
          Live
        </div>
        <div className="notif-btn">
          &#9993;
          {notifCount > 0 && <span className="notif-dot" />}
        </div>
        <div className="avatar">{initials(adminName)}</div>
      </div>
    </div>
  );
}
// src/components/latest/LatestDateGroup.jsx
import { memo } from "react";

const GROUP_CONFIG = {
  "Just Added" : { icon: "⚡", cls: "lt-dg--new"   },
  "Today"      : { icon: "📅", cls: "lt-dg--today" },
  "Yesterday"  : { icon: "🕐", cls: "lt-dg--yest"  },
  "This Week"  : { icon: "📆", cls: "lt-dg--week"  },
  "This Month" : { icon: "🗓", cls: "lt-dg--month" },
  "Older"      : { icon: "📁", cls: "lt-dg--old"   },
};

const LatestDateGroup = memo(function LatestDateGroup({
  label,
  count,
}) {
  const cfg = GROUP_CONFIG[label] ?? { icon: "📁", cls: "" };

  return (
    <div className={`lt-dg ${cfg.cls}`} role="separator">
      <span className="lt-dg-icon" aria-hidden="true">
        {cfg.icon}
      </span>
      <span className="lt-dg-label">{label}</span>
      <span className="lt-dg-count">
        {count} item{count !== 1 ? "s" : ""}
      </span>
      <div className="lt-dg-line" aria-hidden="true" />
    </div>
  );
});

export default LatestDateGroup;
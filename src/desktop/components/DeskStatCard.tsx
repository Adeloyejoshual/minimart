// src/desktop/components/DeskStatCard.tsx

import { memo } from "react";
import "../../pages/Profile/components/icons";

interface DeskStatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}

const DeskStatCard = memo(function DeskStatCard({
  icon,
  label,
  value,
  sub,
  color,
}: DeskStatCardProps) {
  return (
    <div className="dkd-stat" style={{ "--accent": color } as React.CSSProperties}>
      <div className="dkd-stat-icon">{icon}</div>
      <div className="dkd-stat-info">
        <p className="dkd-stat-value">{value}</p>
        <p className="dkd-stat-label">{label}</p>
        {sub && <p className="dkd-stat-sub">{sub}</p>}
      </div>
    </div>
  );
});

export default DeskStatCard;
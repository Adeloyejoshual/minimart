// src/pages/Profile/components/StatCard.jsx
import { memo } from "react";
import { Ic } from "./icons";
import "./StatCard.css";

const StatCard = memo(({ icon, label, value, sub, color, trend }) => (
  <div className="stat-card">
    <div className="stat-card__header">
      <div className="stat-card__icon" style={{ "--accent": color }}>
        {icon}
      </div>
      {trend && (
        <span
          className={`stat-card__trend ${
            trend > 0
              ? "stat-card__trend--up"
              : "stat-card__trend--down"
          }`}
        >
          <Ic.TrendUp />
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    <p className="stat-card__value">{value}</p>
    <p className="stat-card__label">{label}</p>
    {sub && <p className="stat-card__sub">{sub}</p>}
  </div>
));

export default StatCard;
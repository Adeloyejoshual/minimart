// src/pages/Profile/components/ScoreSection.jsx
import { memo } from "react";
import "./ScoreSection.css";

const ScoreRing = memo(({ score = 0, size = 120 }) => {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const cfg =
    score >= 80
      ? { color: "#10b981", label: "Excellent" }
      : score >= 60
      ? { color: "#f59e0b", label: "Good" }
      : score >= 40
      ? { color: "#f97316", label: "Fair" }
      : { color: "#ef4444", label: "Needs Work" };

  return (
    <div className="score-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={cfg.color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (score / 100) * c}
          className="score-ring__arc"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x={size / 2}
          y={size / 2 - 4}
          textAnchor="middle"
          fontSize="28"
          fontWeight="800"
          fill={cfg.color}
        >
          {score}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 16}
          textAnchor="middle"
          fontSize="11"
          fill="#94a3b8"
          fontWeight="500"
        >
          / 100
        </text>
      </svg>
      <span className="score-ring__badge" style={{ color: cfg.color }}>
        {cfg.label}
      </span>
    </div>
  );
});

const MetricBar = memo(({ label, val, color }) => (
  <div className="score-metric">
    <div className="score-metric__header">
      <span className="score-metric__label">{label}</span>
      <span className="score-metric__value">{Math.round(val)}%</span>
    </div>
    <div className="score-metric__bar">
      <div
        className="score-metric__fill"
        style={{ width: `${Math.round(val)}%`, background: color }}
      />
    </div>
  </div>
));

export default function ScoreSection({ score, metrics, title, subtitle }) {
  return (
    <div className="score-section-card">
      {(title || subtitle) && (
        <div className="score-section-card__header">
          {title && <h2 className="score-section-card__title">{title}</h2>}
          {subtitle && (
            <p className="score-section-card__subtitle">{subtitle}</p>
          )}
        </div>
      )}
      <div className="score-section">
        <ScoreRing score={score} />
        <div className="score-section__metrics">
          {metrics.map((m) => (
            <MetricBar key={m.label} {...m} />
          ))}
        </div>
      </div>
    </div>
  );
}
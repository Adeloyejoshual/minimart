// src/desktop/components/DeskScoreSection.tsx

import { memo, useMemo } from "react";

interface Metric {
  label: string;
  val: number;
  color: string;
}

interface DeskScoreSectionProps {
  score: number;
  metrics: Metric[];
  title?: string;
  subtitle?: string;
  size?: number;
}

function ScoreRing({ score = 0, size = 140 }: { score?: number; size?: number }) {
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
    <div className="dkd-score-ring">
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
          className="dkd-score-arc"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x={size / 2}
          y={size / 2 - 4}
          textAnchor="middle"
          fontSize="32"
          fontWeight="800"
          fill={cfg.color}
        >
          {score}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 18}
          textAnchor="middle"
          fontSize="12"
          fill="#94a3b8"
          fontWeight="500"
        >
          / 100
        </text>
      </svg>
      <span className="dkd-score-label" style={{ color: cfg.color }}>
        {cfg.label}
      </span>
    </div>
  );
}

const DeskScoreSection = memo(function DeskScoreSection({
  score,
  metrics,
  title,
  subtitle,
  size,
}: DeskScoreSectionProps) {
  return (
    <div className="dkd-card">
      {(title || subtitle) && (
        <div className="dkd-card-header">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p className="dkd-card-subtitle">{subtitle}</p>}
          </div>
        </div>
      )}
      <div className="dkd-score-section">
        <ScoreRing score={score} size={size} />
        <div className="dkd-score-metrics">
          {metrics.map((m) => (
            <div key={m.label} className="dkd-metric">
              <div className="dkd-metric-header">
                <span>{m.label}</span>
                <span className="dkd-metric-val">{Math.round(m.val)}%</span>
              </div>
              <div className="dkd-metric-bar">
                <div
                  className="dkd-metric-fill"
                  style={{ width: `${Math.round(m.val)}%`, background: m.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default DeskScoreSection;
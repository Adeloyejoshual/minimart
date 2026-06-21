import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";

const TIERS = [
  { min: 80, color: "#22c55e", label: "Excellent", bg: "rgba(34,197,94,0.08)"  },
  { min: 60, color: "#3b82f6", label: "Good",      bg: "rgba(59,130,246,0.08)" },
  { min: 40, color: "#f59e0b", label: "Fair",      bg: "rgba(245,158,11,0.08)" },
  { min:  0, color: "#ef4444", label: "Low",       bg: "rgba(239,68,68,0.08)"  },
];

function ScoreRow({ label, points, done }) {
  return (
    <div className="score-row">
      <div className={`score-row-dot ${done ? "score-row-dot--done" : ""}`}>
        {done && <CheckCircle size={12} />}
      </div>
      <span className={`score-row-label ${done ? "score-row-label--done" : ""}`}>
        {label}
      </span>
      <span className={`score-row-pts ${done ? "score-row-pts--done" : ""}`}>
        +{points}
      </span>
    </div>
  );
}

export function TrustRing({ score = 0, breakdown = {} }) {
  const R   = 52;
  const C   = 2 * Math.PI * R;
  const cfg = TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];

  const {
    emailVerified    = false,
    identityVerified = false,
    storeVerified    = false,
    trustScore       = 0,
  } = breakdown;

  return (
    <div className="trust-ring-wrap">
      {/* ── ring ── */}
      <div className="trust-ring-graphic" style={{ "--ring-bg": cfg.bg }}>
        <svg
          width="140"
          height="140"
          viewBox="0 0 140 140"
          aria-label={`Trust score ${score} out of 100`}
          role="img"
        >
          {/* track */}
          <circle
            cx="70" cy="70" r={R}
            fill="none"
            stroke="#1f2937"
            strokeWidth="10"
          />
          {/* fill */}
          <motion.circle
            cx="70" cy="70" r={R}
            fill="none"
            stroke={cfg.color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C}
            animate={{ strokeDashoffset: C - (score / 100) * C }}
            transition={{ duration: 1.6, ease: [0.34, 1.56, 0.64, 1], delay: 0.1 }}
            style={{
              transformOrigin : "center",
              transform       : "rotate(-90deg)",
              filter          : `drop-shadow(0 0 6px ${cfg.color}66)`,
            }}
          />
        </svg>

        {/* centre label */}
        <div className="trust-ring-center">
          <motion.span
            key={score}
            className="trust-ring-number"
            style={{ color: cfg.color }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            {score}
          </motion.span>
          <span className="trust-ring-denom">/ 100</span>
          <span className="trust-ring-tier" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* ── breakdown ── */}
      <div className="score-breakdown">
        <p className="score-breakdown-title">Trust Breakdown</p>
        <ScoreRow label="Email verified"    points={30} done={emailVerified}         />
        <ScoreRow label="Identity verified" points={30} done={identityVerified}      />
        <ScoreRow label="Store verified"    points={20} done={storeVerified}         />
        <ScoreRow label="Account age 30d"   points={10} done={trustScore >= 60}     />
        <ScoreRow label="Account age 90d"   points={10} done={trustScore >= 70}     />
      </div>
    </div>
  );
}
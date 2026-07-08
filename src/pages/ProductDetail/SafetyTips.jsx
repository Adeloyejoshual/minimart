// SafetyTips.jsx — add memo + semantic list label
import { memo } from "react";

const SAFETY_TIPS = [
  "Never pay in advance — pay only on delivery.",
  "Meet sellers in safe, public locations.",
  "Inspect items carefully before buying.",
  "Confirm you received the exact item shown.",
  "Report suspicious listings immediately.",
];

export default memo(function SafetyTips() {
  return (
    <div className="pd-section pd-safety-section">
      <h3 className="pd-section-h pd-safety-h">🛡️ Safety Tips</h3>
      <ul className="pd-safety-list" aria-label="Marketplace safety tips">
        {SAFETY_TIPS.map((tip) => (        // ✅ tip text is stable — use as key
          <li key={tip} className="pd-safety-item">
            <span className="pd-safety-dot" aria-hidden="true">•</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});
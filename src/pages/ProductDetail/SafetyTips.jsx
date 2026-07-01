/**
 * src/pages/ProductDetail/SafetyTips.jsx
 */

const SAFETY_TIPS = [
  "Never pay in advance — pay only on delivery.",
  "Meet sellers in safe, public locations.",
  "Inspect items carefully before buying.",
  "Confirm you received the exact item shown.",
  "Report suspicious listings immediately.",
];

export default function SafetyTips() {
  return (
    <div className="pd-section pd-safety-section">
      <h3 className="pd-section-h pd-safety-h">🛡️ Safety Tips</h3>
      <ul className="pd-safety-list">
        {SAFETY_TIPS.map((tip, i) => (
          <li key={i} className="pd-safety-item">
            <span className="pd-safety-dot">•</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
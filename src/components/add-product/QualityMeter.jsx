import { useMemo } from "react";

export default function QualityMeter({ score }) {
  const { color, label, tips } = useMemo(() => {
    if (score >= 80) return { color: "#059669", label: "Excellent", tips: [] };
    if (score >= 60) return {
      color: "#d97706", label: "Good",
      tips: ["Add more photos or specs to improve"],
    };
    if (score >= 40) return {
      color: "#ea580c", label: "Fair",
      tips: ["Add description, features, and specifications"],
    };
    return {
      color: "#dc2626", label: "Needs Work",
      tips: ["Add photos, description, brand, specs, and variants"],
    };
  }, [score]);

  return (
    <div className="ap-quality">
      <div className="ap-quality-row">
        <span>Listing Quality</span>
        <span style={{ color, fontWeight: 600 }}>
          {score}/100 · {label}
        </span>
      </div>
      <div className="ap-quality-bar">
        <div
          className="ap-quality-fill"
          style={{ width: `${score}%`, background: color, transition: "width .4s ease" }}
        />
      </div>
      {tips.map((t, i) => (
        <p key={i} className="ap-quality-tip">💡 {t}</p>
      ))}
    </div>
  );
}
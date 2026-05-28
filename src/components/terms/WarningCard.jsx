// src/components/terms/WarningCard.jsx

/**
 * Contextual notice block.
 *
 * variant: "warning" — orange (default, for fraud/scam alerts)
 *          "success" — green (for positive confirmation notices)
 *          "info"    — blue  (for neutral informational notices)
 */
export default function WarningCard({ children, variant = "warning" }) {
  const variantClass = {
    warning : "warning-card--warning",
    success : "warning-card--success",
    info    : "warning-card--info",
  }[variant] ?? "warning-card--warning";

  return (
    <div
      className={`warning-card ${variantClass}`}
      role="note"
    >
      {children}
    </div>
  );
}
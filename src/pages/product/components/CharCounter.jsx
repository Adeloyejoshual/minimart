/**
 * src/pages/product/components/CharCounter.jsx
 */
import "./styles/CharCounter.css";

export default function CharCounter({ value, max, min = 0 }) {
  const len      = String(value ?? "").length;
  const tooShort = min > 0 && len < min && len > 0;
  const nearMax  = len > max * 0.9;
  const atMax    = len >= max;

  return (
    <span
      className={[
        "char-counter",
        tooShort ? "char-counter--short" : "",
        nearMax  ? "char-counter--warn"  : "",
        atMax    ? "char-counter--max"   : "",
      ].filter(Boolean).join(" ")}
      aria-live="polite"
    >
      {tooShort
        ? `${min - len} more character${min - len !== 1 ? "s" : ""} needed`
        : `${len}/${max}`}
    </span>
  );
}
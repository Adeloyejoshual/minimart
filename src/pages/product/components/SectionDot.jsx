/**
 * src/pages/product/components/SectionDot.jsx
 */
import "./styles/SectionDot.css";

export default function SectionDot({ filled }) {
  return (
    <span
      className={`section-dot${filled ? " section-dot--filled" : ""}`}
      aria-hidden="true"
    />
  );
}
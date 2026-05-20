// AddProductHeader.jsx
import { useNavigate } from "react-router-dom";
import "./AddProductHeader.css";

export default function AddProductHeader({
  title       = "Add Product",
  rightAction = null,
  onClearDraft,
}) {
  const navigate = useNavigate();

  return (
    <header className="aph">
      {/* ── Left — back button ──────────────────────────── */}
      <button
        className="aph-back"
        onClick={() => navigate(-1)}
        aria-label="Go back"
        type="button"
      >
        {/* SVG arrow — no emoji, no character */}
        <svg
          viewBox="0 0 20 20"
          width="18"
          height="18"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M13 4L7 10L13 16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="aph-back-label">Back</span>
      </button>

      {/* ── Center — title ───────────────────────────────── */}
      <h2 className="aph-title">{title}</h2>

      {/* ── Right — optional action + clear draft ────────── */}
      <div className="aph-right">
        {rightAction}

        {onClearDraft && (
          <button
            className="aph-clear"
            onClick={onClearDraft}
            aria-label="Clear saved draft"
            type="button"
          >
            Clear draft
          </button>
        )}
      </div>
    </header>
  );
}
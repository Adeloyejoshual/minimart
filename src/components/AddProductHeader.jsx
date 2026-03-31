import { useNavigate } from "react-router-dom";
import "./AddProductHeader.css";

export default function AddProductHeader({
  title = "Add Product",
  rightAction = null,
  onClearDraft, // callback to clear auto‑save
}) {
  const navigate = useNavigate();

  return (
    <div className="add-product-header">
      {/* LEFT */}
      <button
        className="back-btn"
        onClick={() => navigate(-1)}
        aria-label="Go back"
      >
        ←
      </button>

      {/* CENTER */}
      <h2 className="header-title">{title}</h2>

      {/* RIGHT */}
      <div className="header-right">
        {rightAction}
        {onClearDraft && (
          <button
            className="clear-btn"
            onClick={onClearDraft}
            aria-label="Clear saved draft"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
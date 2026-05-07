import { useNavigate } from "react-router-dom";
import "./AddProductHeader.css";

export default function AddProductHeader({
  title = "Add Product",
  rightAction = null,
  onClearDraft,
}) {
  const navigate = useNavigate();

  return (
    <div className="add-product-header">
      {/* LEFT */}
      <button
        className="aph-back"
        onClick={() => navigate(-1)}
        aria-label="Go back"
      >
        ←
      </button>

      {/* CENTER */}
      <h2 className="aph-title">{title}</h2>

      {/* RIGHT */}
      <div className="aph-right">
        {rightAction}
        {onClearDraft && (
          <button
            className="aph-clear"
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

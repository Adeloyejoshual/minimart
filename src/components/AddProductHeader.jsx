import { useNavigate } from "react-router-dom";
import "./AddProductHeader.css";

export default function AddProductHeader({
  title = "Add Product",
  rightAction = null,
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

      {/* RIGHT (optional slot) */}
      <div className="header-right">
        {rightAction}
      </div>
    </div>
  );
}
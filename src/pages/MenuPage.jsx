import { useNavigate } from "react-router-dom";
import "../styles/MenuPage.css";

export default function MenuPage() {
  const navigate = useNavigate();

  return (
    <div className="menu-page">

      {/* HEADER */}
      <div className="menu-header">
        <h2>Menu</h2>
        <button onClick={() => navigate(-1)}>✕</button>
      </div>

      {/* OPTIONS */}
      <div className="menu-list">

        <div className="menu-item" onClick={() => navigate("/")}>
          🏠 Home
        </div>

        <div className="menu-item" onClick={() => navigate("/search")}>
          🔎 Search Products
        </div>

        <div className="menu-item" onClick={() => navigate("/categories")}>
          📂 Categories
        </div>

        <div className="menu-item" onClick={() => navigate("/cart")}>
          🛒 Cart
        </div>

        <div className="menu-item" onClick={() => navigate("/profile")}>
          👤 Profile
        </div>

        <div className="menu-item danger">
          🚪 Logout
        </div>

      </div>
    </div>
  );
}
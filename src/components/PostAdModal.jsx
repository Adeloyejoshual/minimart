// components/PostAdModal.jsx
import { useNavigate } from "react-router-dom";

export default function PostAdModal() {
  const navigate = useNavigate();

  const handlePostAd = () => {
    // Redirect directly to AddProduct.js
    navigate("/add-product");
  };

  return (
    <button
      onClick={handlePostAd}
      style={{
        background: "#0D6EFD",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: 6,
        fontWeight: 600,
        cursor: "pointer",
        border: "none",
        width: "100%",
        textAlign: "center",
      }}
    >
      ＋ Post Ad
    </button>
  );
}
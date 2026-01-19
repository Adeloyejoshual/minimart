// components/PostAdModal.jsx
import { useNavigate } from "react-router-dom";

export default function PostAdModal() {
  const navigate = useNavigate();

  const handlePostAd = () => {
    // Navigate to AddProduct.js and force marketplace
    navigate("/add-product?market=marketplace");
  };

  return (
    <button
      onClick={handlePostAd}
      style={{
        background: "#0D6EFD",
        color: "#fff",
        padding: "10px 20px",
        borderRadius: 5,
        fontWeight: 600,
        cursor: "pointer",
        border: "none",
      }}
    >
      ＋ Post Ad
    </button>
  );
}
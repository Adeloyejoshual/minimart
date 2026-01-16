import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useParams, useNavigate } from "react-router-dom";

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    const loadProduct = async () => {
      const docRef = doc(db, "products", productId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProduct({ id: docSnap.id, ...docSnap.data() });
      } else {
        alert("Product not found");
        navigate("/");
      }
    };
    loadProduct();
  }, [productId, navigate]);

  if (!product) return <p>Loading product...</p>;

  const handleChat = () => {
    if (currentUser.uid === product.ownerId) return;
    navigate(
      `/chat/${product.ownerId}?product=${productId}&sellerName=${encodeURIComponent(
        product.ownerName
      )}&productName=${encodeURIComponent(product.name)}`
    );
  };

  const handleCall = () => {
    if (!product.ownerPhone) return;
    navigator.clipboard.writeText(product.ownerPhone);
    window.location.href = `tel:${product.ownerPhone}`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={{ maxWidth: "600px", margin: "20px auto", padding: 10 }}>
      {/* Product image */}
      <img
        src={product.imageUrl}
        alt={product.name}
        style={{ width: "100%", borderRadius: 8, marginBottom: 12 }}
      />

      {/* Product info */}
      <h2 style={{ margin: 0 }}>{product.name}</h2>
      <p style={{ fontWeight: "bold", fontSize: 18, margin: "4px 0" }}>₦{product.price}</p>
      <p style={{ margin: "4px 0" }}>{product.description}</p>
      <p style={{ fontSize: 14, color: "#555" }}>
        Category: <b>{product.category}</b> | Market: <b>{product.marketType}</b>
      </p>
      <p style={{ fontSize: 12, color: "#888" }}>
        Posted on: {formatDate(product.postedAt)}
      </p>

      {/* Seller info */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        {product.ownerPhone && (
          <button
            onClick={handleCall}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              background: "#0D6EFD",
              color: "#fff",
              border: "none",
              borderRadius: 5,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            📞 {product.ownerPhone} (Copy & Call)
          </button>
        )}
        {currentUser.uid !== product.ownerId && (
          <button
            onClick={handleChat}
            style={{
              padding: "6px 12px",
              background: "#198754",
              color: "#fff",
              border: "none",
              borderRadius: 5,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            💬 Chat with {product.ownerName}
          </button>
        )}
      </div>

      {/* Warning */}
      <p style={{ fontSize: 12, color: "#dc3545", marginTop: 10 }}>
        ❗️ Never pay in advance! Always inspect the product.
      </p>
      <p style={{ fontSize: 12, color: "#28a745" }}>
        ✅ Inform the seller you got their number on Jiji so they know where you came from
      </p>
    </div>
  );
}
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useParams, useNavigate } from "react-router-dom";

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Load current user
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => setCurrentUser(user));
    return unsubscribe;
  }, []);

  // Load product from Firestore
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

  if (!product || !currentUser) return <p>Loading...</p>;

  // Navigate to ChatPage
  const startChat = () => {
    if (currentUser.uid === product.ownerId) return; // Owners cannot chat themselves
    navigate(
      `/chat/${product.ownerId}?product=${productId}&sellerName=${encodeURIComponent(
        product.ownerName
      )}&productName=${encodeURIComponent(product.name)}`
    );
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div style={{ maxWidth: 700, margin: "20px auto", padding: 20, fontFamily: "Arial, sans-serif" }}>
      
      {/* Product Image */}
      <div style={{ textAlign: "center" }}>
        <img
          src={product.imageUrl}
          alt={product.name}
          style={{ width: "100%", maxHeight: 400, objectFit: "cover", borderRadius: 10, marginBottom: 20 }}
        />
      </div>

      {/* Product Info */}
      <h1 style={{ margin: "0 0 10px 0" }}>{product.name}</h1>
      <p style={{ fontWeight: "bold", fontSize: 22, margin: "0 0 10px 0" }}>₦{product.price}</p>
      <p style={{ fontSize: 16, marginBottom: 15 }}>{product.description}</p>

      <div style={{ display: "flex", gap: 15, flexWrap: "wrap", marginBottom: 15 }}>
        <span style={{ fontSize: 14, color: "#555" }}><b>Category:</b> {product.category}</span>
        <span style={{ fontSize: 14, color: "#555" }}><b>Market:</b> {product.marketType}</span>
        <span style={{ fontSize: 14, color: "#555" }}><b>Posted:</b> {formatDate(product.postedAt)}</span>
      </div>

      {/* Start Chat Button */}
      {currentUser.uid !== product.ownerId && (
        <button
          onClick={startChat}
          style={{
            flex: 1,
            minWidth: 180,
            padding: "12px 18px",
            background: "#0D6EFD",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 16,
            fontWeight: "bold",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#0b5ed7")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#0D6EFD")}
        >
          💬 Start Chat with {product.ownerName}
        </button>
      )}

      {/* Optional Sold Badge */}
      {product.sold && (
        <div
          style={{
            marginTop: 20,
            padding: 10,
            background: "#dc3545",
            color: "#fff",
            borderRadius: 8,
            textAlign: "center",
            fontWeight: "bold",
          }}
        >
          SOLD
        </div>
      )}
    </div>
  );
}
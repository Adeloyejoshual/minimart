import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useParams, useNavigate } from "react-router-dom";

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    const loadProduct = async () => {
      const docRef = doc(db, "products", productId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProduct(docSnap.data());
      } else {
        alert("Product not found");
        navigate("/");
      }
    };
    loadProduct();
  }, [productId, navigate]);

  if (!product) return <p>Loading product...</p>;

  const handleChat = () => {
    const buyerId = auth.currentUser.uid;
    const sellerId = product.ownerId;

    // Navigate to chat page and show product + seller
    navigate(
      `/chat/${sellerId}?product=${productId}&sellerName=${encodeURIComponent(
        product.ownerName
      )}`,
      { replace: false } // keep the navigation in history
    );
  };

  return (
    <div style={{ maxWidth: "600px", margin: "20px auto" }}>
      <img
        src={product.imageUrl}
        alt={product.name}
        style={{ width: "100%", borderRadius: 8 }}
      />
      <h2>{product.name}</h2>
      <p style={{ fontWeight: "bold", fontSize: 18 }}>₦{product.price}</p>
      <p>{product.description}</p>
      <p>
        Category: <b>{product.category}</b> | Market: <b>{product.marketType}</b>
      </p>
      <button
        onClick={handleChat}
        style={{
          padding: "10px 20px",
          marginTop: 10,
          background: "#0D6EFD",
          color: "#fff",
          border: "none",
          borderRadius: 5,
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Start Chat
      </button>
    </div>
  );
}
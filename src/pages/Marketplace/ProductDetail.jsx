// src/pages/Marketplace/ProductDetail.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getMarketplaceProductById, deleteMarketplaceProduct } from "../../helpers/marketplace";
import { useAuth0 } from "@auth0/auth0-react";

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const { user, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const data = await getMarketplaceProductById(id);
      setProduct(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this product?")) return;
    const token = await getAccessTokenSilently();
    await deleteMarketplaceProduct(id, token);
    navigate("/marketplace");
  };

  if (!product) return <p>Loading product...</p>;

  return (
    <div style={{ padding: "16px" }}>
      <h2>{product.title}</h2>
      {product.images.length > 0 && (
        <img src={product.images[0]} alt={product.title} style={{ width: "100%", maxHeight: "400px", objectFit: "cover", borderRadius: "12px" }} />
      )}
      <p>Price: ₦{product.price}</p>
      <p>{product.description}</p>
      <p>Location: {product.city}, {product.state}, {product.country}</p>

      {user && user.sub === product.ownerId && (
        <button onClick={handleDelete} style={{ marginTop: "12px", background: "red", color: "#fff", padding: "10px", borderRadius: "8px", border: "none" }}>
          Delete Product
        </button>
      )}
    </div>
  );
}
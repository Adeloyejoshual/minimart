import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const res = await axios.get(
        `https://minimart-ivrm.onrender.com/api/marketplace/products/${id}`
      );
      setProduct(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  if (!product) return <p>Loading product...</p>;

  return (
    <div style={{ padding: "16px", maxWidth: "600px", margin: "0 auto" }}>
      <button onClick={() => navigate(-1)}>← Back</button>
      <h2>{product.title}</h2>
      {product.image && (
        <img
          src={product.image}
          alt={product.title}
          style={{ width: "100%", maxHeight: "400px", objectFit: "cover" }}
        />
      )}
      <p>Price: ₦{product.price}</p>
      {product.description && <p>{product.description}</p>}
      <p>Stock: {product.stock}</p>
    </div>
  );
}
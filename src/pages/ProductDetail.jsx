import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

const API = "https://minimart-ivrm.onrender.com/api/marketplace";

export default function ProductDetail() {

  const { id } = useParams();

  const [product, setProduct] = useState(null);

  useEffect(() => {
    fetchProduct();
  }, []);

  const fetchProduct = async () => {
    try {
      const res = await axios.get(`${API}/products/${id}`);
      setProduct(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  if (!product) return <p>Loading product...</p>;

  return (
    <div style={{ maxWidth: 900, margin: "auto", padding: 20 }}>

      <div style={{ display: "flex", gap: 30 }}>

        <div style={{ flex: 1 }}>
          {product.image && (
            <img
              src={product.image}
              alt={product.title}
              style={{
                width: "100%",
                borderRadius: 10
              }}
            />
          )}
        </div>

        <div style={{ flex: 1 }}>

          <h1>{product.title}</h1>

          <h2>₦{product.price}</h2>

          <p>{product.description}</p>

          <p><strong>Brand:</strong> {product.brand}</p>
          <p><strong>Model:</strong> {product.model}</p>
          <p><strong>Color:</strong> {product.color}</p>
          <p><strong>Warranty:</strong> {product.warranty}</p>

          <p><strong>Stock:</strong> {product.stock}</p>

          <p><strong>Seller:</strong> {product.seller_name}</p>

          <button
            style={{
              padding: 12,
              background: "black",
              color: "white",
              border: "none",
              marginTop: 20
            }}
          >
            Contact Seller
          </button>

        </div>

      </div>

    </div>
  );
}
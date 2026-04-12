// ProductDetail.jsx
import React, { useState, useEffect } from "react";

const ProductDetail = ({ id: propId, slug: propSlug }) => {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        setError(null);

        // 👇 force a test ID for debugging
        const id = propId || "8bf8294e-d117-4cbb-bd97-0ebc3e79a500";
        const slug = propSlug;

        const base = process.env.REACT_APP_API_URL || "";
        const endpoint = id
          ? `${base}/api/product/${id}`
          : `${base}/api/product/${encodeURIComponent(slug)}`;

        console.log("Fetching:", endpoint);
        const res = await fetch(endpoint);
        const data = await res.json();

        if (!res.ok || !data.product) {
          throw new Error(data.message || "Product load failed");
        }

        setProduct(data.product);
      } catch (err) {
        console.error("ProductDetail error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [propId, propSlug]);

  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (loading) return <div className="p-4">Loading product…</div>;
  if (!product) return <div className="p-4">No product data.</div>;

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold">{product.title}</h1>
      <div className="text-xl text-green-600">
        ₦{product.price?.toFixed(2)?.toLocaleString?.()}
      </div>
      {/* ... rest of your UI */}
    </div>
  );
};

export default ProductDetail;
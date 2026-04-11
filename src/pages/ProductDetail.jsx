// ProductDetail.jsx
import React, { useState, useEffect } from "react";

const ProductDetail = ({ id, slug }) => {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If neither id nor slug is provided, bail early
    if (!id && !slug) {
      setLoading(false);
      setError("Missing product id or slug");
      return;
    }

    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);

        // Build the API URL
        const base = process.env.REACT_APP_API_URL || "";
        const endpoint = id
          ? `${base}/api/product/${id}`
          : `${base}/api/product/${encodeURIComponent(slug)}`;

        console.log("Fetching product from:", endpoint);

        const res = await fetch(endpoint);

        if (!res.ok) {
          throw new Error(
            `HTTP ${res.status}: ${res.statusText || "Failed to fetch product"}`
          );
        }

        const data = await res.json();
        console.log("API response:", data);

        if (!data.product) {
          throw new Error("No product data returned");
        }

        setProduct(data.product);
      } catch (err) {
        console.error("ProductDetail fetch error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, slug]);

  if (error) {
    return (
      <div className="p-4 text-red-600">
        <p>Error loading product:</p>
        <code className="block text-sm">{error}</code>
      </div>
    );
  }

  if (loading) {
    return <div className="p-4">Loading product…</div>;
  }

  if (!product) {
    return <div className="p-4">No product data.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* Title */}
      <h1 className="text-2xl font-bold mb-2">{product.title || "Untitled"}</h1>

      {/* Price */}
      <div className="text-xl text-green-600 mb-4">
        ₦{product.price?.toFixed(2)?.toLocaleString?.()}
      </div>

      {/* Image */}
      {product.images?.length > 0 ? (
        <img
          src={product.images[0]}
          alt={product.title}
          className="w-full h-64 object-cover rounded mb-4"
        />
      ) : (
        <div className="w-full h-64 bg-gray-200 rounded flex items-center justify-center mb-4">
          No image
        </div>
      )}

      {/* Description */}
      {product.description && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Description</h2>
          <p className="text-gray-700">{product.description}</p>
        </div>
      )}

      {/* Attributes */}
      {product.attributes && Object.keys(product.attributes).length > 0 && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Details</h2>
          <ul className="space-y-1">
            {Object.entries(product.attributes).map(([key, value]) => (
              <li key={key}>
                <strong>{key}:</strong> {String(value || "-")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Location */}
      {(product.location?.state || product.location?.city) && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Location</h2>
          <p>
            {product.location.city}, {product.location.state}
          </p>
        </div>
      )}

      {/* Contact */}
      {(product.phone || product.whatsapp) && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Contact</h2>
          <div>
            {product.phone && (
              <p>
                Phone: <a href={`tel:${product.phone}`}>{product.phone}</a>
              </p>
            )}
            {product.whatsapp && product.whatsapp_link && (
              <p>
                WhatsApp:{" "}
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={product.whatsapp_link}
                >
                  {product.whatsapp}
                </a>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Delivery */}
      {product.delivery?.available && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Delivery</h2>
          <p>
            Delivery in {product.delivery.duration?.from ?? 0}–
            {product.delivery.duration?.to ?? 0} days
          </p>
          {typeof product.delivery.fee === "number" && (
            <p>Fee: ₦{product.delivery.fee.toLocaleString()}</p>
          )}
          {product.delivery.note && <p>{product.delivery.note}</p>}
        </div>
      )}

      {/* Views */}
      <div className="text-sm text-gray-500">
        Views: {product.views || 0}
      </div>
    </div>
  );
};

export default ProductDetail;
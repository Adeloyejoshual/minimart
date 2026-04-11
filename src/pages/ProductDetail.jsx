// components/ProductDetail.jsx
import React, { useState, useEffect } from "react";

const ProductDetail = ({ id, slug }) => {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          id
            ? `/api/product/${id}`
            : `/api/product/${slug || ""}`
        );
        const data = await res.json();

        if (!res.ok || !data.product) {
          throw new Error(data.message || "Product not found");
        }

        setProduct(data.product);
      } catch (err) {
        console.error("Failed to load product:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id || slug) {
      fetchProduct();
    }
  }, [id, slug]);

  if (loading) return <div className="p-4">Loading product...</div>;
  if (error) return <div className="text-red-600 p-4">{error}</div>;
  if (!product) return <div className="p-4">No product data</div>;

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* Images */}
      <div className="mb-4">
        {product.images?.length > 0 ? (
          <img
            src={product.images[0]}
            alt={product.title}
            className="w-full h-64 object-cover rounded"
          />
        ) : (
          <div className="w-full h-64 bg-gray-200 rounded flex items-center justify-center">
            No image
          </div>
        )}
      </div>

      {/* Title & Price */}
      <h1 className="text-2xl font-bold mb-2">{product.title}</h1>
      <div className="text-xl text-green-600 mb-4">
        ₦{parseFloat(product.price).toLocaleString()}
      </div>

      {/* Description */}
      {product.description && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Description</h2>
          <p className="text-gray-700">{product.description}</p>
        </div>
      )}

      {/* Attributes */}
      {Object.keys(product.attributes || {}).length > 0 && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Details</h2>
          <ul className="space-y-1">
            {Object.entries(product.attributes).map(([key, value]) => (
              <li key={key}>
                <strong>{key}:</strong> {String(value)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Location */}
      {product.location?.state && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Location</h2>
          <p>
            {product.location.city}, {product.location.state}
          </p>
        </div>
      )}

      {/* Contact */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Contact</h2>
        <div>
          {product.phone && (
            <p>
              Phone: <a href={`tel:${product.phone}`}>{product.phone}</a>
            </p>
          )}
          {product.whatsapp && (
            <p>
              WhatsApp:{" "}
              <a target="_blank" rel="noreferrer" href={product.whatsapp_link}>
                {product.whatsapp}
              </a>
            </p>
          )}
        </div>
      </div>

      {/* Delivery */}
      {product.delivery?.available && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Delivery</h2>
          <p>
            Delivery available in {product.delivery.duration.from}–
            {product.delivery.duration.to} days
          </p>
          {typeof product.delivery.fee === "number" && (
            <p>
              Fee: ₦{product.delivery.fee.toLocaleString()}
            </p>
          )}
          {product.delivery.note && <p>{product.delivery.note}</p>}
        </div>
      )}

      {/* View count */}
      <div className="text-sm text-gray-500">
        Views: {product.views || 0}
      </div>
    </div>
  );
};

export default ProductDetail;
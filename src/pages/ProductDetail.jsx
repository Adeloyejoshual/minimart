// src/pages/ProductDetail.jsx
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const ProductDetail = ({ user }) => {
  const { key } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const { data } = await axios.get(`/api/product/${encodeURIComponent(key)}`);
        setProduct(data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load product");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [key]);

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (error || !product) {
    return (
      <div className="p-6 text-red-600">
        <h2>Product not found</h2>
        <p>{error}</p>
        <button onClick={() => window.history.back()} className="text-blue-600">
          Go back
        </button>
      </div>
    );
  }

  const images = product.media?.images || [];
  const primaryImage = images[0] || "/placeholder.jpg";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image */}
        <div>
          <img
            src={primaryImage}
            alt={product.title}
            className="w-full h-96 object-cover rounded-lg"
          />
        </div>

        {/* Info */}
        <div>
          <h1 className="text-3xl font-bold">{product.title}</h1>

          {product.is_promoted && product.promotion_type === "discount" ? (
            <div className="mt-2">
              <span className="text-2xl font-bold text-green-600">
                ₦{(product.price * (1 - 0.01 * (product.promotion_amount || 0))).toFixed(2)}
              </span>
              <span className="ml-2 text-gray-500 line-through">
                ₦{product.price.toFixed(2)}
              </span>
            </div>
          ) : (
            <div className="mt-2 text-2xl font-bold text-green-600">
              ₦{product.price.toFixed(2)}
            </div>
          )}

          <p className="mt-4 text-gray-700">{product.description}</p>

          <div className="mt-6">
            <div className="text-sm text-gray-600">
              <span>Category: </span>
              <span className="font-medium">{product.category?.name}</span>
            </div>
            <div className="text-sm text-gray-600">
              <span>Location: </span>
              <span className="font-medium">
                {product.location_city ? `${product.location_city}, ` : ""}{product.location_state}
              </span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {product.contact?.phone && (
              <button
                className="w-full py-3 bg-blue-600 text-white rounded-lg"
                onClick={() => window.open(`tel:${product.contact.phone}`)}
              >
                Call Seller
              </button>
            )}
            {product.contact?.whatsapp && (
              <button
                className="w-full py-3 bg-green-600 text-white rounded-lg"
                onClick={() => window.open(`https://wa.me/${product.contact.whatsapp}`, "_blank")}
              >
                Chat on WhatsApp
              </button>
            )}
          </div>
        </div>
      </div>

      {images.length > 1 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium">More images</h3>
          <div className="grid grid-cols-4 gap-3 mt-3">
            {images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`${product.title} ${i + 1}`}
                className="h-24 w-full object-cover rounded"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
// src/pages/ProductDetail.jsx

import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const ProductDetail = ({ user }) => {
  const { slug } = useParams(); // from /product/:slug
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const { data } = await axios.get(
          `/api/product/slug/${encodeURIComponent(slug)}`
        );
        console.log("Product data:", data);
        setProduct(data);
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          err.message ||
          "Failed to load product";
        console.error("Fetch error:", err);
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="text-lg text-gray-600">Loading product...</span>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-lg font-semibold text-red-600">Product not found</h2>
        <p className="text-sm text-gray-500">{error}</p>
        <button
          onClick={() => window.history.back()}
          className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Go back
        </button>
      </div>
    );
  }

  const images = product.images.map((img) => img.url);
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
          {images.length > 1 && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {images.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`${product.title} ${idx + 1}`}
                  className="h-20 w-full object-cover rounded"
                />
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <h1 className="text-3xl font-bold">{product.title}</h1>

          <div className="mt-2 text-2xl font-bold text-green-600">
            ₦{product.price.toFixed(2)}
          </div>

          <p className="mt-4 text-gray-700">{product.description}</p>

          <div className="mt-6">
            <div className="text-sm text-gray-600">
              <span>Location: </span>
              <span className="font-medium">
                {product.location?.city ? `${product.location.city}, ` : ""}
                {product.location?.state}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              <span>Views: </span>
              <span className="font-medium">{product.views}</span>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {product.contact?.phone && (
              <button
                className="w-full py-3 bg-blue-600 text-white rounded-lg"
                onClick={() => window.open(`tel:${product.contact.phone}`)}
              >
                Call Seller
              </button>
            )}
            {product.contact?.whatsapp_link && (
              <button
                className="w-full py-3 bg-green-600 text-white rounded-lg"
                onClick={() =>
                  window.open(product.contact.whatsapp_link, "_blank")
                }
              >
                Chat on WhatsApp
              </button>
            )}
            {user && (
              <button
                className="w-full py-3 bg-gray-600 text-white rounded-lg"
                onClick={() => {
                  console.log("Add to wishlist/cart:", product.id);
                }}
              >
                {user.id === product.user_id
                  ? "Edit Product"
                  : "Add to Wishlist"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Extra details */}
      <div className="mt-10">
        <h3 className="text-lg font-medium">Product info</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 text-sm">
          {product.attributes?.brand && (
            <div>
              <span className="font-medium">Brand:</span>{" "}
              {product.attributes.brand}
            </div>
          )}
          {product.attributes?.model && (
            <div>
              <span className="font-medium">Model:</span>{" "}
              {product.attributes.model}
            </div>
          )}
          {product.attributes?.condition && (
            <div>
              <span className="font-medium">Condition:</span>{" "}
              {product.attributes.condition}
            </div>
          )}
          <div>
            <span className="font-medium">Status:</span> {product.status}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
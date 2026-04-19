// src/pages/ProductDetail.jsx

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api";

const ProductDetail = ({ user }) => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);

      try {
        const { data } = await axios.get(
          `/api/product/slug/${encodeURIComponent(slug)}`
        );
        setProduct(data);

        // Fetch similar products (same category)
        const similarRes = await axios.get(
          `/api/products?category_id=${data.category_id}&limit=12`
        );
        setSimilar(similarRes.data.products || []);
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          err.message ||
          "Failed to load product";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetch();
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

  const images = product.images || [];
  const primaryImage = images[0] || "/placeholder.jpg";

  // ----------------------
  // Similar products grid
  // ----------------------

  const renderSimilar = () => {
    if (!similar.length) return null;

    return (
      <section className="mt-10">
        <h3 className="text-lg font-medium mb-4">Similar products</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {similar
            .filter((p) => p.id !== product.id)
            .map((p) => (
              <div
                key={p.id}
                className="card cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/product/${p.slug}`)}
              >
                <div className="card-image">
                  <img
                    src={
                      p.images?.[0] ||
                      "https://via.placeholder.com/160x120/eee/6366f1?text=??"
                    }
                    alt={p.title}
                    className="w-full h-32 object-cover rounded-t"
                  />
                </div>
                <div className="card-body px-2 py-2">
                  <h3 className="title text-sm line-clamp-2">{p.title}</h3>
                  <p className="price text-sm">
                    ₦{Number(p.price).toLocaleString()}
                  </p>
                  <p className="location text-xs text-gray-600">
                    {p.location?.city || "Nationwide"}
                  </p>
                  <div className="card-meta text-xs text-gray-500">
                    {p.views} views
                  </div>
                </div>
              </div>
            ))}
        </div>
      </section>
    );
  };

  // ----------------------
  // Main product view (marketplace.js style)
  // ----------------------

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Image */}
        <div className="flex flex-col space-y-4">
          <div className="relative overflow-hidden rounded-lg">
            <img
              src={primaryImage}
              alt={product.title}
              className="w-full h-80 object-cover"
            />
          </div>

          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-2 mt-2">
              {images.map((img, idx) => (
                <div key={idx} className="overflow-hidden rounded">
                  <img
                    src={img}
                    alt={`${product.title} ${idx + 1}`}
                    className="w-full h-16 object-cover cursor-pointer"
                    onClick={() => {
                      // You can hook this up to a lightbox / modal if you want
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Product info (marketplace.js style) */}
        <div>
          <h1 className="text-2xl font-bold mb-2">{product.title}</h1>

          <div className="text-xl font-bold text-green-600 mb-2">
            ₦{Number(product.price).toFixed(2)}
          </div>

          <p className="text-gray-700 mb-4">{product.description}</p>

          <div className="text-sm text-gray-600 mb-4">
            <div className="mb-1">
              <span className="font-medium">Condition:</span>{" "}
              {product.attributes?.condition || "N/A"}
            </div>
            {product.attributes?.brand && (
              <div className="mb-1">
                <span className="font-medium">Brand:</span>{" "}
                {product.attributes.brand}
              </div>
            )}
            {product.attributes?.model && (
              <div className="mb-1">
                <span className="font-medium">Model:</span>{" "}
                {product.attributes.model}
              </div>
            )}
            <div>
              <span className="font-medium">Location:</span>{" "}
              {product.location?.city ? `${product.location.city}, ` : ""}
              {product.location?.state || "Nigeria"}
            </div>
          </div>

          <div className="mb-4 text-sm text-gray-600">
            <span className="font-medium">Views:</span> {product.views}
          </div>

          <div className="flex space-x-3">
            {user && (
              <button
                className="flex-1 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                onClick={() => {
                  console.log("Add to wishlist:", product.id);
                }}
              >
                Add to Wishlist
              </button>
            )}
            <button
              className="flex-1 py-2.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
              onClick={() => {
                console.log("Start chat:", product.id);
              }}
            >
              Send Message
            </button>
          </div>
        </div>
      </div>

      {/* Extra details section */}
      <div className="mt-8">
        <h3 className="text-lg font-medium mb-2">Product info</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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
          {product.location?.state && (
            <div>
              <span className="font-medium">State:</span> {product.location.state}
            </div>
          )}
          {product.location?.city && (
            <div>
              <span className="font-medium">City:</span> {product.location.city}
            </div>
          )}
        </div>
      </div>

      {/* Similar products */}
      {renderSimilar()}
    </div>
  );
};

export default ProductDetail;
// src/pages/Marketplace/ProductDetail.jsx

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function ProductDetail() {
  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedImage, setSelectedImage] = useState(0);
  const [timeLeft, setTimeLeft] = useState("");

  const API_URL = import.meta.env.VITE_API_URL || "";

  // Fetch product
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`${API_URL}/api/marketplace/${id}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load product");
        }

        setProduct(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  // Promotion countdown
  useEffect(() => {
    if (!product?.promo_expiry) return;

    const interval = setInterval(() => {
      const now = new Date();
      const expiry = new Date(product.promo_expiry);
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft("Promotion expired");
        clearInterval(interval);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff / (1000 * 60)) % 60);

      setTimeLeft(`${hours}h ${minutes}m left`);
    }, 60000);

    return () => clearInterval(interval);
  }, [product]);

  if (loading) return <div className="p-6">Loading product...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;
  if (!product) return null;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      
      {/* Promotion Badge */}
      {product.promoted && (
        <div className="mb-4">
          <span className="bg-yellow-400 text-black px-4 py-1 rounded-full font-semibold">
            🔥 {product.promo_plan}
          </span>
          {timeLeft && (
            <span className="ml-3 text-sm text-gray-600">
              {timeLeft}
            </span>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        
        {/* Image Section */}
        <div>
          <img
            src={product.images[selectedImage]}
            alt={product.title}
            className="w-full h-96 object-cover rounded-xl"
          />

          <div className="flex gap-2 mt-4 overflow-x-auto">
            {product.images.map((img, index) => (
              <img
                key={index}
                src={img}
                alt="thumbnail"
                onClick={() => setSelectedImage(index)}
                className={`w-20 h-20 object-cover rounded-lg cursor-pointer border ${
                  selectedImage === index
                    ? "border-blue-600"
                    : "border-gray-300"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Product Info */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            {product.title}
          </h1>

          <p className="text-3xl text-green-600 font-bold mb-4">
            ₦{product.price?.toLocaleString()}
          </p>

          <div className="space-y-2 text-gray-700">
            <p><strong>Category:</strong> {product.category}</p>
            {product.brand && (
              <p><strong>Brand:</strong> {product.brand}</p>
            )}
            {product.model && (
              <p><strong>Model:</strong> {product.model}</p>
            )}
            {product.condition && (
              <p><strong>Condition:</strong> {product.condition}</p>
            )}
            <p><strong>Location:</strong> {product.state}, {product.city}</p>
          </div>

          <hr className="my-6" />

          <h2 className="text-lg font-semibold mb-2">
            Description
          </h2>
          <p className="text-gray-700 leading-relaxed">
            {product.description}
          </p>

          <hr className="my-6" />

          {/* Seller Contact */}
          <div className="bg-gray-100 p-4 rounded-xl">
            <h3 className="font-semibold mb-2">
              Seller Contact
            </h3>
            <a
              href={`tel:${product.phone}`}
              className="block bg-blue-600 text-white text-center py-2 rounded-lg"
            >
              Call Seller
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
// src/pages/Marketplace/ProductDetail.jsx

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function ProductDetail() {
  const { id } = useParams();
  const API_URL = import.meta.env.VITE_API_URL;

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedImage, setSelectedImage] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [showBottomBar, setShowBottomBar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // ✅ Fetch real product from backend
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`${API_URL}/api/marketplace/${id}`);
        if (!res.ok) throw new Error("Product not found");

        const data = await res.json();
        setProduct(data);
      } catch (err) {
        setError("Failed to load product.");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, API_URL]);

  // ✅ Scroll hide/show bottom bar
  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY > lastScrollY + 10) setShowBottomBar(false);
      else if (currentY < lastScrollY - 10) setShowBottomBar(true);
      setLastScrollY(currentY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-lg font-semibold">
        Loading product...
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex justify-center items-center h-screen text-red-500 text-lg">
        {error || "Product not found"}
      </div>
    );
  }

  const avgRating =
    product.reviews?.length > 0
      ? (
          product.reviews.reduce((sum, r) => sum + r.rating, 0) /
          product.reviews.length
        ).toFixed(1)
      : 0;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 pb-24">
      {/* Back Button */}
      <button
        onClick={() => window.history.back()}
        className="mb-6 text-blue-600 font-semibold hover:underline"
      >
        ← Back
      </button>

      {/* MAIN SECTION */}
      <div className="grid md:grid-cols-2 gap-8">

        {/* IMAGES */}
        <div className="relative">
          <img
            src={product.images?.[selectedImage]}
            alt={product.title}
            className="w-full h-96 object-cover rounded-xl shadow-lg cursor-pointer"
            onClick={() => setZoom(true)}
          />

          {product.images?.length > 1 && (
            <>
              <button
                onClick={() =>
                  setSelectedImage(
                    (prev) =>
                      (prev - 1 + product.images.length) %
                      product.images.length
                  )
                }
                className="absolute top-1/2 left-3 -translate-y-1/2 bg-white p-2 rounded-full shadow hidden md:block"
              >
                ‹
              </button>

              <button
                onClick={() =>
                  setSelectedImage(
                    (prev) => (prev + 1) % product.images.length
                  )
                }
                className="absolute top-1/2 right-3 -translate-y-1/2 bg-white p-2 rounded-full shadow hidden md:block"
              >
                ›
              </button>
            </>
          )}

          {/* Thumbnails */}
          <div className="flex gap-2 mt-4 overflow-x-auto">
            {product.images?.map((img, i) => (
              <img
                key={i}
                src={img}
                alt="thumb"
                onClick={() => setSelectedImage(i)}
                className={`w-20 h-20 rounded-lg object-cover cursor-pointer border-2 ${
                  selectedImage === i
                    ? "border-blue-600"
                    : "border-gray-300"
                }`}
              />
            ))}
          </div>
        </div>

        {/* PRODUCT INFO */}
        <div>
          <h1 className="text-3xl font-bold mb-3">{product.title}</h1>

          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl font-bold text-blue-700">
              ₦{Number(product.price).toLocaleString()}
            </span>

            {product.negotiable && (
              <span className="bg-yellow-200 text-yellow-800 text-xs px-2 py-1 rounded">
                Negotiable
              </span>
            )}
          </div>

          <p className="text-gray-600 mb-3">
            {product.state}, {product.city}
          </p>

          {/* Seller Card */}
          <div className="bg-gray-50 p-4 rounded-xl shadow-sm mb-4">
            <p className="font-semibold">{product.poster_name}</p>
            <p className="text-sm text-gray-500">
              ⭐ {avgRating} ({product.reviews?.length || 0} reviews)
            </p>
          </div>

          {/* Description */}
          <div>
            <h2 className="font-semibold text-lg mb-2">
              Description
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {product.description}
            </p>
          </div>
        </div>
      </div>

      {/* ZOOM OVERLAY */}
      {zoom && (
        <div
          onClick={() => setZoom(false)}
          className="fixed inset-0 bg-black bg-opacity-90 flex justify-center items-center z-50"
        >
          <img
            src={product.images?.[selectedImage]}
            alt="Zoom"
            className="max-w-[90%] max-h-[90%] object-contain"
          />
        </div>
      )}

      {/* STICKY BOTTOM BAR */}
      <div
        className={`fixed bottom-0 left-0 w-full bg-white shadow-lg p-4 flex justify-around transition-transform duration-300 z-50 ${
          showBottomBar ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <a
          href={`tel:${product.phone_number}`}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg"
        >
          Call
        </a>

        <a
          href={`https://wa.me/${product.phone_number}`}
          target="_blank"
          rel="noreferrer"
          className="bg-green-600 text-white px-6 py-2 rounded-lg"
        >
          WhatsApp
        </a>

        <button className="bg-gray-200 px-6 py-2 rounded-lg">
          Save
        </button>
      </div>
    </div>
  );
}
// src/pages/Marketplace/ProductDetail.jsx
import { useState, useEffect } from "react";

export default function ProductDetail({ product }) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [showBottomBar, setShowBottomBar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Scroll detection for bottom bar
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

  // Calculate average rating
  const avgRating = product.reviews?.length
    ? (product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length).toFixed(1)
    : 0;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      {/* Back Arrow */}
      <button
        onClick={() => window.history.back()}
        className="mb-4 text-blue-600 font-semibold flex items-center gap-2"
      >
        ← Back
      </button>

      {/* PRODUCT IMAGES / MEDIA */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="relative">
          <img
            src={product.images[selectedImage]}
            alt={product.title}
            className="w-full h-96 object-cover rounded-xl shadow-lg cursor-zoom-in transition-transform duration-200"
            onClick={() => setZoom(true)}
          />

          {product.images.length > 1 && (
            <>
              <button
                onClick={() =>
                  setSelectedImage((prev) => (prev - 1 + product.images.length) % product.images.length)
                }
                className="absolute top-1/2 left-2 -translate-y-1/2 bg-white bg-opacity-70 rounded-full p-2 hover:bg-opacity-100 hidden md:block"
              >
                ‹
              </button>
              <button
                onClick={() =>
                  setSelectedImage((prev) => (prev + 1) % product.images.length)
                }
                className="absolute top-1/2 right-2 -translate-y-1/2 bg-white bg-opacity-70 rounded-full p-2 hover:bg-opacity-100 hidden md:block"
              >
                ›
              </button>
            </>
          )}

          {/* Thumbnail Strip */}
          <div className="flex gap-2 mt-4 overflow-x-auto md:hidden">
            {product.images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`Thumb ${i}`}
                onClick={() => setSelectedImage(i)}
                className={`w-20 h-20 object-cover rounded-lg cursor-pointer border-2 ${
                  selectedImage === i ? "border-blue-600" : "border-gray-300"
                }`}
              />
            ))}
          </div>
        </div>

        {/* PRODUCT INFO */}
        <div className="flex flex-col justify-between space-y-4">
          {/* Title & Price */}
          <div>
            <h1 className="text-3xl font-bold mb-2">{product.title}</h1>
            <p className="text-gray-600 mb-1">Category: {product.category} / {product.subcategory}</p>

            <div className="flex items-center gap-2 mb-2">
              <p className="text-2xl font-semibold text-blue-700">₦{Number(product.price).toLocaleString()}</p>
              {product.discount_price && (
                <p className="text-green-600 font-semibold line-through ml-2">
                  ₦{Number(product.discount_price).toLocaleString()}
                </p>
              )}
              {product.negotiable && <span className="ml-2 px-2 py-1 text-xs bg-yellow-200 text-yellow-800 rounded">Negotiable</span>}
            </div>

            {/* Delivery Info */}
            {product.deliveryRegions?.length > 0 && (
              <div className="text-gray-700 mb-2">
                <strong>Delivery:</strong>{" "}
                {product.deliveryRegions.map((d, i) => (
                  <span key={i}>
                    {d.state} - {d.city} ({d.method}, {d.from}-{d.to} days)
                    {d.chargeFee ? `, Fee: ₦${d.fee}` : ", Free"}
                    {i < product.deliveryRegions.length - 1 && "; "}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Seller Card */}
          <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl shadow-inner">
            <img
              src={product.sellerAvatar || "/default-avatar.png"}
              alt="Seller"
              className="w-16 h-16 rounded-full object-cover"
            />
            <div>
              <p className="font-semibold">{product.sellerName}</p>
              <p className="text-gray-500 text-sm">{product.sellerLocation}</p>
              <p className="text-yellow-500 font-semibold">
                {"★".repeat(Math.round(avgRating))}{" "}
                <span className="text-gray-400 font-normal">({product.reviews?.length || 0} reviews)</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">Chat Seller</button>
            <button className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition">Send Offer</button>
            <button className="flex-1 bg-gray-200 py-2 rounded-lg hover:bg-gray-300 transition">Favorite</button>
            <button className="flex-1 bg-gray-200 py-2 rounded-lg hover:bg-gray-300 transition">Share</button>
          </div>
        </div>

        {/* Video / 360° */}
        {product.video_link && (
          <div className="mt-4 md:col-span-2">
            <iframe
              src={product.video_link}
              title="Product Video"
              className="w-full h-64 rounded-lg"
              allowFullScreen
            />
          </div>
        )}
      </div>

      {/* FULL PRODUCT DESCRIPTION */}
      <div className="mt-6 p-4 bg-white rounded-xl shadow-md">
        <h2 className="text-xl font-semibold mb-2">Product Details</h2>
        <p><strong>Condition:</strong> {product.condition} {product.used_detail && `(${product.used_detail})`}</p>
        <p><strong>Quantity Available:</strong> {product.quantity}</p>
        <p><strong>Features:</strong> {product.features?.join(", ") || "None"}</p>
      </div>

      {/* REVIEWS & RATINGS */}
      <div className="mt-6 p-4 bg-blue-50 rounded-xl shadow-inner">
        <h2 className="text-xl font-semibold mb-2">Reviews & Ratings</h2>
        {product.reviews?.length > 0 ? (
          product.reviews.map((r, i) => (
            <div key={i} className="border-b py-2">
              <p className="font-semibold">{r.user}</p>
              <p className="text-yellow-500">{"★".repeat(r.rating)}</p>
              <p className="text-gray-700">{r.comment}</p>
            </div>
          ))
        ) : (
          <p>No reviews yet.</p>
        )}
      </div>

      {/* RECOMMENDED / SIMILAR LISTINGS */}
      {product.similar?.length > 0 && (
        <div className="mt-6 p-4 bg-white rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-2">Similar Products</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {product.similar.map((p, i) => (
              <div key={i} className="border rounded-lg p-2 cursor-pointer hover:shadow-lg transition">
                <img src={p.images[0]} alt={p.title} className="w-full h-28 object-cover rounded-lg mb-1" />
                <p className="text-sm font-semibold">{p.title}</p>
                <p className="text-blue-600 font-bold">₦{Number(p.price).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ZOOM OVERLAY */}
      {zoom && (
        <div
          onClick={() => setZoom(false)}
          className="fixed inset-0 bg-black bg-opacity-90 flex justify-center items-center z-50 cursor-zoom-out"
        >
          <img
            src={product.images[selectedImage]}
            alt="Zoomed"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-lg"
          />
        </div>
      )}

      {/* STICKY BOTTOM BAR */}
      <div
        className={`fixed bottom-0 left-0 w-full bg-white shadow-lg p-4 flex justify-around transition-transform duration-300 z-50 ${
          showBottomBar ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg">Chat Seller</button>
        <button className="bg-green-600 text-white px-4 py-2 rounded-lg">Buy Now</button>
        <button className="bg-gray-200 px-4 py-2 rounded-lg">Favorite</button>
        <button className="bg-gray-200 px-4 py-2 rounded-lg">Share</button>
      </div>
    </div>
  );
}
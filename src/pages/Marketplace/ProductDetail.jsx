// src/pages/Marketplace/ProductDetail.jsx
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaStar, FaStarHalfAlt, FaRegStar, FaHeart, FaShareAlt, FaComment } from "react-icons/fa";

export default function ProductDetail({ product }) {
  const navigate = useNavigate();
  const [mainImage, setMainImage] = useState(product?.images?.[0] || "");
  const [favorite, setFavorite] = useState(false);

  if (!product) return <p className="text-center mt-20 text-gray-500">Product not found</p>;

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      {/* Back Arrow */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold"
      >
        <FaArrowLeft /> Back
      </button>

      {/* Images Section */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Main Image */}
        <div className="flex-1">
          <img
            src={mainImage}
            alt={product.title}
            className="w-full h-[400px] md:h-[500px] object-cover rounded-lg shadow-lg"
          />
          {/* Thumbnails */}
          <div className="flex gap-2 mt-3 overflow-x-auto">
            {product.images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`Thumbnail ${i}`}
                onClick={() => setMainImage(img)}
                className={`w-20 h-20 object-cover rounded cursor-pointer border-2 ${
                  mainImage === img ? "border-blue-500" : "border-transparent"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Product Info */}
        <div className="flex-1 space-y-4">
          <h1 className="text-3xl font-bold text-gray-800">{product.title}</h1>
          <p className="text-gray-600">Sold by <span className="font-semibold">{product.poster_name}</span></p>
          <p className="text-gray-600">{product.city}, {product.state}</p>

          {/* Price */}
          <div className="text-2xl font-bold text-green-600">
            ₦{Number(product.price).toLocaleString()}
            {product.negotiable && <span className="text-gray-500 text-lg ml-2">Negotiable</span>}
          </div>

          {/* Ratings */}
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <FaStar key={i} className="text-yellow-400" />
            ))}
            <span className="text-gray-600 ml-2">(24 Reviews)</span>
          </div>

          {/* Description */}
          <p className="text-gray-700">{product.description}</p>

          {/* Offers & Delivery */}
          <div className="space-y-2">
            {product.discount_price && (
              <p className="text-red-500 font-semibold">Discount Price: ₦{Number(product.discount_price).toLocaleString()}</p>
            )}
            {product.deliveryRegions?.length > 0 && (
              <div className="bg-blue-50 p-3 rounded shadow-sm">
                <h3 className="font-semibold text-blue-700">Delivery Options:</h3>
                {product.deliveryRegions.map((d, i) => (
                  <p key={i} className="text-gray-700">
                    {d.state} - {d.city} • {d.from}-{d.to} days {d.isFreeDelivery && <span className="text-green-600 font-semibold">FREE</span>}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Interaction Buttons */}
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setFavorite(!favorite)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 border rounded-lg font-semibold ${
                favorite ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100"
              }`}
            >
              <FaHeart /> {favorite ? "Favorited" : "Favorite"}
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 border rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
            >
              <FaShareAlt /> Share
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 border rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 font-semibold"
            >
              <FaComment /> Chat
            </button>
          </div>
        </div>
      </div>

      {/* Full Product Description & Features */}
      <div className="bg-white p-4 rounded-lg shadow-md space-y-3">
        <h2 className="text-xl font-bold text-gray-800">Product Details</h2>
        {product.features?.length > 0 && (
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            {product.features.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        )}
        <p className="text-gray-700">{product.description}</p>
        <p className="text-gray-600 mt-2">Condition: {product.condition}</p>
        <p className="text-gray-600">Brand: {product.brand} | Model: {product.model}</p>
        {product.year && <p className="text-gray-600">Year: {product.year}</p>}
        {product.ram && <p className="text-gray-600">RAM: {product.ram}</p>}
        {product.storage && <p className="text-gray-600">Storage: {product.storage}</p>}
      </div>

      {/* Reviews Section */}
      <div className="bg-white p-4 rounded-lg shadow-md space-y-3">
        <h2 className="text-xl font-bold text-gray-800">Reviews & Ratings</h2>
        <p className="text-gray-600">No reviews yet. Be the first to review!</p>
      </div>

      {/* Similar Products / Recommendations */}
      <div className="bg-white p-4 rounded-lg shadow-md space-y-3">
        <h2 className="text-xl font-bold text-gray-800">Similar Listings</h2>
        <div className="flex gap-4 overflow-x-auto">
          {product.similar?.map((p, i) => (
            <div key={i} className="w-48 bg-gray-100 p-2 rounded-lg flex-shrink-0 cursor-pointer hover:shadow-lg">
              <img src={p.images?.[0]} alt={p.title} className="w-full h-32 object-cover rounded" />
              <h3 className="text-gray-800 font-semibold mt-1">{p.title}</h3>
              <p className="text-green-600 font-bold">₦{Number(p.price).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
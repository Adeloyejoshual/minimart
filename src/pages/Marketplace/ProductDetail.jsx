// src/pages/Marketplace/ProductDetail.jsx
import { useState, useEffect } from "react";

export default function ProductDetail({ product }) {
  // Fallback demo product if no prop passed
  const demoProduct = {
    title: "Samsung Galaxy S23 Ultra",
    price: 850000,
    discount_price: 800000,
    negotiable: true,
    category: "Electronics",
    subcategory: "Mobile Phones",
    brand: "Samsung",
    model: "S23 Ultra",
    condition: "New",
    used_detail: "",
    quantity: 5,
    features: ["128GB", "12GB RAM", "5G"],
    images: [
      "https://via.placeholder.com/600x600?text=Image+1",
      "https://via.placeholder.com/600x600?text=Image+2",
      "https://via.placeholder.com/600x600?text=Image+3",
    ],
    video_link: "",
    sellerName: "John Doe",
    sellerAvatar: "https://via.placeholder.com/100",
    sellerLocation: "Lagos, Nigeria",
    reviews: [
      { user: "Alice", rating: 5, comment: "Excellent product!" },
      { user: "Bob", rating: 4, comment: "Very good, fast delivery." },
    ],
    deliveryRegions: [
      { state: "Lagos", city: "Ikeja", method: "Courier", from: 2, to: 4, chargeFee: false },
      { state: "Abuja", city: "Garki", method: "Pickup", from: 1, to: 3, chargeFee: true, fee: 2000 },
    ],
    similar: [
      {
        title: "Samsung Galaxy S23",
        price: 750000,
        images: ["https://via.placeholder.com/300x300?text=Similar+1"],
      },
      {
        title: "Samsung Galaxy S22",
        price: 650000,
        images: ["https://via.placeholder.com/300x300?text=Similar+2"],
      },
    ],
  };

  product = product || demoProduct; // Use fallback if no prop

  // rest of the component stays the same...
  const [selectedImage, setSelectedImage] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [showBottomBar, setShowBottomBar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

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

  const avgRating = product.reviews?.length
    ? (product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length).toFixed(1)
    : 0;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <button onClick={() => window.history.back()} className="mb-4 text-blue-600 font-semibold flex items-center gap-2">← Back</button>

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
              <button onClick={() => setSelectedImage((prev) => (prev - 1 + product.images.length) % product.images.length)}
                className="absolute top-1/2 left-2 -translate-y-1/2 bg-white bg-opacity-70 rounded-full p-2 hover:bg-opacity-100 hidden md:block">‹</button>
              <button onClick={() => setSelectedImage((prev) => (prev + 1) % product.images.length)}
                className="absolute top-1/2 right-2 -translate-y-1/2 bg-white bg-opacity-70 rounded-full p-2 hover:bg-opacity-100 hidden md:block">›</button>
            </>
          )}

          <div className="flex gap-2 mt-4 overflow-x-auto md:hidden">
            {product.images.map((img, i) => (
              <img key={i} src={img} alt={`Thumb ${i}`} onClick={() => setSelectedImage(i)}
                className={`w-20 h-20 object-cover rounded-lg cursor-pointer border-2 ${selectedImage===i?'border-blue-600':'border-gray-300'}`} />
            ))}
          </div>
        </div>

        {/* PRODUCT INFO */}
        <div className="flex flex-col justify-between space-y-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{product.title}</h1>
            <p className="text-gray-600 mb-1">Category: {product.category} / {product.subcategory}</p>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-2xl font-semibold text-blue-700">₦{Number(product.price).toLocaleString()}</p>
              {product.discount_price && <p className="text-green-600 font-semibold line-through ml-2">₦{Number(product.discount_price).toLocaleString()}</p>}
              {product.negotiable && <span className="ml-2 px-2 py-1 text-xs bg-yellow-200 text-yellow-800 rounded">Negotiable</span>}
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl shadow-inner">
            <img src={product.sellerAvatar || "/default-avatar.png"} alt="Seller" className="w-16 h-16 rounded-full object-cover" />
            <div>
              <p className="font-semibold">{product.sellerName}</p>
              <p className="text-gray-500 text-sm">{product.sellerLocation}</p>
              <p className="text-yellow-500 font-semibold">{"★".repeat(Math.round(avgRating))} <span className="text-gray-400 font-normal">({product.reviews?.length || 0} reviews)</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
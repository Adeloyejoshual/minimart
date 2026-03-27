import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

export default function ProductDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offerPrice, setOfferPrice] = useState("");

  const [isWishlisted, setIsWishlisted] = useState(false);

  /* ================= FETCH PRODUCT ================= */
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [prodRes, simRes] = await Promise.all([
          axios.get(`/api/products/${id}`),
          axios.get(`/api/products/${id}/similar`),
        ]);

        setProduct(prodRes.data);
        setSimilar(simRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  /* ================= ACTIONS ================= */

  const toggleWishlist = async () => {
    try {
      await axios.post(`/api/products/${id}/wishlist`);
      setIsWishlisted(true);
    } catch (err) {
      console.error(err);
    }
  };

  const submitOffer = async () => {
    if (!offerPrice) return;

    try {
      await axios.post(`/api/products/${id}/offers`, {
        price: offerPrice,
      });

      alert("Offer submitted");
      setOfferPrice("");
    } catch (err) {
      console.error(err);
    }
  };

  const startChat = () => {
    navigate(`/chat/${id}`);
  };

  const goSeller = () => {
    if (!product?.user_id) return;
    navigate(`/seller/${product.user_id}`);
  };

  /* ================= LOADING ================= */
  if (loading) return <div className="p-6">Loading...</div>;
  if (!product) return <div className="p-6">Product not found</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-6">

      {/* ================= LEFT: IMAGES ================= */}
      <div className="md:col-span-2 space-y-4">

        <div className="bg-white rounded-xl overflow-hidden shadow">
          <img
            src={product.images?.[0]}
            className="w-full h-96 object-cover"
          />
        </div>

        {/* thumbnails */}
        <div className="flex gap-2 overflow-x-auto">
          {product.images?.map((img, i) => (
            <img
              key={i}
              src={img}
              className="w-20 h-20 object-cover rounded"
            />
          ))}
        </div>

        {/* ================= DESCRIPTION ================= */}
        <div className="bg-white p-4 rounded-xl shadow">
          <h2 className="text-xl font-semibold">Description</h2>
          <p className="mt-2 text-gray-600">{product.description}</p>
        </div>

        {/* ================= FEATURES ================= */}
        <div className="bg-white p-4 rounded-xl shadow">
          <h2 className="text-xl font-semibold">Details</h2>

          <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
            <div>Brand: {product.attributes?.brand}</div>
            <div>Model: {product.attributes?.model}</div>
            <div>Condition: {product.attributes?.condition}</div>
            <div>Year: {product.attributes?.year}</div>
            <div>Storage: {product.attributes?.storage}</div>
            <div>RAM: {product.attributes?.ram}</div>
          </div>
        </div>

        {/* ================= SIMILAR PRODUCTS ================= */}
        <div className="bg-white p-4 rounded-xl shadow">
          <h2 className="text-xl font-semibold mb-3">Similar Products</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {similar.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/products/${item.id}`)}
                className="cursor-pointer border rounded p-2 hover:shadow"
              >
                <img
                  src={item.images?.[0]}
                  className="h-24 w-full object-cover rounded"
                />
                <div className="text-sm mt-1">{item.title}</div>
                <div className="font-semibold">${item.price}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================= RIGHT: BUY BOX ================= */}
      <div className="space-y-4">

        <div className="bg-white p-4 rounded-xl shadow">
          <h1 className="text-2xl font-bold">{product.title}</h1>

          <div className="text-xl font-semibold mt-2">
            ${product.price}
          </div>

          {/* badges */}
          <div className="flex gap-2 mt-2 flex-wrap">
            {product.negotiable && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">
                Negotiable
              </span>
            )}

            {product.delivery?.available && (
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                Delivery Available
              </span>
            )}
          </div>

          <div className="text-sm text-gray-500 mt-2">
            Views: {product.views}
          </div>

          {/* ================= ACTIONS ================= */}
          <div className="mt-4 space-y-2">

            <button
              onClick={toggleWishlist}
              className="w-full border p-2 rounded"
            >
              {isWishlisted ? "♥ Saved" : "♡ Save"}
            </button>

            <button
              onClick={startChat}
              className="w-full bg-blue-600 text-white p-2 rounded"
            >
              Chat with seller
            </button>

            <button
              onClick={goSeller}
              className="w-full border p-2 rounded"
            >
              View Seller Profile
            </button>
          </div>
        </div>

        {/* ================= NEGOTIATION ================= */}
        <div className="bg-white p-4 rounded-xl shadow">
          <h2 className="font-semibold mb-2">Make an Offer</h2>

          <input
            value={offerPrice}
            onChange={(e) => setOfferPrice(e.target.value)}
            placeholder="Enter your price"
            className="w-full border p-2 rounded"
          />

          <button
            onClick={submitOffer}
            className="w-full mt-2 bg-black text-white p-2 rounded"
          >
            Submit Offer
          </button>
        </div>

        {/* ================= CONTACT ================= */}
        <div className="bg-white p-4 rounded-xl shadow text-sm">
          <h2 className="font-semibold mb-2">Contact</h2>
          <div>{product.contact?.phone}</div>
          <div>{product.contact?.email}</div>
        </div>

        {/* ================= DELIVERY ================= */}
        <div className="bg-white p-4 rounded-xl shadow text-sm">
          <h2 className="font-semibold mb-2">Delivery</h2>
          <div>
            {product.delivery?.available
              ? `Available (${product.delivery?.cost || 0})`
              : "Not available"}
          </div>
        </div>
      </div>
    </div>
  );
}
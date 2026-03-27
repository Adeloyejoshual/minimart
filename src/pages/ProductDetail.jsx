import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/ProductDetail.css";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [activeImage, setActiveImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [similar, setSimilar] = useState([]);
  const [saved, setSaved] = useState(false);

  // ---------------- FETCH PRODUCT ----------------
  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(
          `https://minimart-ivrm.onrender.com/api/marketplace/products/${id}`
        );
        const data = await res.json();

        setProduct(data);

        const imgs = data.images || [];
        setActiveImage(imgs[0] || data.image || "");

        // increase view counter (backend should handle increment)
        await fetch(
          `https://minimart-ivrm.onrender.com/api/marketplace/products/${id}/view`,
          { method: "POST" }
        );

        // fetch similar products
        fetchSimilar(data.category_id);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [id]);

  // ---------------- SIMILAR PRODUCTS ----------------
  const fetchSimilar = async (categoryId) => {
    try {
      const res = await fetch(
        `https://minimart-ivrm.onrender.com/api/marketplace/products?category=${categoryId}`
      );
      const data = await res.json();

      setSimilar(data.products?.filter(p => p.id !== id).slice(0, 4) || []);
    } catch (err) {
      console.error(err);
    }
  };

  // ---------------- HELPERS ----------------
  const getLocation = () => {
    if (product?.location_state && product?.location_city) {
      return `${product.location_state}, ${product.location_city}`;
    }
    return "Nigeria";
  };

  const toggleSave = () => {
    const newState = !saved;
    setSaved(newState);

    // optional backend call
    fetch(`https://minimart-ivrm.onrender.com/api/wishlist/${id}`, {
      method: newState ? "POST" : "DELETE",
    });
  };

  const goToSeller = () => {
    navigate(`/seller/${product.seller_id}`);
  };

  const goToChat = () => {
    navigate(`/chat/${product.id}`);
  };

  // ---------------- LOADING ----------------
  if (loading) return <p>Loading product...</p>;
  if (!product) return <p>Product not found</p>;

  const images = product.images || [];

  const isTrending = product.views > 50;

  return (
    <>
      <TopNav />

      <div className="product-detail">

        {/* ================= IMAGES ================= */}
        <div className="image-section">
          <div className="main-image">
            <img
              src={activeImage || "https://via.placeholder.com/400"}
              alt={product.title}
            />

            {isTrending && (
              <span className="badge trending">🔥 Trending</span>
            )}

            <button className="wishlist" onClick={toggleSave}>
              {saved ? "💖 Saved" : "🤍 Save"}
            </button>
          </div>

          <div className="thumbnails">
            {images.map((img, i) => (
              <img
                key={i}
                src={img}
                onClick={() => setActiveImage(img)}
                className={activeImage === img ? "active" : ""}
              />
            ))}
          </div>
        </div>

        {/* ================= DETAILS ================= */}
        <div className="details-section">

          <h1>{product.title}</h1>

          <div className="price">
            ₦{Number(product.price).toLocaleString()}
          </div>

          {/* CATEGORY */}
          <div className="category">
            📦 {product.category_name || "General"}
          </div>

          {/* LOCATION */}
          <div className="location">
            📍 {getLocation()}
          </div>

          {/* VIEWS */}
          <div className="views">
            👁 {product.views || 0} views
          </div>

          {/* DESCRIPTION */}
          <p className="description">
            {product.description || "No description available"}
          </p>

          {/* DELIVERY + NEGOTIATION */}
          <div className="extras">
            <p>🚚 Delivery: {product.delivery || "Not specified"}</p>
            <p>
              💰 Negotiation:{" "}
              {product.negotiable === true
                ? "Yes"
                : product.negotiable === false
                ? "No"
                : "Not sure"}
            </p>
          </div>

          {/* ================= ACTIONS ================= */}
          <div className="actions">

            <button onClick={goToSeller}>
              👤 Seller Profile
            </button>

            <button onClick={goToChat}>
              💬 Chat Seller
            </button>

            {product.contact?.whatsapp && (
              <a
                href={`https://wa.me/${product.contact.whatsapp}`}
                target="_blank"
                rel="noreferrer"
              >
                📲 WhatsApp
              </a>
            )}

          </div>
        </div>

        {/* ================= SIMILAR PRODUCTS ================= */}
        <div className="similar">
          <h3>Similar Products</h3>

          <div className="similar-grid">
            {similar.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/product/${item.id}`)}
              >
                <img src={item.images?.[0]} />
                <p>{item.title}</p>
                <span>₦{item.price}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      <BottomNav />
    </>
  );
}
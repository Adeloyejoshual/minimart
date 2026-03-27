import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/ProductDetail.css";

export default function ProductDetail() {
  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [activeImage, setActiveImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  /* ================= FETCH ================= */
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `https://minimart-ivrm.onrender.com/api/marketplace/products/${id}`
        );
        const data = await res.json();

        setProduct(data);
        setActiveImage(data.images?.[0] || "");

        // CHECK WISHLIST
        const wishlist =
          JSON.parse(localStorage.getItem("wishlist") || "[]");
        setSaved(wishlist.includes(data.id));

        // FETCH SIMILAR
        const res2 = await fetch(
          "https://minimart-ivrm.onrender.com/api/marketplace/products"
        );
        const all = await res2.json();

        const filtered =
          all.products
            ?.filter((p) => p.category_id === data.category_id && p.id !== data.id)
            .slice(0, 6) || [];

        setSimilar(filtered);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  /* ================= HELPERS ================= */
  const toggleWishlist = () => {
    let wishlist = JSON.parse(localStorage.getItem("wishlist") || "[]");

    if (wishlist.includes(product.id)) {
      wishlist = wishlist.filter((x) => x !== product.id);
      setSaved(false);
    } else {
      wishlist.push(product.id);
      setSaved(true);
    }

    localStorage.setItem("wishlist", JSON.stringify(wishlist));
  };

  const getLocation = () => {
    if (product?.location?.state && product?.location?.city) {
      return `${product.location.state}, ${product.location.city}`;
    }
    return "Nigeria";
  };

  const formatKey = (k) =>
    k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const isTrending = (views) => views > 50;

  /* ================= UI ================= */
  if (loading) return <p>Loading...</p>;
  if (!product) return <p>Not found</p>;

  const attributes = product.attributes || {};
  const delivery = product.delivery || {};
  const contact = product.contact || {};

  return (
    <>
      <TopNav />

      <div className="product-detail">

        {/* ❤️ SAVE */}
        <button className="save-btn" onClick={toggleWishlist}>
          {saved ? "❤️ Saved" : "🤍 Save"}
        </button>

        {/* 🔥 TRENDING */}
        {isTrending(product.views) && (
          <div className="badge trending">🔥 Trending</div>
        )}

        {/* IMAGES */}
        <div className="image-section">
          <img src={activeImage} alt="" className="main-img" />

          <div className="thumbs">
            {product.images?.map((img, i) => (
              <img
                key={i}
                src={img}
                onClick={() => setActiveImage(img)}
              />
            ))}
          </div>
        </div>

        {/* DETAILS */}
        <div className="details">

          <h1>{product.title}</h1>

          <div className="price">
            ₦{Number(product.price).toLocaleString()}
          </div>

          {/* CATEGORY AS FEATURE */}
          <div className="category-tag">
            📦 {product.category_name || "Category"}
          </div>

          <div className="location">
            📍 {getLocation()}
          </div>

          {/* 📊 VIEWS */}
          <div className="views">
            👁 {product.views || 0} views
          </div>

          {/* ATTRIBUTES */}
          <div className="attributes">
            {Object.entries(attributes).map(([k, v]) => {
              if (!v) return null;
              return (
                <div key={k}>
                  <strong>{formatKey(k)}:</strong>{" "}
                  {Array.isArray(v) ? v.join(", ") : v}
                </div>
              );
            })}
          </div>

          {/* DESCRIPTION */}
          <div className="description">
            <h3>Description</h3>
            <p>{product.description}</p>
          </div>

          {/* DELIVERY */}
          {delivery.available && (
            <div className="delivery">
              <h3>Delivery</h3>
              <p>Type: {delivery.type}</p>
              {delivery.type === "fixed" && (
                <p>Fee: ₦{delivery.fee}</p>
              )}
              <p>Time: {delivery.estimated_days} days</p>
              {delivery.note && <p>{delivery.note}</p>}
            </div>
          )}

          {/* CONTACT */}
          <div className="contact">
            <h3>Contact</h3>
            {contact.phone && <p>📞 {contact.phone}</p>}
            {contact.whatsapp && <p>💬 {contact.whatsapp}</p>}
          </div>

        </div>

        {/* 🧠 SIMILAR */}
        {similar.length > 0 && (
          <div className="similar">
            <h3>Similar Products</h3>

            <div className="grid">
              {similar.map((p) => (
                <div key={p.id} className="card">
                  <img src={p.images?.[0]} />
                  <p>{p.title}</p>
                  <span>₦{p.price}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <BottomNav />
    </>
  );
}
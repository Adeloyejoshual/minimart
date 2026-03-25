import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/ProductDetail.css";

export default function ProductDetail() {
  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [activeImage, setActiveImage] = useState("");
  const [loading, setLoading] = useState(true);

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

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [id]);

  // ---------------- HELPERS ----------------
  const getLocation = () => {
    if (product?.location_state && product?.location_city) {
      return `${product.location_state}, ${product.location_city}`;
    }
    return "Nigeria";
  };

  // ---------------- LOADING ----------------
  if (loading) {
    return (
      <>
        <TopNav />
        <div className="product-detail">
          <p>Loading product...</p>
        </div>
        <BottomNav />
      </>
    );
  }

  if (!product) return <p>Product not found</p>;

  const images = product.images || [];

  return (
    <>
      <TopNav />

      <div className="product-detail">

        {/* ---------------- IMAGES ---------------- */}
        <div className="image-section">
          <div className="main-image">
            <img
              src={activeImage || "https://via.placeholder.com/400"}
              alt={product.title}
            />
          </div>

          <div className="thumbnails">
            {images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt="thumb"
                onClick={() => setActiveImage(img)}
                className={activeImage === img ? "active" : ""}
              />
            ))}
          </div>
        </div>

        {/* ---------------- DETAILS ---------------- */}
        <div className="details-section">

          <h1 className="title">{product.title}</h1>

          <div className="price">
            ₦{Number(product.price).toLocaleString()}
          </div>

          <div className="location">
            📍 {getLocation()}
          </div>

          <div className="description">
            {product.description || "No description available"}
          </div>

          {/* FUTURE: Seller / Chat */}
          <button className="contact-btn">
            Contact Seller
          </button>

        </div>
      </div>

      <BottomNav />
    </>
  );
}
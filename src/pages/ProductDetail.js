// src/pages/ProductDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, query, collection, where, getDocs } from "firebase/firestore";
import { db, auth } from "../firebase";
import { promotionPlans } from "../config/promotionPlans";
import "./ProductDetail.css";

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [similarProducts, setSimilarProducts] = useState([]);
  const currentUser = auth.currentUser;

  useEffect(() => {
    const loadProduct = async () => {
      const docRef = doc(db, "products", productId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setProduct(data);

        if (data.marketType === "marketplace") {
          const q = query(
            collection(db, "products"),
            where("marketType", "==", "marketplace")
          );
          const snap = await getDocs(q);
          setSimilarProducts(
            snap.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter(p => p.id !== data.id)
              .slice(0, 8)
          );
        }
      } else {
        alert("Product not found");
        navigate("/marketplace");
      }
    };
    loadProduct();
  }, [productId, navigate]);

  if (!product) return <p style={{ textAlign: "center" }}>Loading product...</p>;

  // ---------------- Image Navigation ----------------
  const nextImage = () => {
    if (!product.images?.length) return;
    setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
  };
  const prevImage = () => {
    if (!product.images?.length) return;
    setCurrentImageIndex((prev) =>
      prev === 0 ? product.images.length - 1 : prev - 1
    );
  };

  // ---------------- Quick Message ----------------
  const handleQuickMessage = () => {
    if (!currentUser) return alert("Login required");
    if (currentUser.uid === product.ownerId) return;
    navigate(
      `/chat/${product.ownerId}?product=${productId}&productName=${encodeURIComponent(
        product.name
      )}`
    );
  };

  // ---------------- Format Date ----------------
  const formatDate = (timestamp) => {
    if (!timestamp?.seconds) return "N/A";
    return new Date(timestamp.seconds * 1000).toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ---------------- Average Rating ----------------
  const averageRating = product.comments?.length
    ? product.comments.reduce((acc, c) => acc + (c.rating || 0), 0) /
      product.comments.length
    : 0;

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (rating >= i) stars.push(<span key={i}>★</span>);
      else if (rating + 0.5 >= i) stars.push(<span key={i}>☆</span>); // half star
      else stars.push(<span key={i} style={{ color: "#ccc" }}>★</span>);
    }
    return stars;
  };

  // ---------------- Seller Info ----------------
  const sellerYears = product.ownerSince
    ? Math.floor((Date.now() - product.ownerSince.toDate()) / (1000 * 60 * 60 * 24 * 365))
    : 0;
  const sellerVerified = product.ownerVerified;

  return (
    <div className="product-detail-container">
      {/* Product Card */}
      <div className="product-card">
        {product.images?.length > 0 && (
          <>
            <img src={product.images[currentImageIndex]} alt={product.name} />
            {product.images.length > 1 && (
              <>
                <button className="img-nav-btn left" onClick={prevImage}>◀</button>
                <button className="img-nav-btn right" onClick={nextImage}>▶</button>
                <div className="image-counter">
                  {currentImageIndex + 1}/{product.images.length}
                </div>
              </>
            )}
          </>
        )}

        <div className="product-title">
          {product.name}
          {product.sold && <span className="sold-badge">SOLD</span>}
        </div>

        {product.promotion?.label && (
          <div className="promo-badge">{product.promotion.label}</div>
        )}

        <div className="product-price">₦{product.price.toLocaleString()}</div>
        <div className="product-description">{product.description}</div>
        <div className="product-meta">
          Category: <b>{product.category}</b> | Market: <b>{product.marketType}</b>
        </div>
        <div className="product-date">Posted: {formatDate(product.createdAt)}</div>

        {product.marketType === "marketplace" && currentUser?.uid !== product.ownerId && (
          <button className="quick-message-btn" onClick={handleQuickMessage}>
            💬 Is it available?
          </button>
        )}
      </div>

      {/* Seller Info */}
      <div className="seller-card">
        <strong>Seller</strong>
        <p>{product.ownerName}</p>
        <p>Years Active: {sellerYears > 5 ? "+5 years" : sellerYears}</p>
        {sellerVerified && <span className="verified-badge">Verified</span>}
        <p>{product.ownerAdsCount || 0} ads</p>
      </div>

      {/* Rating & Reviews */}
      {product.marketType === "marketplace" && (
        <div className="comments-section">
          <h3>Reviews & Ratings</h3>
          <div className="product-rating">
            {renderStars(averageRating)}{" "}
            <span>({product.comments?.length || 0} reviews)</span>
          </div>

          {product.comments?.length > 0 ? (
            product.comments.map((c, i) => (
              <div key={i} className="comment-box">
                <div className="user-name">{c.userName}</div>
                <p>{c.comment}</p>
                <p>Rating: {c.rating} ⭐</p>
              </div>
            ))
          ) : (
            <p>No comments yet.</p>
          )}
        </div>
      )}

      {/* Similar Products */}
      {similarProducts.length > 0 && (
        <div className="similar-products">
          <h3>Similar Products</h3>
          <div className="similar-products-list">
            {similarProducts.map((p) => (
              <div
                key={p.id}
                className="similar-product-card"
                onClick={() => navigate(`/product/${p.id}`)}
              >
                <img src={p.images?.[0]} alt={p.name} />
                {p.sold && <div className="sold-badge">SOLD</div>}
                {p.promotion?.label && <div className="promo-badge">{p.promotion.label}</div>}
                {p.images?.length > 1 && (
                  <div className="image-counter">
                    1/{p.images.length}
                  </div>
                )}
                <div className="card-info">
                  <div className="card-title">{p.name}</div>
                  <div className="card-price">₦{p.price.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { promotionPlans } from "../config/promotionPlans";
import "./ProductDetail.css";

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  const [product, setProduct] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [imageIndex, setImageIndex] = useState(0);

  /* ---------------- Load Product ---------------- */
  useEffect(() => {
    const loadProduct = async () => {
      try {
        const snap = await getDoc(doc(db, "products", productId));
        if (!snap.exists()) return navigate(-1);

        const data = { id: snap.id, ...snap.data() };

        if (data.isPromoted && data.promotionPlanId) {
          data.promotion = promotionPlans.find(p => p.id === data.promotionPlanId);
        }

        setProduct(data);
      } catch (err) {
        console.error(err);
      }
    };

    loadProduct();
  }, [productId, navigate]);

  /* ---------------- Similar Products ---------------- */
  useEffect(() => {
    if (!product?.mainCategory) return;

    const loadSimilar = async () => {
      const q = query(
        collection(db, "products"),
        where("mainCategory", "==", product.mainCategory)
      );
      const snap = await getDocs(q);

      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.id !== product.id)
        .slice(0, 10);

      setSimilarProducts(list);
    };

    loadSimilar();
  }, [product]);

  /* ---------------- Comments ---------------- */
  useEffect(() => {
    if (!product) return;

    const loadComments = async () => {
      const q = query(collection(db, "comments"), where("productId", "==", product.id));
      const snap = await getDocs(q);
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };

    loadComments();
  }, [product]);

  /* ---------------- Helpers ---------------- */
  const images = useMemo(() => {
    if (!product) return [];
    return product.images?.length ? product.images : [product.coverImage].filter(Boolean);
  }, [product]);

  const avgRating = useMemo(() => {
    if (!comments.length) return 0;
    return comments.reduce((a, b) => a + (b.rating || 0), 0) / comments.length;
  }, [comments]);

  const formatStars = rating => {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(5 - full - (half ? 1 : 0));
  };

  /* ---------------- Actions ---------------- */
  const startChat = () => {
    if (!currentUser || currentUser.uid === product.ownerId) return;
    navigate(`/chat/${product.ownerId}?product=${productId}`);
  };

  const quickMessage = () => {
    if (!currentUser) return alert("Login required");
    navigate(`/chat/${product.ownerId}?product=${productId}&quick=1`);
  };

  const shareProduct = async () => {
    try {
      await navigator.share({
        title: product.title,
        text: "Check out this product",
        url: window.location.href,
      });
    } catch {
      await navigator.clipboard.writeText(window.location.href);
      alert("Product link copied");
    }
  };

  const submitComment = async () => {
    if (!newComment.trim() || !currentUser) return;

    const review = {
      productId: product.id,
      userId: currentUser.uid,
      userName: currentUser.displayName || "User",
      text: newComment,
      rating: newRating,
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, "comments"), review);

    setComments(prev => [...prev, { ...review, id: Date.now() }]);
    setNewComment("");
    setNewRating(5);
  };

  if (!product) return <p className="loading">Loading product...</p>;

  /* ---------------- UI ---------------- */
  return (
    <div className="product-detail-page">

      {/* Header */}
      <div className="sticky-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <span className="header-title">{product.title}</span>
        <button className="share-btn" onClick={shareProduct}>Share</button>
      </div>

      <div className="scrollable-content">

        {/* Product Card */}
        <div className="product-card">
          <div className="product-images">
            {images.length > 0 && <img src={images[imageIndex]} alt={product.title} />}
            {images.length > 1 && (
              <span className="image-counter">{imageIndex + 1}/{images.length}</span>
            )}
            {product.promotion && (
              <span className="promo-badge">{product.promotion.icon} {product.promotion.label}</span>
            )}
            {product.sold && <span className="sold-badge">SOLD</span>}
          </div>

          <h2 className="product-title">{product.title}</h2>
          <p className="product-price">₦{product.price?.toLocaleString()}</p>
          <p className="product-meta">{product.mainCategory} / {product.subCategory}</p>
          <p className="product-meta">📍 {product.state}, {product.city}</p>
          <p className="product-meta">📞 {product.phone || "Not provided"}</p>

          {product.marketType === "marketplace" && currentUser?.uid !== product.ownerId && (
            <div className="product-actions">
              <button className="chat-btn" onClick={startChat}>Chat Seller</button>
              <button className="quick-msg-btn" onClick={quickMessage}>Is it available?</button>
              <p className="seller-reply-hint">Seller typically replies within minutes</p>
            </div>
          )}
        </div>

        {/* Rating */}
        <div className="rating-summary">
          <h3>{formatStars(avgRating)} ({comments.length} reviews)</h3>
        </div>

        {/* Seller */}
        <div className="seller-card">
          <strong>{product.ownerName}</strong> {product.ownerVerified && "✔"}
          <p>Ads posted: {product.totalAds || 0}</p>
          <p>Years active: {product.yearsActive > 5 ? "+5 years" : product.yearsActive || 1}</p>
        </div>

        {/* Reviews */}
        <div className="comments-section">
          <h3>Reviews</h3>
          {comments.map(c => (
            <div key={c.id} className="comment-box">
              <strong>{c.userName}</strong>
              <span>{formatStars(c.rating)}</span>
              <p>{c.text}</p>
            </div>
          ))}

          {currentUser && (
            <div className="new-comment">
              <textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Write a review..."
              />
              <input
                type="number"
                min="1"
                max="5"
                value={newRating}
                onChange={e => setNewRating(Number(e.target.value))}
              />
              <button onClick={submitComment}>Post Review</button>
            </div>
          )}
        </div>

        {/* RELATED PRODUCTS — LAST */}
        {similarProducts.length > 0 && (
          <div className="related-products">
            <h3>Related Products</h3>
            <div className="related-products-list">
              {similarProducts.map(p => (
                <div
                  key={p.id}
                  className="related-product-card"
                  onClick={() => navigate(`/product/${p.id}`)}
                >
                  <img src={p.coverImage} alt={p.title} />
                  <div className="card-info">
                    <p className="card-title">{p.title}</p>
                    <p className="card-price">₦{p.price?.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Sticky Bottom Chat */}
      {product.marketType === "marketplace" && currentUser?.uid !== product.ownerId && (
        <div className="sticky-chat-bar">
          <button onClick={startChat}>Chat Seller</button>
          <button onClick={quickMessage}>Quick Message</button>
        </div>
      )}
    </div>
  );
}
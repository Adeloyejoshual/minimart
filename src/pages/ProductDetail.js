// src/pages/ProductDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "../firebase";
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
  const [hasNewMessages, setHasNewMessages] = useState(false); // placeholder

  // ---------------- Load product ----------------
  useEffect(() => {
    const loadProduct = async () => {
      const docRef = doc(db, "products", productId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProduct({ id: docSnap.id, ...docSnap.data() });
      } else {
        alert("Product not found");
        navigate("/minimart");
      }
    };
    loadProduct();
  }, [productId, navigate]);

  // ---------------- Load similar products ----------------
  useEffect(() => {
    if (!product) return;
    const loadSimilar = async () => {
      const q = query(
        collection(db, "products"),
        where("mainCategory", "==", product.mainCategory),
        where("id", "!=", product.id)
      );
      const snap = await getDocs(q);
      setSimilarProducts(
        snap.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, 10)
      );
    };
    loadSimilar();
  }, [product]);

  // ---------------- Load comments ----------------
  useEffect(() => {
    if (!product) return;
    const loadComments = async () => {
      const q = query(collection(db, "comments"), where("productId", "==", product.id));
      const snap = await getDocs(q);
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    loadComments();
  }, [product]);

  if (!product) return <p style={{ textAlign: "center" }}>Loading product...</p>;

  const handleStartChat = () => {
    if (!currentUser || currentUser.uid === product.ownerId) return;
    navigate(`/chat/${product.ownerId}?product=${productId}&productName=${encodeURIComponent(product.title)}`);
  };

  const handleQuickMessage = () => {
    if (!currentUser) return alert("Login to send message");
    navigate(`/chat/${product.ownerId}?product=${productId}&productName=${encodeURIComponent(product.title)}&quick=1`);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product.title,
        text: `Check out this product: ${product.title}`,
        url: window.location.href,
      }).catch(err => console.log(err));
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
    }
  };

  const handleCommentSubmit = async () => {
    if (!newComment) return alert("Enter a comment");
    // save comment to firestore (omitted)
    setComments(prev => [
      ...prev,
      { userName: currentUser.displayName, text: newComment, rating: newRating },
    ]);
    setNewComment("");
    setNewRating(5);
  };

  const formatStars = rating => {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(5 - full - (half ? 1 : 0));
  };

  return (
    <div className="product-detail-container">

      {/* ---------------- Product Card ---------------- */}
      <div className="product-card">

        <div className="product-card-header">
          <h2 className="product-title">
            {product.title} {product.sold && <span className="sold-badge">SOLD</span>}
          </h2>
          <button className="share-btn" onClick={handleShare}>🔗 Share</button>
        </div>

        <div className="product-images">
          <img src={product.images[imageIndex] || product.coverImage} alt={product.title} />
          {product.images.length > 1 && (
            <span className="image-counter">{imageIndex + 1}/{product.images.length}</span>
          )}
        </div>

        <p className="product-price">
          ₦{product.price.toLocaleString()}
          {product.isPromoted && <span className="promo-badge">{product.promotion?.label}</span>}
        </p>

        <p className="product-meta">
          Category: <b>{product.mainCategory} / {product.subCategory}</b> | Market: <b>{product.marketType}</b>
        </p>

        <p className="product-meta">📞 {product.phone || "Not provided"}</p>

        {product.marketType === "marketplace" && currentUser?.uid !== product.ownerId && (
          <div className="product-actions">
            <button className="chat-btn" onClick={handleStartChat}>
              💬 Chat Seller
              {hasNewMessages && <span className="chat-badge">●</span>}
            </button>
            <button className="quick-msg-btn" onClick={handleQuickMessage}>
              ⚡ Is it available?
            </button>
            <p className="seller-reply-hint">Typically replies in a few mins</p>
          </div>
        )}

      </div>

      {/* ---------------- Seller Card ---------------- */}
      <div className="seller-card">
        <strong>{product.ownerName}</strong> {product.ownerVerified && "✅"}<br/>
        📞 {product.phone || "Not provided"}<br/>
        Years active: {product.yearsActive > 5 ? "+5 years" : product.yearsActive}<br/>
        Ads posted: {product.totalAds || 0}<br/>
        Avg rating: {product.avgRating?.toFixed(1) || 0} ⭐<br/>
        Least comments: {product.totalComments || 0}<br/>
        Safety tips: Always meet in public<br/>
        {currentUser?.uid === product.ownerId && <button className="btn">Post a Product</button>}
      </div>

      {/* ---------------- Rating / Comments ---------------- */}
      <div className="comments-section">
        <h3>Reviews ({comments.length})</h3>

        {comments.map(c => (
          <div key={c.id} className="comment-box">
            <span className="user-name">{c.userName}</span> - <span className="comment-rating">{formatStars(c.rating)}</span>
            <p>{c.text}</p>
          </div>
        ))}

        {currentUser && (
          <div className="new-comment">
            <textarea placeholder="Write a comment..." value={newComment} onChange={e => setNewComment(e.target.value)} />
            <input type="number" min={1} max={5} value={newRating} onChange={e => setNewRating(Number(e.target.value))} />
            <button onClick={handleCommentSubmit}>Post</button>
          </div>
        )}
      </div>

      {/* ---------------- Similar Products ---------------- */}
      {similarProducts.length > 0 && (
        <div className="similar-products">
          <h3>Similar Products</h3>
          <div className="similar-products-list">
            {similarProducts.map(p => (
              <div key={p.id} className="similar-product-card" onClick={() => navigate(`/product/${p.id}`)}>
                <img src={p.coverImage} alt={p.title} />
                {p.isPromoted && <span className="promo-badge">{p.promotion?.label}</span>}
                {p.sold && <span className="sold-badge">SOLD</span>}
                <div className="card-info">
                  <p className="card-title">{p.title}</p>
                  <p className="card-price">₦{p.price.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- Sticky Chat Bar ---------------- */}
      {product.marketType === "marketplace" && currentUser?.uid !== product.ownerId && (
        <div className="sticky-chat-bar">
          <button className="chat-btn" onClick={handleStartChat}>
            💬 Chat Seller {hasNewMessages && <span className="chat-badge">●</span>}
          </button>
          <button className="quick-msg-btn" onClick={handleQuickMessage}>⚡ Quick Msg</button>
          <button className="share-btn" onClick={handleShare}>🔗 Share</button>
        </div>
      )}

    </div>
  );
}
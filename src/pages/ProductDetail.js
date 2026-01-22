// src/pages/ProductDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, query, collection, where, getDocs } from "firebase/firestore";
import { db, auth } from "../firebase";
import StarRating from "../components/StarRating";

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState({ text: "", rating: 0 });
  const [averageRating, setAverageRating] = useState(0);
  const [similarProducts, setSimilarProducts] = useState([]);
  const currentUser = auth.currentUser;

  // ---------------- Load Product ----------------
  useEffect(() => {
    const loadProduct = async () => {
      const docRef = doc(db, "products", productId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setProduct(data);
        setComments(data.comments || []);
      } else {
        alert("Product not found");
        navigate("/marketplace");
      }
    };
    loadProduct();
  }, [productId, navigate]);

  // ---------------- Calculate Average Rating ----------------
  useEffect(() => {
    if (comments.length === 0) return setAverageRating(0);
    const total = comments.reduce((sum, c) => sum + c.rating, 0);
    setAverageRating((total / comments.length).toFixed(1));
  }, [comments]);

  // ---------------- Load Similar Products ----------------
  useEffect(() => {
    if (!product || product.marketType !== "marketplace") return;

    const loadSimilar = async () => {
      const q = query(
        collection(db, "products"),
        where("mainCategory", "==", product.mainCategory),
        where("id", "!=", product.id)
      );
      const snap = await getDocs(q);
      setSimilarProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, 10));
    };
    loadSimilar();
  }, [product]);

  if (!product) return <p style={{ textAlign: "center" }}>Loading product...</p>;

  // ---------------- Handlers ----------------
  const handleStartChat = () => {
    if (!currentUser || currentUser.uid === product.ownerId) return;
    navigate(
      `/chat/${product.ownerId}?product=${product.id}&productName=${encodeURIComponent(
        product.name
      )}`
    );
  };

  const handleAddComment = () => {
    if (!newComment.text || newComment.rating === 0) {
      return alert("Please add a comment and rating");
    }
    const comment = {
      userId: currentUser.uid,
      userName: currentUser.displayName || "Anonymous",
      text: newComment.text,
      rating: newComment.rating,
      createdAt: new Date(),
    };
    setComments(prev => [comment, ...prev]);
    setNewComment({ text: "", rating: 0 });
    // TODO: save comment to Firestore
  };

  const formatDate = timestamp => {
    if (!timestamp?.seconds) return "N/A";
    return new Date(timestamp.seconds * 1000).toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ---------------- JSX ----------------
  return (
    <div style={{ maxWidth: 600, margin: "20px auto", padding: 16 }}>
      {/* Product Card */}
      <div className="card">
        <div style={{ position: "relative" }}>
          <img
            src={product.images[0]}
            alt={product.name}
            style={{ width: "100%", height: 300, objectFit: "cover", borderRadius: 10 }}
          />
          <span
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              padding: "2px 6px",
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            {product.images.length}/8
          </span>
        </div>

        <h2 style={{ margin: "8px 0" }}>
          {product.name}{" "}
          {product.sold && <span className="sold-badge">(SOLD)</span>}
        </h2>

        {product.promotion?.label && (
          <div className="promo-badge">{product.promotion.label}</div>
        )}

        <p style={{ fontSize: 20, fontWeight: "bold", color: "#0D6EFD" }}>
          ₦{product.price.toLocaleString()}
        </p>

        <div style={{ marginTop: 8 }}>
          <strong>Category:</strong> {product.category} |{" "}
          <strong>Market:</strong> {product.marketType}
        </div>

        <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>
          Posted: {formatDate(product.postedAt)}
        </div>

        <div style={{ fontSize: 14, marginTop: 4 }}>
          📞 {product.phone} | 💬 Is it available?
        </div>
      </div>

      {/* Average Rating */}
      <div className="card">
        <h3>Average Rating</h3>
        <StarRating value={averageRating} readOnly />
        <span style={{ marginLeft: 8 }}>
          {averageRating} / 5 ({comments.length} reviews)
        </span>
      </div>

      {/* Seller Card */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>{product.ownerName}</strong>
          {product.ownerVerified && <span className="verified-badge">✔ Verified</span>}
        </div>
        <div>📞 {product.ownerPhone}</div>
        <div>
          Years active: {product.ownerYearsActive > 5 ? "+5 years" : product.ownerYearsActive}
        </div>
        <div>Ads posted: {product.ownerAdsCount || 0}</div>
        <div>
          Seller rating: <StarRating value={product.ownerAvgRating || 0} readOnly />
          <span style={{ marginLeft: 6 }}>{product.ownerAvgRating?.toFixed(1) || 0} ({product.ownerReviewsCount || 0})</span>
        </div>
        <div>Least comments: {product.ownerLeastComments || 0}</div>
        <div>Safety tip: Always meet in public places and check the product before paying.</div>
        {currentUser && currentUser.uid === product.ownerId && (
          <button onClick={() => navigate("/add-product")}>Post a product</button>
        )}
      </div>

      {/* Start Chat */}
      {currentUser?.uid !== product.ownerId && (
        <button className="btn" onClick={handleStartChat}>💬 Start Chat</button>
      )}

      {/* Comments Section */}
      <div className="card">
        <h3>Comments</h3>

        {/* New Comment */}
        {currentUser && (
          <div style={{ marginBottom: 12 }}>
            <textarea
              placeholder="Write a comment..."
              value={newComment.text}
              onChange={e => setNewComment(prev => ({ ...prev, text: e.target.value }))}
            />
            <StarRating
              value={newComment.rating}
              onChange={rating => setNewComment(prev => ({ ...prev, rating }))}
            />
            <button onClick={handleAddComment}>Post Comment</button>
          </div>
        )}

        {/* Existing Comments */}
        {comments.map((c, i) => (
          <div key={i} className="comment">
            <strong>{c.userName}</strong>
            <StarRating value={c.rating} readOnly />
            <p>{c.text}</p>
          </div>
        ))}
      </div>

      {/* Similar Products */}
      {similarProducts.length > 0 && (
        <div className="card">
          <h3>Similar Products</h3>
          <div className="similar-products-scroll">
            {similarProducts.map(p => (
              <div key={p.id} className="similar-product-card" onClick={() => navigate(`/product/${p.id}`)}>
                <img src={p.images[0]} alt={p.name} />
                <div>{p.name}</div>
                <div>₦{p.price.toLocaleString()}</div>
                {p.promotion?.label && <div className="promo-badge-small">{p.promotion.label}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
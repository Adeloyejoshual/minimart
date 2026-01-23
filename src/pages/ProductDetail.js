import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "../firebase";
import { promotionPlans } from "../config/promotionPlans";
import "./ProductDetail.css";

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [seller, setSeller] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const currentUser = auth.currentUser;

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const docRef = doc(db, "products", productId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          alert("Product not found");
          return navigate(-1);
        }
        const data = { id: docSnap.id, ...docSnap.data() };
        setProduct(data);

        // Load seller info
        const ownerSnap = await getDoc(doc(db, "users", data.ownerId));
        if (ownerSnap.exists()) setSeller({ id: ownerSnap.id, ...ownerSnap.data() });

        // Load similar products
        const q = query(
          collection(db, "products"),
          where("mainCategory", "==", data.mainCategory)
        );
        const simSnap = await getDocs(q);
        setSimilarProducts(simSnap.docs.filter(d => d.id !== data.id).map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      }
    };
    loadProduct();
  }, [productId, navigate]);

  if (!product) return <p style={{ textAlign: "center" }}>Loading product...</p>;

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

  const handleChat = () => {
    if (!currentUser) return alert("Login required to chat");
    if (currentUser.uid === product.ownerId) return;
    navigate(`/chat/${product.ownerId}?product=${product.id}&productName=${encodeURIComponent(product.title)}`);
  };

  const handleCall = () => {
    if (!product.phone) return alert("Phone not available");
    window.open(`tel:${product.phone}`);
  };

  const getPromotionBadge = () => {
    if (!product.isPromoted || !product.promotion) return null;
    const plan = promotionPlans.find(p => p.id === product.promotion.id);
    if (!plan) return null;
    return plan.icon + " " + plan.label;
  };

  const renderSpecs = () => {
    if (!product.specs) return null;
    return (
      <div className="product-specs-card">
        <h3>Specifications</h3>
        <table className="specs-table">
          <tbody>
            {Object.entries(product.specs).map(([key, value]) => (
              <tr key={key}>
                <td className="spec-key">{key.replace(/([A-Z])/g, " $1")}</td>
                <td className="spec-value">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="product-detail-page">
      {/* Fixed Header */}
      <div className="product-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <span className="header-title">{product.title}</span>
      </div>

      {/* Scrollable Content */}
      <div className="product-detail-scroll">
        {/* Share Button */}
        <button className="share-btn" onClick={() => navigator.share ? navigator.share({ title: product.title, url: window.location.href }) : alert("Share not supported")}>
          🔗 Share
        </button>

        {/* Product Card */}
        <div className="product-card">
          <div className="image-container">
            <img src={product.coverImage} alt={product.title} />
            {getPromotionBadge() && <span className="promo-badge">{getPromotionBadge()}</span>}
            {product.sold && <span className="sold-badge">SOLD</span>}
            {product.images?.length > 1 && (
              <span className="image-counter">{`1/${product.images.length}`}</span>
            )}
          </div>

          <h2 className="product-title">{product.title}</h2>
          <p className="product-price">₦{product.price.toLocaleString()}</p>
          <p className="product-meta">
            Category: <b>{product.mainCategory} / {product.subCategory}</b> | Market: <b>{product.marketType}</b> | Location: <b>{product.state}, {product.city}</b>
          </p>

          {product.phone && (
            <button className="quick-message-btn" onClick={handleCall}>
              📞 Call Seller
            </button>
          )}

          <button className="quick-message-btn" onClick={handleChat}>
            💬 Chat (Seller typically replies in a few mins)
          </button>

          <p className="product-description">{product.description}</p>

          {/* Specs */}
          {renderSpecs()}
        </div>

        {/* Seller Card */}
        {seller && (
          <div className="seller-card">
            <strong>{seller.name} {seller.verified && "✔️"}</strong>
            <p>Phone: {seller.phone || "N/A"}</p>
            <p>Years Active: {seller.yearsActive > 5 ? "+5 years" : seller.yearsActive + " years"}</p>
            <p>Number of Ads: {seller.totalAds || 0}</p>
            <p>Average Rating: {seller.avgRating || 0} ⭐</p>
            <p>Least Comments: {seller.totalComments || 0}</p>
            <p>Safety Tips: Avoid paying in advance, meet in public, inspect item before payment</p>
            {currentUser?.uid === seller.id && (
              <button className="quick-message-btn" onClick={() => navigate("/add-product")}>
                ➕ Post a Product
              </button>
            )}
          </div>
        )}

        {/* Similar Products */}
        {similarProducts.length > 0 && (
          <div className="similar-products">
            <h3>Similar Products</h3>
            <div className="similar-products-list">
              {similarProducts.map(prod => (
                <div key={prod.id} className="similar-product-card" onClick={() => navigate(`/product/${prod.id}`)}>
                  <img src={prod.coverImage} alt={prod.title} />
                  {prod.isPromoted && <span className="promo-badge">{promotionPlans.find(p => p.id === prod.promotion?.id)?.icon}</span>}
                  {prod.sold && <span className="sold-badge">SOLD</span>}
                  <div className="card-info">
                    <p className="card-title">{prod.title}</p>
                    <p className="card-price">₦{prod.price.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating Chat Bar */}
      {currentUser?.uid !== product.ownerId && (
        <div className="floating-chat-bar" onClick={handleChat}>
          💬 Chat with Seller
        </div>
      )}
    </div>
  );
}
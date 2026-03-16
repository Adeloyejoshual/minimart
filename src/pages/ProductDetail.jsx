// src/pages/ProductDetail.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import InfiniteScroll from "react-infinite-scroll-component";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/ProductDetail.css";

const API_BASE = "https://minimart-ivrm.onrender.com/api/marketplace";

export default function ProductDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [similarSkip, setSimilarSkip] = useState(0);
  const [hasMoreSimilar, setHasMoreSimilar] = useState(true);
  const [loading, setLoading] = useState(false);

  const LIMIT = 12;

  // Load product details
  const loadProduct = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/products/${id}`);
      setProduct(data);
    } catch (err) {
      console.error(err);
    }
  }, [id]);

  // Load similar products
  const loadSimilar = useCallback(async () => {
    if (!hasMoreSimilar) return;
    try {
      const { data } = await axios.get(`${API_BASE}/products`, {
        params: { skip: similarSkip, limit: LIMIT, exclude: id }
      });
      const products = data.products || data;
      setSimilarProducts(prev => [...prev, ...products]);
      setSimilarSkip(prev => prev + products.length);
      setHasMoreSimilar(products.length === LIMIT);
    } catch (err) {
      console.error("Similar products load failed", err);
    }
  }, [similarSkip, hasMoreSimilar, id]);

  useEffect(() => {
    loadProduct();
    setSimilarProducts([]);
    setSimilarSkip(0);
    setHasMoreSimilar(true);
  }, [id]);

  useEffect(() => {
    if (product) loadSimilar();
  }, [product, loadSimilar]);

  const handleBack = () => navigate(-1); // Go back to previous page
  const handleShare = () => navigator.clipboard.writeText(window.location.href);

  if (!product) return <div className="loading-page">Loading product...</div>;

  return (
    <div className="product-detail-page">
      <TopNav user={user} />

      {/* Header */}
      <div className="product-header">
        <button className="back-btn" onClick={handleBack}>← Back</button>
        <button className="share-btn" onClick={handleShare}>Share</button>
      </div>

      {/* Product Info */}
      <section className="product-main">
        <div className="product-image">
          <img src={product.image || "/placeholder.png"} alt={product.title} />
        </div>
        <div className="product-info">
          <h1>{product.title}</h1>
          <span className="product-price">₦{product.price?.toLocaleString()}</span>
          <p>{product.description}</p>

          {/* Seller Info */}
          {product.seller && (
            <div className="seller-info" onClick={() => navigate(`/seller/${product.seller.id}`)}>
              <img src={product.seller.avatar || "/placeholder.png"} alt={product.seller.name} className="seller-avatar"/>
              <div className="seller-details">
                <h4>{product.seller.name}</h4>
                <span>{product.seller.adsCount} active products</span>
                <span>{product.seller.isLive ? "Live Now" : "Offline"}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="product-actions">
            <button className="report-btn">Report</button>
            <button className="negotiate-btn">Negotiate</button>
            <button className="buy-btn">Buy Now</button>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="product-reviews">
        <h2>Reviews</h2>
        <div className="reviews-empty">No reviews yet</div>
      </section>

      {/* Similar Products */}
      <section className="similar-products">
        <h2>Similar Products</h2>
        <InfiniteScroll
          dataLength={similarProducts.length}
          next={loadSimilar}
          hasMore={hasMoreSimilar}
          loader={<div className="loader">Loading more...</div>}
          className="similar-grid-scroll"
        >
          <div className="similar-grid">
            {similarProducts.map(p => (
              <div key={p.id} className="similar-card" onClick={() => navigate(`/product/${p.id}`)}>
                <img src={p.image || "/placeholder.png"} alt={p.title} />
                <h4>{p.title}</h4>
                <span>₦{p.price?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </InfiniteScroll>
      </section>

      <BottomNav />
    </div>
  );
}
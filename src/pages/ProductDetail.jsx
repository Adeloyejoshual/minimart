// src/pages/ProductDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import TrendingCarousel from "../components/TrendingCarousel";
import { fetchProductById, fetchTrending } from "../services/api";
import "../styles/Homepage.css";

export default function ProductDetail() {
  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProduct();
    loadTrending();
  }, [id]);

  const loadProduct = async () => {
    try {
      const data = await fetchProductById(id);
      setProduct(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadTrending = async () => {
    try {
      const data = await fetchTrending();
      setTrending(data);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="enterprise-loader">Loading product...</div>;
  }

  if (!product) {
    return (
      <div className="enterprise-empty-state">
        <div className="empty-icon">📦</div>
        <h3>Product Not Found</h3>
      </div>
    );
  }

  return (
    <div className="enterprise-homepage">
      <TopNav />

      <section className="product-detail-section">
        <div className="product-detail-wrapper">
          <div className="product-image-container">
            {product.image ? (
              <img src={product.image} alt={product.title} />
            ) : (
              <div className="image-placeholder">📷</div>
            )}
          </div>

          <div className="product-detail-info">
            <h1 className="card-title">{product.title}</h1>
            <p className="card-description">{product.description}</p>

            <span className="price">
              ₦{product.price?.toLocaleString()}
            </span>

            <button className="buy-btn">
              Buy Now
            </button>
          </div>
        </div>
      </section>

      <TrendingCarousel
        trending={trending}
        onProductClick={(id) => (window.location.href = `/product/${id}`)}
      />

      <BottomNav />
    </div>
  );
}
// src/pages/Homepage.jsx - ENTERPRISE SPLIT-CARD v1.0
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

const API_BASE = "https://minimart-ivrm.onrender.com/api/marketplace";
const REQUEST_TIMEOUT = 10000;
const MAX_LOAD_LIMIT = 50;

axios.defaults.timeout = REQUEST_TIMEOUT;

export default function Homepage({ user }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const lastScrollY = useRef(0);
  const skipRef = useRef(0);
  const [showTopNav, setShowTopNav] = useState(true);
  const [showBottomNav, setShowBottomNav] = useState(true);

  const LIMIT = 20;
  const endpoints = useMemo(() => ({ products: `${API_BASE}/products` }), []);

  const getProductId = useCallback((product) => product.id || product._id, []);

  // ---------------- LOAD PRODUCTS ----------------
  const loadProducts = useCallback(async (reset = false) => {
    if (loading || products.length >= MAX_LOAD_LIMIT) return;
    try {
      setLoading(true);
      const skip = reset ? 0 : skipRef.current;
      const { data } = await axios.get(endpoints.products, { params: { skip, limit: LIMIT } });
      const productData = Array.isArray(data) ? data : data.products || [];

      if (reset) {
        setProducts(productData);
        skipRef.current = productData.length;
      } else {
        setProducts(prev => [...prev, ...productData].slice(0, MAX_LOAD_LIMIT));
        skipRef.current += productData.length;
      }
    } catch (err) {
      console.error("Load products error:", err);
    } finally {
      setLoading(false);
    }
  }, [endpoints.products, loading, products.length]);

  useEffect(() => { loadProducts(true); }, [loadProducts]);

  // ---------------- SCROLL NAV ----------------
  useEffect(() => {
    const handleScrollNav = () => {
      const scrollY = window.scrollY;
      if (scrollY > lastScrollY.current && scrollY > 100) {
        setShowTopNav(false);
        setShowBottomNav(false);
      } else {
        setShowTopNav(true);
        setShowBottomNav(true);
      }
      lastScrollY.current = scrollY;
    };
    window.addEventListener("scroll", handleScrollNav);
    return () => window.removeEventListener("scroll", handleScrollNav);
  }, []);

  // ---------------- INFINITE SCROLL ----------------
  useEffect(() => {
    const handleScrollLoad = () => {
      if (!loading && products.length < MAX_LOAD_LIMIT) {
        const scrollY = window.scrollY;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        if (scrollY + windowHeight >= documentHeight - 150) loadProducts(false);
      }
    };
    window.addEventListener("scroll", handleScrollLoad);
    return () => window.removeEventListener("scroll", handleScrollLoad);
  }, [loading, products.length, loadProducts]);

  const handleProductClick = useCallback((product) => {
    const id = getProductId(product);
    navigate(`/product/${id}`);
  }, [navigate, getProductId]);

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount || 0);
  }, []);

  return (
    <div className="homepage-container">
      <TopNav user={user} className={`fixed-top-nav ${showTopNav ? 'visible' : 'hidden'}`} />

      <header className="hero-section">
        <h1>MiniMart Marketplace</h1>
        <p>Discover Amazing Products</p>
      </header>

      <main className="products-grid split-card-grid">
        {products.map(product => (
          <SplitProductCard
            key={getProductId(product)}
            product={product}
            onClick={() => handleProductClick(product)}
            formatCurrency={formatCurrency}
          />
        ))}
        {loading && [...Array(6)].map((_, i) => <SkeletonSplitCard key={i} />)}
      </main>

      <BottomNav className={`fixed-bottom-nav ${showBottomNav ? 'visible' : 'hidden'}`} />
    </div>
  );
}

// ---------------- SPLIT PRODUCT CARD ----------------
function SplitProductCard({ product, onClick, formatCurrency }) {
  const image = (product.images && product.images.length ? product.images[0] : null) || '/placeholder-product.png';
  return (
    <article className="split-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="split-info">
        <h3>{product.title || "Untitled"}</h3>
        <p className="description">{product.description || ""}</p>
        {product.dynamic_fields?.location && <p className="location">{product.dynamic_fields.location}</p>}
        <p className="price">{formatCurrency(product.price)}</p>
      </div>
      <div className="split-image">
        <img src={image} alt={product.title || "Product"} loading="lazy" />
      </div>
    </article>
  );
}

// ---------------- SKELETON ----------------
function SkeletonSplitCard() {
  return (
    <div className="split-card skeleton">
      <div className="split-info">
        <div className="title" />
        <div className="description" />
        <div className="location" />
        <div className="price" />
      </div>
      <div className="split-image" />
    </div>
  );
}
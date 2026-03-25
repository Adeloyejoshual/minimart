// src/pages/Homepage.jsx - ENTERPRISE GRID v4.0
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

const API_BASE = "https://minimart-ivrm.onrender.com/api/marketplace";
const LIMIT = 20;
const MAX_LOAD = 60;

export default function Homepage({ user }) {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const skipRef = useRef(0);
  const lastScrollY = useRef(0);

  const [showTopNav, setShowTopNav] = useState(true);
  const [showBottomNav, setShowBottomNav] = useState(true);

  const endpoint = useMemo(() => `${API_BASE}/products`, []);

  const getId = (p) => p.id || p._id;

  // ================= LOAD PRODUCTS =================
  const loadProducts = useCallback(async (reset = false) => {
    if (loading || products.length >= MAX_LOAD) return;

    try {
      setLoading(true);

      const skip = reset ? 0 : skipRef.current;

      const { data } = await axios.get(endpoint, {
        params: { skip, limit: LIMIT },
      });

      const list = Array.isArray(data) ? data : data.products || [];

      if (reset) {
        setProducts(list);
        skipRef.current = list.length;
      } else {
        setProducts(prev => [...prev, ...list].slice(0, MAX_LOAD));
        skipRef.current += list.length;
      }
    } catch (err) {
      console.error("Load error:", err);
    } finally {
      setLoading(false);
    }
  }, [endpoint, loading, products.length]);

  useEffect(() => {
    loadProducts(true);
  }, [loadProducts]);

  // ================= NAV SCROLL =================
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;

      if (y > lastScrollY.current && y > 100) {
        setShowTopNav(false);
        setShowBottomNav(false);
      } else {
        setShowTopNav(true);
        setShowBottomNav(true);
      }

      lastScrollY.current = y;
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ================= INFINITE SCROLL =================
  useEffect(() => {
    const handleLoad = () => {
      if (loading || products.length >= MAX_LOAD) return;

      const scrollBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 120;

      if (scrollBottom) loadProducts(false);
    };

    window.addEventListener("scroll", handleLoad);
    return () => window.removeEventListener("scroll", handleLoad);
  }, [loading, products.length, loadProducts]);

  // ================= NAVIGATE =================
  const openProduct = (product) => {
    navigate(`/product/${getId(product)}`);
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount || 0);

  return (
    <div className="homepage">
      <TopNav className={showTopNav ? "show" : "hide"} user={user} />

      <header className="hero">
        <h1>MiniMart</h1>
        <p>Discover amazing products</p>
      </header>

      {/* ================= GRID ================= */}
      <section className="products-grid">
        {products.map((p) => (
          <ProductCard
            key={getId(p)}
            product={p}
            onClick={() => openProduct(p)}
            formatCurrency={formatCurrency}
          />
        ))}

        {loading && <SkeletonCards />}
      </section>

      <BottomNav className={showBottomNav ? "show" : "hide"} />
    </div>
  );
}

// ================= PRODUCT CARD =================
function ProductCard({ product, onClick, formatCurrency }) {
  let images = product.images;

  // FIX: parse if stored as string
  if (typeof images === "string") {
    try {
      images = JSON.parse(images);
    } catch {
      images = [];
    }
  }

  const image =
    (images && images.length ? images[0] : null) ||
    "/placeholder-product.png";

  return (
    <article className="card" onClick={onClick}>
      {/* IMAGE */}
      <div className="card-image">
        <img src={image} alt={product.title || "Product"} />
      </div>

      {/* CONTENT */}
      <div className="card-body">
        <p className="price">
          {formatCurrency(product.price)}
        </p>

        <h3 className="title">
          {product.title || "Untitled"}
        </h3>

        <div className="meta">
          <p className="desc">
            {product.description?.slice(0, 40) || ""}
          </p>

          {product.dynamic_fields?.location && (
            <span className="location">
              📍 {product.dynamic_fields.location}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

// ================= SKELETON =================
function SkeletonCards() {
  return (
    <>
      {[...Array(8)].map((_, i) => (
        <div key={i} className="card skeleton">
          <div className="card-image"></div>
          <div className="card-body">
            <div className="line short"></div>
            <div className="line"></div>
            <div className="line small"></div>
          </div>
        </div>
      ))}
    </>
  );
}
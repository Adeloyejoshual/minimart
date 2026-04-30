import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";

import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

export default function Homepage({ user }) {
  const navigate = useNavigate();
  const { products, setProducts, loaded, setLoaded } = useProductCache();

  const [sections, setSections] = useState({
    recommended: [],
    cheapDeals: [],
    trending: [],
    latest: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [cheapVisible, setCheapVisible] = useState(8);

  const API_BASE = "https://minimart-ivrm.onrender.com/api";

  // ✅ Ranking logic
  const categorizeProducts = useCallback((allProducts) => {
    const withMetrics = allProducts.map((p) => ({
      ...p,
      views: Number(p.views || 0),
      clicks: Number(p.clicks_count || 0),
      price: Number(p.price || 0),
      postedAt: p.createdAt || new Date().toISOString(),
    }));

    const score = (p) => {
      const recencyBoost =
        Date.now() - new Date(p.postedAt) < 7 * 24 * 60 * 60 * 1000
          ? 50
          : 0;

      return (
        (p.views || 0) +
        (p.clicks || 0) * 3 +
        recencyBoost +
        (p.promotion_priority || 0) * 10
      );
    };

    const sorted = [...withMetrics].sort((a, b) => score(b) - score(a));

    return {
      recommended: sorted.slice(0, 12),
      cheapDeals: sorted.filter((p) => p.price <= 20000),
      trending: sorted.filter((p) => p.views > 10).slice(0, 15),
      latest: sorted.slice(0, 24),
    };
  }, []);

  // ✅ FETCH DATA
  useEffect(() => {
    if (loaded && products.length > 0) {
      setSections(categorizeProducts(products));
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);

      try {
        const res = await fetch(`${API_BASE}/homepage`);
        if (!res.ok) throw new Error("Failed to load homepage");

        const data = await res.json();

        const allProducts = [
          ...(data.recommended || []),
          ...(data.cheapDeals || []),
          ...(data.trending || []),
          ...(data.latest || []),
        ].filter((p, i, self) => i === self.findIndex((t) => t.id === p.id));

        setProducts(allProducts);
        setSections(data);
        setLoaded(true);
      } catch (err) {
        console.error("Homepage error:", err);

        if (products.length > 0) {
          setSections(categorizeProducts(products));
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [loaded, products, categorizeProducts]);

  // ✅ IMAGE SAFE EXTRACTOR (IMPORTANT)
  const getImage = (product) => {
    if (!product?.images) return null;

    if (Array.isArray(product.images)) {
      const first = product.images[0];
      return typeof first === "string" ? first : first?.url;
    }

    return null;
  };

  // ✅ RENDER SECTION
  const renderSection = (title, items, horizontal = false) => {
    if (isLoading) {
      return <p className="loading">Loading {title}...</p>;
    }

    if (!items?.length) {
      return (
        <section>
          <h2>{title}</h2>
          <p>No products yet</p>
        </section>
      );
    }

    return (
      <section>
        <h2>{title}</h2>

        <div className={horizontal ? "scroll" : "grid"}>
          {(horizontal ? items : items.slice(0, cheapVisible)).map((p) => (
            <div
              key={p.id}
              className="card"
              onClick={() => navigate(`/product/${p.slug}`)}
            >
              <img
                src={
                  getImage(p) ||
                  "https://via.placeholder.com/300x300?text=No+Image"
                }
                alt={p.title}
                loading="lazy"
              />

              <h3>{p.title}</h3>
              <p>₦{Number(p.price).toLocaleString()}</p>
              <span>{p.location?.city || "Nationwide"}</span>
            </div>
          ))}
        </div>

        {title.includes("Cheap") && cheapVisible < items.length && (
          <button onClick={() => setCheapVisible((v) => v + 8)}>
            Load More
          </button>
        )}
      </section>
    );
  };

  // ✅ LOADER
  if (!loaded && !user) {
    return <div className="loader">Loading Minimart...</div>;
  }

  return (
    <>
      <TopNav />

      <div className="container">
        {renderSection("🎯 Recommended", sections.recommended, true)}
        {renderSection("💸 Cheap Deals", sections.cheapDeals)}
        {renderSection("🔥 Trending", sections.trending, true)}
        {renderSection("🆕 Latest", sections.latest)}
      </div>

      <button
        className="floating-btn"
        onClick={() => navigate("/minimart/add")}
      >
        + Sell
      </button>

      <BottomNav />
    </>
  );
}
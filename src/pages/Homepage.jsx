import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

const API_BASE = "https://minimart-ivrm.onrender.com/api";

export default function Homepage() {
  const navigate = useNavigate();

  const [sections, setSections] = useState({
    recommended: [],
    cheapDeals: [],
    trending: [],
    latest: [],
  });

  const [loading, setLoading] = useState(true);
  const [bannerIndex, setBannerIndex] = useState(0);

  // 🔥 Fetch homepage (single API)
  useEffect(() => {
    const fetchHomepage = async () => {
      try {
        const res = await fetch(`${API_BASE}/homepage`);
        const data = await res.json();

        setSections({
          recommended: data.recommended || [],
          cheapDeals: data.cheapDeals || [],
          trending: data.trending || [],
          latest: data.latest || [],
        });
      } catch (err) {
        console.error("Homepage error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHomepage();
  }, []);

  // 🔁 Banner rotation
  const banners = [
    { text: "🔥 Hot Deals Under ₦10,000", link: "/search?price_max=10000" },
    { text: "⚡ Flash Sale - Up to 50% OFF", link: "/search?promoted=true" },
    { text: "💸 Cheapest Prices Today", link: "/search?sort=price" },
    { text: "🛍️ Mega Sale Live!", link: "/search" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setBannerIndex((i) => (i + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // 🔥 Components

  const ProductCard = ({ p }) => (
    <div
      className="card"
      onClick={() => navigate(`/product/${p.slug}`)}
    >
      <img
        src={p.images?.[0] || "https://via.placeholder.com/300"}
        alt={p.title}
      />
      <h3>{p.title}</h3>
      <p className="price">₦{Number(p.price || 0).toLocaleString()}</p>
      <p className="location">
        {p.location?.city || "Nationwide"}
      </p>
    </div>
  );

  const Section = ({ title, items }) => (
    <section>
      <h2>{title}</h2>

      {loading ? (
        <div className="grid">
          {Array(6)
            .fill()
            .map((_, i) => (
              <div key={i} className="skeleton"></div>
            ))}
        </div>
      ) : items.length === 0 ? (
        <p className="empty">No items</p>
      ) : (
        <div className="grid">
          {items.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <>
      <TopNav />

      <div className="homepage">

        {/* 🔥 Banner */}
        <div
          className="banner"
          onClick={() => navigate(banners[bannerIndex].link)}
        >
          {banners[bannerIndex].text}
        </div>

        {/* 🔥 Sections */}
        <Section title="🎯 Recommended" items={sections.recommended} />
        <Section title="💸 Cheap Deals" items={sections.cheapDeals} />
        <Section title="🔥 Trending" items={sections.trending} />
        <Section title="🆕 Latest" items={sections.latest} />

      </div>

      {/* ➕ Floating Sell Button */}
      <button
        className="sell-btn"
        onClick={() => navigate("/minimart/add")}
      >
        + Sell
      </button>

      <BottomNav />
    </>
  );
}
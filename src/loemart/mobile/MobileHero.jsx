/**
 * src/loemart/mobile/MobileHero.jsx
 * 10/10 Premium Hero Banner & Quick Actions
 */
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FiArrowRight, 
  FiZap, 
  FiStar, 
  FiTrendingUp, 
  FiPlusCircle, 
  FiTag, 
  FiShoppingBag 
} from "react-icons/fi";
import { haptic } from "./mobileHelpers";

// Import styles
import "./styles/MobileHero.css";

const DEFAULT_SLIDES = [
  {
    id: "curated-1",
    badge: "Official Marketplace",
    title: "Trade & Discover Premium Goods",
    sub: "Direct peer-to-peer verification and rapid local delivery.",
    cta: "Explore Catalog",
    bgClass: "hero-bg-blue",
    target: "catalog",
    Icon: FiShoppingBag,
  },
  {
    id: "curated-2",
    badge: "Verified Sellers",
    title: "Turn Your Items Into Real Cash",
    sub: "List in 60 seconds with zero upfront listing fees.",
    cta: "Start Selling",
    bgClass: "hero-bg-green",
    target: "sell",
    Icon: FiTag,
  },
  {
    id: "curated-3",
    badge: "Limited Drops",
    title: "Daily Flash Deals & Clearance",
    sub: "Up to 40% off authenticated electronics and apparel.",
    cta: "View Deals",
    bgClass: "hero-bg-orange",
    target: "deals",
    Icon: FiZap,
  },
];

const SLIDE_INTERVAL = 5500;

const MobileHero = memo(function MobileHero({ user, onPostAd, slides = DEFAULT_SLIDES }) {
  const navigate = useNavigate();
  const [slideIndex, setSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef(null);

  const firstName = user?.name ? user.name.trim().split(" ")[0] : null;
  const currentSlide = slides[slideIndex] || slides[0];
  const CurrentIcon = currentSlide.Icon;

  const nextSlide = useCallback(() => {
    setSlideIndex((p) => (p + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setSlideIndex((p) => (p - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(nextSlide, SLIDE_INTERVAL);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide]);

  const handleTouchStart = (e) => {
    setIsPaused(true);
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    setIsPaused(false);
    if (!touchStartX.current) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      diff > 0 ? nextSlide() : prevSlide();
      haptic(8);
    }
    touchStartX.current = null;
  };

  const handleSlideAction = (target) => {
    haptic(10);
    if (target === "sell") return onPostAd();
    document.querySelector(".lmm-catalog-grid-segment")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const quickTiles = [
    { id: "flash", Icon: FiZap, label: "Flash Deals", color: "#ff6b00", bg: "#fff4eb" },
    { id: "new", Icon: FiStar, label: "New Arrivals", color: "#10b981", bg: "#ecfdf5" },
    { id: "trending", Icon: FiTrendingUp, label: "Trending", color: "#6366f1", bg: "#eef2ff" },
    { id: "sell", Icon: FiPlusCircle, label: "List Item", color: "#2563eb", bg: "#eff6ff", action: onPostAd },
  ];

  return (
    <div className="lmm-hero-container">
      
      {/* Floating Welcome Pill */}
      {user && firstName && (
        <div 
          className="lmm-welcome-pill" 
          onClick={() => navigate("/account/profile")}
          role="button"
          tabIndex={0}
        >
          <div className="lmm-welcome-avatar">
            {firstName.charAt(0).toUpperCase()}
          </div>
          <span className="lmm-welcome-text">
            Hi, <strong>{firstName}</strong>
          </span>
          <FiArrowRight size={14} color="#666" style={{ marginLeft: "auto" }} />
        </div>
      )}

      {/* Main Hero Card */}
      <section
        className={`lmm-hero-card ${currentSlide.bgClass}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="lmm-hero-content">
          <div className="lmm-hero-eyebrow">
            {CurrentIcon && <CurrentIcon size={14} strokeWidth={2.5} />}
            <span>{currentSlide.badge}</span>
          </div>

          <h1 className="lmm-hero-title">{currentSlide.title}</h1>
          <p className="lmm-hero-subtitle">{currentSlide.sub}</p>

          <button 
            type="button" 
            className="lmm-hero-cta" 
            onClick={() => handleSlideAction(currentSlide.target)}
          >
            {currentSlide.cta}
            <div className="lmm-hero-cta-icon">
              <FiArrowRight size={14} strokeWidth={3} />
            </div>
          </button>
        </div>

        {/* Animated Pagination */}
        <div className="lmm-hero-pagination" aria-label="Slide indicators">
          {slides.map((_, idx) => (
            <div 
              key={idx} 
              className={`lmm-hero-dot ${idx === slideIndex ? "active" : ""}`} 
            />
          ))}
        </div>
      </section>

      {/* Quick Action Tiles */}
      <nav className="lmm-quick-actions" aria-label="Quick Actions">
        {quickTiles.map((tile) => (
          <button 
            key={tile.id} 
            type="button"
            className="lmm-quick-tile" 
            onClick={() => { 
              haptic(6); 
              if (tile.action) {
                tile.action();
              } else {
                document.querySelector(".lmm-catalog-grid-segment")?.scrollIntoView({ behavior: "smooth" });
              }
            }}
          >
            <div 
              className="lmm-quick-tile__icon" 
              style={{ backgroundColor: tile.bg, color: tile.color }}
            >
              <tile.Icon size={20} strokeWidth={2.2} />
            </div>
            <span className="lmm-quick-tile__label">{tile.label}</span>
          </button>
        ))}
      </nav>

    </div>
  );
});

export default MobileHero;
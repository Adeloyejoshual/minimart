import React, { useEffect, useState, useRef } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { FaStore, FaShoppingCart, FaUser } from "react-icons/fa";

import TopNav from "../components/TopNav";
import { promotionPlans } from "../config/promotionPlans";
import "./MiniMart.css";

export default function MiniMart() {
  const navigate = useNavigate();

  const [allProducts, setAllProducts] = useState([]);
  const [displayProducts, setDisplayProducts] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [columns, setColumns] = useState(2);
  const [isDragging, setIsDragging] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [timers, setTimers] = useState({}); // Track flash sale countdowns

  const promoPlanIds = promotionPlans.map(p => p.id);
  const sliderRef = useRef(null);

  // --------------------- Helpers ---------------------
  const getPromotionPlan = id => promotionPlans.find(p => p.id === id);
  const shuffleArray = arr => [...arr].sort(() => Math.random() - 0.5);
  const truncateTitle = title => {
    if (!title) return "";
    const maxWords = 6;
    const maxChars = 40;
    let t = title.split(" ").slice(0, maxWords).join(" ");
    if (t.length > maxChars) t = t.slice(0, maxChars) + "...";
    return t;
  };

  const calculateAIScore = product => {
    const views = product.views || 0;
    const clicks = product.clicks || 0;
    const searches = product.searchHits || 0;
    const plan = getPromotionPlan(product.promotionPlan);
    const promotionBoost = plan ? plan.priority * 40 : 0;
    const createdAt = product.createdAt?.toMillis ? product.createdAt.toMillis() : Date.now();
    const daysOld = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
    const freshnessBoost = Math.max(20 - daysOld, 0);
    return views * 3 + clicks * 2 + searches + promotionBoost + freshnessBoost;
  };

  // --------------------- Load Products ---------------------
  useEffect(() => {
    const loadProducts = async () => {
      const snap = await getDocs(query(
        collection(db, "products"),
        where("marketType", "==", "minimart"),
        orderBy("createdAt", "desc")
      ));
      const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllProducts(products);

      // Trending
      const scored = products.map(p => ({ ...p, trendingScore: calculateAIScore(p) }));
      setTrendingProducts(scored.sort((a,b) => b.trendingScore - a.trendingScore).slice(0, 8));

      // Display products with promoted first
      const promoted = products.filter(p => promoPlanIds.includes(p.promotionPlan));
      const promotedIds = new Set(promoted.map(p => p.id));
      const regular = products.filter(p => !promotedIds.has(p.id));
      setDisplayProducts([...promoted.slice(0,5), ...shuffleArray(regular)]);

      // Initialize flash sale timers
      const flashTimers = {};
      products.forEach(p => {
        if (p.flashSaleEnd) {
          const end = p.flashSaleEnd.toDate ? p.flashSaleEnd.toDate() : new Date(p.flashSaleEnd);
          const diff = Math.max(end - new Date(), 0);
          flashTimers[p.id] = diff;
        }
      });
      setTimers(flashTimers);
    };

    loadProducts();
    loadCartAndMessages();
  }, []);

  // --------------------- Flash Sale Countdown ---------------------
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const updated = {};
        for (let key in prev) {
          updated[key] = Math.max(prev[key] - 1000, 0);
        }
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = ms => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  // --------------------- Swipeable Trending ---------------------
  const handlers = useSwipeable({
    onSwipedLeft: () => setCurrentSlide(p => (p + 1) % trendingProducts.length),
    onSwipedRight: () => setCurrentSlide(p => (p === 0 ? trendingProducts.length - 1 : p -1)),
    onSwipeStart: () => setIsDragging(true),
    onSwipeEnd: () => setIsDragging(false),
    trackMouse: true
  });

  useEffect(() => {
    if (isDragging || trendingProducts.length === 0) return;
    const interval = setInterval(() => setCurrentSlide(p => (p + 1) % trendingProducts.length), 4000);
    return () => clearInterval(interval);
  }, [isDragging, trendingProducts]);

  // --------------------- Responsive Columns ---------------------
  useEffect(() => {
    const updateColumns = () => {
      const w = window.innerWidth;
      setColumns(w < 500 ? 2 : w < 900 ? 3 : 4);
    };
    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  // --------------------- Load Cart & Messages ---------------------
  const loadCartAndMessages = () => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    getDocs(query(collection(db, "carts"), where("userId","==",uid)))
      .then(snap => setCartCount(snap.docs.length));

    getDocs(query(collection(db,"messages"), where("toUser","==",uid), where("read","==",false)))
      .then(snap => setUnreadMessages(snap.docs.length));
  };

  const bottomLinks = [
    { path: "/", label: "Home", icon: <FaStore />, badge: 0 },
    { path: "/minimart", label: "MiniMart", icon: <FaStore />, badge: 0 },
    { path: "/cart", label: "Cart", icon: <FaShoppingCart />, badge: cartCount },
    { path: "/profile", label: "Account", icon: <FaUser />, badge: unreadMessages },
  ];

  return (
    <div className="minimart-page">
      <div className="minimart-topnav">
        <TopNav />
      </div>

      {trendingProducts.length > 0 && (
        <section className="minimart-trending" {...handlers}>
          <h2>🔥 Trending</h2>
          <div className="trending-slider">
            {trendingProducts.map(p => (
              <div key={p.id} className="product-card trending" onClick={() => navigate(`/product/${p.id}`)}>
                <img src={p.images?.[0] || "/placeholder.png"} alt={p.title} />
                <div className="product-info">
                  <p className="title">{truncateTitle(p.title)}</p>
                  <p className="price">₦{Number(p.price).toLocaleString()}</p>
                  {p.discount && <span className="discount">-{p.discount}%</span>}
                  {p.soldCount && <span className="sold">{p.soldCount} Sold</span>}
                  {p.stock && p.stock < 10 && <span className="limited-stock">Limited Stock</span>}
                  {p.flashSaleEnd && timers[p.id] > 0 && (
                    <span className="flash-sale">🔥 {formatTime(timers[p.id])}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="minimart-products">
        {displayProducts.map(p => (
          <div key={p.id} className="product-card" onClick={() => navigate(`/product/${p.id}`)}>
            <img src={p.images?.[0] || "/placeholder.png"} alt={p.title} />
            <div className="product-info">
              <p className="title">{truncateTitle(p.title)}</p>
              <p className="price">₦{Number(p.price).toLocaleString()}</p>
              {p.discount && <span className="discount">-{p.discount}%</span>}
              {p.rating && <span className="rating">⭐ {p.rating.toFixed(1)}</span>}
              {p.soldCount && <span className="sold">{p.soldCount} Sold</span>}
              {p.stock && p.stock < 10 && <span className="limited-stock">Limited Stock</span>}
              {p.flashSaleEnd && timers[p.id] > 0 && (
                <span className="flash-sale">🔥 {formatTime(timers[p.id])}</span>
              )}
            </div>
          </div>
        ))}
      </section>

      <div className="minimart-bottom-nav">
        {bottomLinks.map(link => (
          <div key={link.path} onClick={() => navigate(link.path)} className="bottom-link">
            <div className="icon">{link.icon}</div>
            <div className="label">{link.label}</div>
            {link.badge > 0 && <span className="badge">{link.badge}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
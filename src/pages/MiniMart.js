// src/pages/MiniMart.jsx
import React, { useEffect, useState, useRef } from "react";
import { collection, getDocs, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { FaStore, FaShoppingCart, FaUser } from "react-icons/fa";

import TopNav from "../components/TopNav";
import { promotionPlans } from "../config/promotionPlans";
import "./MiniMart.css";

export default function MiniMart() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [displayProducts, setDisplayProducts] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const sliderRef = useRef(null);
  const promoPlanIds = promotionPlans.map(p => p.id);

  // ---------------- Helpers ----------------
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

  // Calculate final price
  const getFinalPrice = product => {
    if (product.flashSalePrice) return product.flashSalePrice;
    if (product.discount) return Math.round(product.price * (1 - product.discount / 100));
    return product.price || 0;
  };

  const getDiscountPercent = product => {
    if (product.flashSalePrice) return Math.round(100 - (product.flashSalePrice / product.price) * 100);
    return product.discount || 0;
  };

  // AI Trending Score
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

  // ---------------- Load Products ----------------
  useEffect(() => {
    const productsQuery = query(
      collection(db, "products"),
      where("marketType", "==", "minimart"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(productsQuery, snapshot => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(prods);

      const scored = prods.map(p => ({ ...p, trendingScore: calculateAIScore(p) }));
      setTrendingProducts(scored.sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 8));

      const promoted = prods.filter(p => promoPlanIds.includes(p.promotionPlan));
      const promotedIds = new Set(promoted.map(p => p.id));
      const regular = prods.filter(p => !promotedIds.has(p.id));
      setDisplayProducts([...promoted.slice(0, 5), ...shuffleArray(regular)]);
    });

    return () => unsubscribe();
  }, []);

  // ---------------- Swipeable Trending ----------------
  const handlers = useSwipeable({
    onSwipedLeft: () => setCurrentSlide(p => (p + 1) % trendingProducts.length),
    onSwipedRight: () => setCurrentSlide(p => (p === 0 ? trendingProducts.length - 1 : p - 1)),
    onSwipeStart: () => setIsDragging(true),
    onSwipeEnd: () => setIsDragging(false),
    trackMouse: true
  });

  useEffect(() => {
    if (isDragging || trendingProducts.length === 0) return;
    const interval = setInterval(() => setCurrentSlide(p => (p + 1) % trendingProducts.length), 4000);
    return () => clearInterval(interval);
  }, [isDragging, trendingProducts]);

  // ---------------- Cart & Messages ----------------
  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const cartQuery = query(collection(db, "carts"), where("userId", "==", uid));
    const cartUnsub = onSnapshot(cartQuery, snap => setCartCount(snap.docs.length));

    const msgQuery = query(collection(db, "messages"), where("toUser", "==", uid), where("read", "==", false));
    const msgUnsub = onSnapshot(msgQuery, snap => setUnreadMessages(snap.docs.length));

    return () => {
      cartUnsub();
      msgUnsub();
    };
  }, []);

  // ---------------- Flash Sale Timer ----------------
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getRemainingTime = end => {
    if (!end) return null;
    const diff = end.toMillis ? end.toMillis() - now : new Date(end).getTime() - now;
    if (diff <= 0) return "00:00:00";
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  };

  const bottomLinks = [
    { path: "/", label: "Home", icon: <FaStore />, badge: 0 },
    { path: "/minimart", label: "MiniMart", icon: <FaStore />, badge: 0 },
    { path: "/cart", label: "Cart", icon: <FaShoppingCart />, badge: cartCount },
    { path: "/profile", label: "Account", icon: <FaUser />, badge: unreadMessages },
  ];

  const renderFlashSale = end => {
    const remaining = getRemainingTime(end);
    return remaining !== "00:00:00" ? `🔥 ${remaining}` : null;
  };

  return (
    <div className="minimart-page">
      {/* TopNav */}
      <div className="minimart-topnav"><TopNav /></div>

      {/* Trending */}
      {trendingProducts.length > 0 && (
        <section className="minimart-trending" {...handlers}>
          <h2>🔥 Trending</h2>
          <div className="trending-slider">
            {trendingProducts.map(p => (
              <div key={p.id} className="product-card trending" onClick={() => navigate(`/product/${p.id}`)}>
                <img src={p.images?.[0] || "/placeholder.png"} alt={p.title} />
                <div className="product-info">
                  <p className="title">{truncateTitle(p.title)}</p>
                  {getDiscountPercent(p) > 0 && <span className="off-badge">-{getDiscountPercent(p)}% OFF</span>}
                  <p className="price">
                    {getDiscountPercent(p) > 0 && <span className="original-price">₦{Number(p.price).toLocaleString()}</span>}
                    ₦{Number(getFinalPrice(p)).toLocaleString()}
                  </p>
                  {p.rating && <span className="rating">⭐ {p.rating.toFixed(1)}</span>}
                  {p.soldCount && <span className="sold">{p.soldCount} Sold</span>}
                  {p.stock && p.stock < 10 && <span className="limited-stock">Limited Stock</span>}
                  {p.flashSaleEnd && <span className="flash-sale">{renderFlashSale(p.flashSaleEnd)}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Product Feed */}
      <section className="minimart-products">
        {displayProducts.map(p => (
          <div key={p.id} className="product-card" onClick={() => navigate(`/product/${p.id}`)}>
            <img src={p.images?.[0] || "/placeholder.png"} alt={p.title} />
            <div className="product-info">
              <p className="title">{truncateTitle(p.title)}</p>
              {getDiscountPercent(p) > 0 && <span className="off-badge">-{getDiscountPercent(p)}% OFF</span>}
              <p className="price">
                {getDiscountPercent(p) > 0 && <span className="original-price">₦{Number(p.price).toLocaleString()}</span>}
                ₦{Number(getFinalPrice(p)).toLocaleString()}
              </p>
              {p.rating && <span className="rating">⭐ {p.rating.toFixed(1)}</span>}
              {p.soldCount && <span className="sold">{p.soldCount} Sold</span>}
              {p.stock && p.stock < 10 && <span className="limited-stock">Limited Stock</span>}
              {p.flashSaleEnd && <span className="flash-sale">{renderFlashSale(p.flashSaleEnd)}</span>}
            </div>
          </div>
        ))}
      </section>

      {/* Bottom Navigation */}
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
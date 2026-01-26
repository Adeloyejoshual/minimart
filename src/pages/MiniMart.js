// src/pages/MiniMart.jsx
import React, { useEffect, useState, useRef } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { FaStore, FaShoppingCart, FaUser } from "react-icons/fa";
import TopNav from "../components/TopNav";
import { promotionPlans } from "../config/promotionPlans";

export default function MiniMart() {
  const navigate = useNavigate();
  const [allProducts, setAllProducts] = useState([]);
  const [displayProducts, setDisplayProducts] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const sliderRef = useRef(null);
  const scrollRef = useRef(null);
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

  const getFlashTime = endTime => {
    const diff = new Date(endTime).getTime() - Date.now();
    if (diff <= 0) return "Ended";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  // ---------------- Load Products ----------------
  useEffect(() => {
    const loadProducts = async () => {
      const snap = await getDocs(query(
        collection(db, "products"),
        where("marketType", "==", "minimart"),
        orderBy("createdAt", "desc")
      ));
      const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllProducts(products);

      const scored = products.map(p => ({ ...p, trendingScore: calculateAIScore(p) }));
      setTrendingProducts(scored.sort((a,b)=>b.trendingScore - a.trendingScore).slice(0,8));

      const promoted = products.filter(p => promoPlanIds.includes(p.promotionPlan));
      const promotedIds = new Set(promoted.map(p=>p.id));
      const regular = products.filter(p => !promotedIds.has(p.id));
      setDisplayProducts([...promoted.slice(0,5), ...shuffleArray(regular)]);
    };

    loadProducts();
    loadCartAndMessages();
  }, []);

  // ---------------- Load Cart & Messages ----------------
  const loadCartAndMessages = () => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    getDocs(query(collection(db,"carts"), where("userId","==",uid)))
      .then(snap => setCartCount(snap.docs.length));
    getDocs(query(collection(db,"messages"), where("toUser","==",uid), where("read","==",false)))
      .then(snap => setUnreadMessages(snap.docs.length));
  };

  // ---------------- Smooth Trending Scroll ----------------
  useEffect(() => {
    if (!scrollRef.current) return;
    let scrollX = 0;
    const speed = 0.5; // pixels per frame
    const slider = scrollRef.current;

    const animate = () => {
      if (slider.scrollWidth <= slider.clientWidth) return;
      scrollX += speed;
      if (scrollX >= slider.scrollWidth / 2) scrollX = 0; // loop
      slider.scrollLeft = scrollX;
      requestAnimationFrame(animate);
    };
    animate();
  }, [trendingProducts]);

  const bottomLinks = [
    { path: "/", label: "Home", icon: <FaStore />, badge: 0 },
    { path: "/minimart", label: "MiniMart", icon: <FaStore />, badge: 0 },
    { path: "/cart", label: "Cart", icon: <FaShoppingCart />, badge: cartCount },
    { path: "/profile", label: "Account", icon: <FaUser />, badge: unreadMessages },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh", background:"#f5f7fb" }}>
      {/* TopNav */}
      <div style={{ position:"relative", zIndex:1000 }}>
        <TopNav />
      </div>

      {/* Trending */}
      {trendingProducts.length > 0 && (
        <section style={{ marginTop:10, padding:"0 16px" }}>
          <h2 style={{ fontSize:18, marginBottom:12 }}>🔥 Trending</h2>
          <div ref={scrollRef} style={{ display:"flex", gap:12, overflow:"hidden", whiteSpace:"nowrap" }}>
            {[...trendingProducts, ...trendingProducts].map((p, idx) => (
              <div key={idx} onClick={()=>navigate(`/product/${p.id}`)}
                   style={{
                     display:"inline-block",
                     minWidth:160,
                     background:"#e6f0ff",
                     borderRadius:14,
                     overflow:"hidden",
                     cursor:"pointer",
                     boxShadow:"0 3px 8px rgba(0,0,0,0.05)",
                     position:"relative",
                     flexShrink:0
                   }}>
                <img src={p.images?.[0]||"/placeholder.png"} alt={p.title}
                     style={{ width:"100%", height:150, objectFit:"cover" }} />
                <div style={{ padding:8 }}>
                  <p style={{ fontWeight:600, fontSize:14, margin:0 }}>{truncateTitle(p.title)}</p>
                  <p style={{ color:"#198754", fontWeight:"bold", margin:"4px 0" }}>₦{Number(p.price).toLocaleString()}</p>
                  {p.discount && <span style={{
                    position:"absolute", top:8, left:8,
                    background:"#ff4d4f", color:"#fff", fontSize:11,
                    padding:"2px 6px", borderRadius:12, fontWeight:"bold"
                  }}>-{p.discount}%</span>}
                  {p.soldCount && <span style={{ fontSize:11, color:"#6c757d" }}>{p.soldCount} Sold</span>}
                  {p.stock && p.stock<10 && <span style={{ fontSize:11, color:"#ff4d4f", fontWeight:"bold" }}>Limited Stock</span>}
                  {p.flashSaleEnd && <span style={{ fontSize:11, color:"#ffa500", fontWeight:"bold" }}>🔥 {getFlashTime(p.flashSaleEnd)}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Product Feed */}
      <section style={{
        display:"grid",
        gap:12,
        padding:"10px 16px",
        gridTemplateColumns:"repeat(auto-fill, minmax(160px,1fr))"
      }}>
        {displayProducts.map(p => (
          <div key={p.id} onClick={()=>navigate(`/product/${p.id}`)}
               style={{
                 background:"#e6f0ff",
                 borderRadius:14,
                 overflow:"hidden",
                 cursor:"pointer",
                 position:"relative",
                 boxShadow:"0 3px 8px rgba(0,0,0,0.05)"
               }}>
            <img src={p.images?.[0]||"/placeholder.png"} alt={p.title} style={{ width:"100%", height:180, objectFit:"cover" }} />
            <div style={{ padding:8 }}>
              <p style={{ fontWeight:600, margin:0 }}>{truncateTitle(p.title)}</p>
              <p style={{ color:"#198754", fontWeight:"bold" }}>₦{Number(p.price).toLocaleString()}</p>
              {p.discount && <span style={{
                position:"absolute", top:8, left:8,
                background:"#ff4d4f", color:"#fff", fontSize:11,
                padding:"2px 6px", borderRadius:12, fontWeight:"bold"
              }}>-{p.discount}%</span>}
              {p.rating && <span style={{ fontSize:11 }}>⭐ {p.rating.toFixed(1)}</span>}
              {p.soldCount && <span style={{ fontSize:11, color:"#6c757d" }}>{p.soldCount} Sold</span>}
              {p.stock && p.stock<10 && <span style={{ fontSize:11, color:"#ff4d4f", fontWeight:"bold" }}>Limited Stock</span>}
              {p.flashSaleEnd && <span style={{ fontSize:11, color:"#ffa500", fontWeight:"bold" }}>🔥 {getFlashTime(p.flashSaleEnd)}</span>}
            </div>
          </div>
        ))}
      </section>

      {/* Bottom Navigation */}
      <div style={{
        height:60,
        display:"flex",
        justifyContent:"space-around",
        alignItems:"center",
        borderTop:"1px solid #e0e6ef",
        backgroundColor:"#f5f7fb"
      }}>
        {bottomLinks.map(link => (
          <div key={link.path} onClick={()=>navigate(link.path)}
               style={{ textAlign:"center", cursor:"pointer", position:"relative" }}>
            <div style={{ fontSize:20 }}>{link.icon}</div>
            <div style={{ fontSize:12 }}>{link.label}</div>
            {link.badge>0 && <span style={{
              position:"absolute", top:-4, right:-10,
              background:"red", color:"#fff", fontSize:10,
              padding:"2px 5px", borderRadius:"50%", fontWeight:"bold"
            }}>{link.badge}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
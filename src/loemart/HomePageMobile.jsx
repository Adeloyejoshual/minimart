import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";

/* ONE Stylesheet */
import "../styles/Minimart.css";

/* Components */
import MobileTopBar from "./mobile/MobileTopBar";
import MobileHero from "./mobile/MobileHero";
import MobileSections from "./mobile/MobileSections";
import MasonryCard from "./mobile/MasonryCard";
import MobileFooter from "./mobile/MobileFooter";
import Footer from "../components/Footer";
import FloatingCartButton from "../components/FloatingCartButton";
import { SearchSheet, FilterSheet } from "./mobile/MobileSheets";

import { API, DEFAULT_LIMIT, normalize, getSearchHistory, addToSearchHistory } from "./mobile/mobileHelpers";

const CART_URL = `${API}/cart`;

export default function HomePageMobile({ user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isFirstMount = useRef(true);

  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [activeCategory, setActiveCategory] = useState(searchParams.get("category") ?? "all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchHistory, setSearchHistory] = useState(getSearchHistory);

  const [products, setProducts] = useState([]);
  const [flashDeals, setFlashDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  // Cart Data Map for Masonry Steppers
  const [cartMap, setCartMap] = useState({});
  const [cartCount, setCartCount] = useState(0);

  const syncCart = useCallback(async () => {
    const token = localStorage.getItem("marketplace_token");
    let map = {};
    let total = 0;
    
    if (user && token) {
      try {
        const res = await axios.get(CART_URL, { headers: { Authorization: `Bearer ${token}` } });
        const items = res.data?.data?.items || [];
        total = res.data?.data?.total_qty || 0;
        items.forEach(i => map[i.product_id] = { itemId: i.id, qty: i.qty });
      } catch { /* ignore */ }
    } else {
      const guestCart = JSON.parse(localStorage.getItem("mm_cart") || "[]");
      guestCart.forEach(i => {
        total += i.qty;
        map[i.productId] = { itemId: i.id, qty: i.qty };
      });
    }
    setCartMap(map);
    setCartCount(total);
  }, [user]);

  useEffect(() => {
    syncCart();
    window.addEventListener("cart-updated", syncCart);
    return () => window.removeEventListener("cart-updated", syncCart);
  }, [syncCart]);

  const fetchProducts = useCallback(async (newOffset = 0) => {
    setLoading(true);
    try {
      const params = { limit: DEFAULT_LIMIT, offset: newOffset, sort: "newest" };
      if (normalize(searchQuery)) params.search = normalize(searchQuery);
      if (activeCategory !== "all") params.category = activeCategory;
      const { data } = await axios.get(`${API}/products`, { params });
      setProducts(newOffset === 0 ? data?.data?.products || [] : [...products, ...(data?.data?.products || [])]);
      setOffset(newOffset);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [searchQuery, activeCategory, products]);

  useEffect(() => {
    axios.get(`${API}/products`, { params: { trending: "true", limit: 6 } })
      .then(res => setFlashDeals(res.data?.data?.products || []));
  }, []);

  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; fetchProducts(0); return; }
    fetchProducts(0);
  }, [activeCategory, fetchProducts]);

  return (
    <div className="mm-page">
      <MobileTopBar
        searchQuery={searchQuery}
        onSearchOpen={() => setSearchOpen(true)}
        onClearSearch={() => setSearchQuery("")}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        onFilterOpen={() => setShowFilters(true)}
      />

      <div className="mm-hero-wrap">
        <MobileHero user={user} onPostAd={() => navigate("/minimart/post-ad")} />
      </div>

      <MobileSections flashDeals={flashDeals} />

      <section className="mdp-psec mdp-psec--recommended">
        <div className="mdp-psec__head">
          <h3 className="mdp-psec__title">All Products</h3>
        </div>
        <div className="pr-masonry">
          {products.map((item) => (
            <MasonryCard 
              key={item.id} 
              product={item} 
              cartInfo={cartMap[item.id]} 
              onCartUpdate={syncCart} 
            />
          ))}
        </div>
        {!loading && <div className="pr-load-more-wrap"><button className="pr-load-more-btn" onClick={() => fetchProducts(offset + DEFAULT_LIMIT)}>Load More</button></div>}
      </section>

      {cartCount > 0 && <FloatingCartButton count={cartCount} onClick={() => navigate("/shop/cart")} />}
      <Footer />
      <MobileFooter user={user} cartCount={cartCount} onPostAd={() => navigate("/minimart/post-ad")} />

      <SearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} query={searchQuery} setQuery={setSearchQuery} onSelect={(q) => { setSearchQuery(q); setSearchOpen(false); fetchProducts(0); }} history={searchHistory} />
    </div>
  );
}
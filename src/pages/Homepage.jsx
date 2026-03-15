// src/pages/Homepage.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import InfiniteScroll from "react-infinite-scroll-component";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";

const API = "https://minimart-ivrm.onrender.com/api/marketplace";

export default function Homepage({ user }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [search, setSearch] = useState("");
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const limit = 20;

  useEffect(() => {
    loadProducts(true);
    loadTrending();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadProducts(true), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const loadProducts = async (reset = false) => {
    try {
      setLoading(true);
      const currentSkip = reset ? 0 : skip;
      const res = await axios.get(
        `${API}/products?skip=${currentSkip}&limit=${limit}&search=${search}`
      );
      const data = res.data.products || res.data;

      if (reset) {
        setProducts(data);
        setSkip(data.length);
        setHasMore(true);
      } else {
        setProducts((prev) => [...prev, ...data]);
        setSkip((prev) => prev + data.length);
      }

      if (data.length < limit) setHasMore(false);
    } catch (err) {
      console.error("Product load error", err);
    } finally {
      setLoading(false);
    }
  };

  const loadTrending = async () => {
    try {
      const res = await axios.get(`${API}/trending`);
      setTrending(res.data);
    } catch (err) {
      console.error("Trending error", err);
    }
  };

  const goToProduct = (id) => navigate(`/product/${id}`);

  return (
    <div style={{ maxWidth: 1200, margin: "auto", padding: 20, paddingBottom: 80 }}>
      {/* Top Navigation */}
      <TopNav user={user} />

      <h1>MiniMart Marketplace</h1>

      <input
        placeholder="Search products..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ padding: 10, width: "100%", marginBottom: 20 }}
      />

      <h2>Trending Products</h2>
      <Swiper slidesPerView={3} spaceBetween={10}>
        {trending.map((p) => (
          <SwiperSlide key={p.id}>
            <div
              style={{ border: "1px solid #ddd", padding: 10, cursor: "pointer" }}
              onClick={() => goToProduct(p.id)}
            >
              {p.image && <img src={p.image} alt={p.title} width="100%" />}
              <h4>{p.title}</h4>
              <p>₦{p.price}</p>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      <h2 style={{ marginTop: 40 }}>All Products</h2>
      <InfiniteScroll
        dataLength={products.length}
        next={() => loadProducts(false)}
        hasMore={hasMore}
        loader={<p>Loading...</p>}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
            gap: 20,
          }}
        >
          {products.map((p) => (
            <div
              key={p.id}
              style={{
                border: "1px solid #ddd",
                padding: 15,
                cursor: "pointer",
              }}
              onClick={() => goToProduct(p.id)}
            >
              {p.image && (
                <img
                  src={p.image}
                  alt={p.title}
                  style={{ width: "100%", height: 160, objectFit: "cover" }}
                />
              )}
              <h3>{p.title}</h3>
              <p>{p.description}</p>
              <strong>₦{p.price}</strong>
              <p>Stock: {p.stock}</p>
            </div>
          ))}
        </div>
      </InfiniteScroll>

      {!loading && products.length === 0 && <p>No products available.</p>}

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
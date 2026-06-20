import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import Navbar        from "../components/Navbar";
import HeroBanner    from "../components/HeroBanner";
import CategoryGrid  from "../components/CategoryGrid";
import FeaturedProducts from "../components/FeaturedProducts";
import PromoBanner   from "../components/PromoBanner";
import Footer        from "../components/Footer";

import "../styles/Home.css";

const API = "https://minimart-ivrm.onrender.com/api";

export default function HomePage({ user }) {
  const navigate = useNavigate();

  const [products,  setProducts]  = useState([]);
  const [loading,   setLoading]   = useState(true);

  const fetchProducts = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/products`, {
        params: { limit: 12, sort: "newest", status: "active" },
      });
      const list =
        data?.data?.products ??
        data?.data?.items    ??
        data?.data           ??
        data?.products       ??
        [];
      setProducts(list);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  return (
    <div className="home">
      <Navbar user={user} />

      <main>
        {/* Hero */}
        <HeroBanner onShop={() => navigate("/minimart")} />

        {/* Categories */}
        <CategoryGrid />

        {/* Featured products */}
        <FeaturedProducts
          products={products}
          loading={loading}
          onViewAll={() => navigate("/minimart")}
        />

        {/* Promo strip */}
        <PromoBanner />
      </main>

      <Footer />
    </div>
  );
}
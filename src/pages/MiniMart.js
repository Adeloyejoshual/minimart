// src/pages/MiniMart.jsx
import axios from "axios";

useEffect(() => {
  const loadProducts = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/minimart-products`);
      const products = res.data; // assume API returns array of products
      setAllProducts(products);

      // Compute trending
      const scored = products.map(p => ({ ...p, trendingScore: calculateAIScore(p) }));
      setTrendingProducts(scored.sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 8));
    } catch (err) {
      console.error("Failed to load products:", err);
    }
  };

  loadProducts();
}, []);
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import InfiniteScroll from "react-infinite-scroll-component";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper";
import "swiper/css";

export default function Homepage() {
  const navigate = useNavigate();
  const API = "https://minimart-ivrm.onrender.com/api";

  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchProducts({ reset: true });
    fetchTrending();

    const token = localStorage.getItem("token");
    if (token) fetchUser(token);
  }, []);

  const fetchUser = async (token) => {
    try {
      const res = await axios.get(`${API}/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(res.data);
    } catch {
      localStorage.removeItem("token");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/users/login`, loginData);
      setUser(res.data.user);
      localStorage.setItem("token", res.data.token);
      setMessage("Login successful!");
    } catch (err) {
      setMessage(err.response?.data?.message || "Login failed");
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("token");
    setMessage("Logged out");
  };

  const goToAddProduct = () => {
    if (!user) return setMessage("Please login first to add products");
    navigate("/minimart/add");
  };

  const fetchProducts = async ({ reset = false } = {}) => {
    if (reset) {
      setProducts([]);
      setSkip(0);
      setHasMore(true);
    }
    try {
      setLoading(true);
      const res = await axios.get(
        `${API}/marketplace/products?skip=${reset ? 0 : skip}&limit=20`
      );
      const data = res.data;
      if (reset) setProducts(data);
      else setProducts((prev) => [...prev, ...data]);
      setSkip((prev) => prev + data.length);
      if (data.length < 20) setHasMore(false);
    } catch (err) {
      console.error("Failed to fetch products", err);
      setMessage("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const fetchTrending = async () => {
    try {
      const res = await axios.get(`${API}/marketplace/trending?limit=6`);
      setTrending(res.data);
    } catch (err) {
      console.error("Failed to fetch trending", err);
    }
  };

  const SkeletonCard = () => (
    <div className="animate-pulse bg-white rounded-lg shadow-md p-4">
      <div className="w-full h-48 bg-gray-200 rounded-md mb-3"></div>
      <div className="h-5 bg-gray-200 rounded mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
      <div className="flex justify-between">
        <div className="h-6 bg-gray-200 rounded w-16"></div>
        <div className="h-4 bg-gray-200 rounded w-12"></div>
      </div>
    </div>
  );

  const ProductCard = ({ product }) => (
    <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      {product.image && (
        <img
          src={product.image}
          alt={product.title}
          className="w-full h-48 object-cover rounded-md mb-3"
        />
      )}
      <h4 className="font-semibold text-lg mb-1 truncate">{product.title}</h4>
      <p className="text-gray-600 text-sm mb-2 line-clamp-2">{product.description}</p>
      <div className="flex justify-between items-center">
        <span className="text-xl font-bold text-green-600">₦{product.price}</span>
        <span className="text-sm text-gray-500">Stock: {product.stock}</span>
      </div>
    </div>
  );

  const TrendingCard = ({ product }) => (
    <div className="w-48 flex-shrink-0">
      <div className="bg-white rounded-xl shadow-lg p-3 hover:shadow-xl transition-all">
        {product.image && (
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-32 object-cover rounded-lg mb-2"
          />
        )}
        <h4 className="font-medium text-sm truncate">{product.title}</h4>
        <p className="text-green-600 font-bold text-lg">₦{product.price}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <header className="bg-white shadow-sm sticky top-0 z-50 mb-4">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-2xl font-bold text-gray-800">MiniMart</div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span>Welcome, {user.name}</span>
                <button onClick={handleLogout}>Logout</button>
                <button onClick={goToAddProduct}>➕ Add Product</button>
              </>
            ) : (
              <form className="flex gap-2" onSubmit={handleLogin}>
                <input
                  type="email"
                  placeholder="Email"
                  value={loginData.email}
                  onChange={(e) =>
                    setLoginData({ ...loginData, email: e.target.value })
                  }
                  required
                  className="border rounded px-2 py-1"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={loginData.password}
                  onChange={(e) =>
                    setLoginData({ ...loginData, password: e.target.value })
                  }
                  required
                  className="border rounded px-2 py-1"
                />
                <button type="submit" className="bg-blue-500 text-white px-3 rounded">
                  Login
                </button>
              </form>
            )}
          </div>
        </div>
      </header>

      {trending.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xl font-bold mb-2">🔥 Trending Products</h2>
          <Swiper
            spaceBetween={16}
            slidesPerView={3}
            autoplay={{ delay: 2500, disableOnInteraction: false }}
          >
            {trending.map((p) => (
              <SwiperSlide key={p.id}>
                <TrendingCard product={p} />
              </SwiperSlide>
            ))}
          </Swiper>
        </section>
      )}

      <section>
        <h2 className="text-xl font-bold mb-2">All Products</h2>
        {loading && <p>Loading products...</p>}
        <InfiniteScroll
          dataLength={products.length}
          next={() => fetchProducts()}
          hasMore={hasMore}
          loader={[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </InfiniteScroll>
        {!loading && products.length === 0 && (
          <p className="text-center py-12 text-gray-500">No products available.</p>
        )}
      </section>

      {message && <p className="text-green-600 mt-4">{message}</p>}
    </div>
  );
}
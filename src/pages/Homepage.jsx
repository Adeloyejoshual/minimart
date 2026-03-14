import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import InfiniteScroll from "react-infinite-scroll-component";
import { Swiper, SwiperSlide } from "swiper/react";
import SwiperCore, { Autoplay } from "swiper";
import "swiper/css";
import { Search, User, ShoppingCart, Home, List, MessageCircle } from "lucide-react";

SwiperCore.use([Autoplay]);

export default function Homepage() {
  const navigate = useNavigate();
  const API = "https://minimart-ivrm.onrender.com/api";

  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) fetchUser(token);
    fetchTrending();
    fetchProducts({ reset: true });
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

  const fetchProducts = async ({ reset = false, search = searchQuery } = {}) => {
    if (reset) {
      setProducts([]);
      setSkip(0);
      setHasMore(true);
    }
    try {
      setLoading(true);
      const res = await axios.get(
        `${API}/marketplace/products?skip=${reset ? 0 : skip}&limit=20&search=${search}`
      );
      const data = res.data;
      if (reset) setProducts(data);
      else setProducts((prev) => [...prev, ...data]);
      setSkip((prev) => prev + data.length);
      if (data.length < 20) setHasMore(false);
    } catch (err) {
      console.error("Failed to load products", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrending = async () => {
    try {
      const res = await axios.get(`${API}/marketplace/trending?limit=6`);
      setTrending(res.data);
    } catch (err) {
      console.error("Failed to load trending", err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts({ reset: true, search: searchQuery });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("token");
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-2xl font-bold text-gray-800">MiniMart</div>
          <div className="flex-1 max-w-md mx-8 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-4">
            <ShoppingCart className="w-6 h-6 text-gray-600" />
            {user ? (
              <User
                className="w-6 h-6 text-gray-600 cursor-pointer"
                onClick={() => navigate("/profile")}
              />
            ) : (
              <button
                onClick={() =>
                  document
                    .getElementById("login-form")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="py-8 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold mb-6">🔥 Trending Products</h2>
          <Swiper
            spaceBetween={16}
            slidesPerView={3}
            autoplay={{ delay: 2500, disableOnInteraction: false }}
          >
            {trending.map((product) => (
              <SwiperSlide key={product.id}>
                <TrendingCard product={product} />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </section>

      <section className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <InfiniteScroll
            dataLength={products.length}
            next={() => fetchProducts()}
            hasMore={hasMore}
            loader={[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
              {loading && [...Array(4)].map((_, i) => <SkeletonCard key={`loading-${i}`} />)}
            </div>
          </InfiniteScroll>
          {products.length === 0 && !loading && (
            <p className="col-span-full text-center py-12 text-gray-500">
              No products available.
            </p>
          )}
        </div>
      </section>

      {!user && (
        <div className="max-w-md mx-auto py-12 px-4" id="login-form">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
              Welcome to MiniMart
            </h1>
            <p className="text-center text-gray-500 mb-4">
              Please log in to access cart, profile, and chat features.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
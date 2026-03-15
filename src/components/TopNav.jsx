import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../style/TopNav.css";

export default function TopNav({ user, setUser }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0); // 0: Search, 1: Category, 2: Price
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [priceRange, setPriceRange] = useState([0, 100000]);
  const searchRef = useRef(null);
  const timeoutRef = useRef(null);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    navigate("/auth");
  };

  // Load categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get("/api/categories");
        setCategories(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCategories();
  }, []);

  // Live search (title + description)
  const fetchSearchResults = async (query) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    try {
      const res = await axios.get(`/api/search/live?q=${encodeURIComponent(query)}`);
      setResults(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    setSlideIndex(0);
    setShowSearchPanel(true);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => fetchSearchResults(value), 300);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchPanel(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter results
  const filteredResults = results.filter(r =>
    (!selectedCategory || r.category === selectedCategory) &&
    r.price >= priceRange[0] && r.price <= priceRange[1]
  );

  return (
    <header className="top-nav fixed top-0 left-0 right-0 z-50">
      <div className="nav-container">
        {/* Logo */}
        <div className="nav-brand" onClick={() => navigate("/")}>
          <div className="logo-icon">🛒</div>
          <span className="brand-name">MiniMart</span>
        </div>

        {/* Search */}
        <div className="search-container" ref={searchRef}>
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={handleInputChange}
            onFocus={() => search.length >= 2 && setShowSearchPanel(true)}
            className="search-input"
          />

          {showSearchPanel && (
            <div className="search-panel">
              <div className="search-slider" style={{ transform: `translateX(-${slideIndex * 100}%)` }}>
                
                {/* Slide 1: Search Results */}
                <div className="search-slide">
                  {filteredResults.length === 0 ? (
                    <div className="search-empty">No results found</div>
                  ) : (
                    filteredResults.map(p => (
                      <div
                        key={p.id}
                        className="search-item"
                        onClick={() => {
                          navigate(`/product/${p.id}`);
                          setSearch("");
                          setShowSearchPanel(false);
                        }}
                      >
                        <img src={p.image || "/placeholder.png"} alt={p.title} className="search-item-img"/>
                        <div className="search-item-info">
                          <p className="search-item-title">{p.title}</p>
                          <span className="search-item-price">₦{p.price}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Slide 2: Category Filter */}
                <div className="search-slide">
                  <h3>Filter by Category</h3>
                  <ul className="category-list">
                    {categories.map(cat => (
                      <li
                        key={cat.id}
                        className={selectedCategory === cat.name ? "selected" : ""}
                        onClick={() => setSelectedCategory(cat.name)}
                      >
                        {cat.name}
                      </li>
                    ))}
                  </ul>
                  <div className="slide-nav-buttons">
                    <button onClick={() => setSlideIndex(0)}>Back</button>
                    <button onClick={() => setSlideIndex(2)}>Next: Price</button>
                  </div>
                </div>

                {/* Slide 3: Price Filter */}
                <div className="search-slide">
                  <h3>Filter by Price</h3>
                  <div className="price-range">
                    <input
                      type="number"
                      value={priceRange[0]}
                      onChange={e => setPriceRange([Number(e.target.value), priceRange[1]])}
                    />
                    <span> - </span>
                    <input
                      type="number"
                      value={priceRange[1]}
                      onChange={e => setPriceRange([priceRange[0], Number(e.target.value)])}
                    />
                  </div>
                  <div className="slide-nav-buttons">
                    <button onClick={() => setSlideIndex(1)}>Back: Category</button>
                    <button onClick={() => setSlideIndex(0)}>Apply & Search</button>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <nav className="nav-menu">
          {user ? (
            <div className="user-menu">
              <span className="welcome-text">Hi, {user.name}</span>
              <button className="nav-btn" onClick={() => navigate("/profile")}>Profile</button>
              <button className="nav-btn" onClick={() => navigate("/minimart/add")}>Add Product</button>
              <button className="nav-btn logout-btn" onClick={handleLogout}>Logout</button>
            </div>
          ) : (
            <div className="guest-menu">
              <button className="nav-btn" onClick={() => navigate("/auth")}>Login</button>
              <button className="nav-btn" onClick={() => navigate("/auth")}>Register</button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
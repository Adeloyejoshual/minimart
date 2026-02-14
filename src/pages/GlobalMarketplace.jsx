// src/pages/GlobalMarketplaceAuto.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import "./GlobalMarketplace.css";

export default function GlobalMarketplaceAuto() {
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [newProduct, setNewProduct] = useState({
    title: "",
    price: "",
    country: "",
    state: "",
    city: "",
    category: "",
    condition: "New",
    image: null,
  });

  const [loading, setLoading] = useState(false);
  const [allStates, setAllStates] = useState([]);
  const [allCities, setAllCities] = useState([]);
  const [categorySuggestions, setCategorySuggestions] = useState([]);
  const [stateSuggestions, setStateSuggestions] = useState([]);
  const [citySuggestions, setCitySuggestions] = useState([]);

  // ================= Fetch Products =================
  useEffect(() => {
    fetchProducts();
    detectCountry();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await axios.get("/api/marketplace");
      setProducts(res.data);
      setFiltered(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // ================= Auto-Detect Country =================
  const detectCountry = async () => {
    try {
      const res = await axios.get("https://ipapi.co/json/");
      const country = res.data.country_name || "Nigeria";
      setNewProduct((prev) => ({ ...prev, country }));

      const statesRes = await axios.get(`/api/locations/states?country=${country}`);
      setAllStates(statesRes.data);
    } catch (err) {
      console.warn("Could not detect country. Defaulting to Nigeria.");
      setNewProduct((prev) => ({ ...prev, country: "Nigeria" }));
    }
  };

  const handleStateChange = async (state) => {
    setNewProduct((prev) => ({ ...prev, state, city: "" }));
    const citiesRes = await axios.get(`/api/locations/cities?country=${newProduct.country}&state=${state}`);
    setAllCities(citiesRes.data);
  };

  // ================= Auto-Suggest =================
  const filterSuggestions = (list, value) => {
    const term = value.toLowerCase();
    return list.filter((item) => item.toLowerCase().includes(term)).slice(0, 5);
  };

  const handleCategoryInput = (val) => {
    setNewProduct((prev) => ({ ...prev, category: val }));
    const allCategories = ["Electronics", "Fashion", "Vehicles", "Home Appliances", "Furniture", "Books", "Sports"];
    setCategorySuggestions(filterSuggestions(allCategories, val));
  };

  const handleStateInput = (val) => {
    setNewProduct((prev) => ({ ...prev, state: val }));
    setStateSuggestions(filterSuggestions(allStates, val));
  };

  const handleCityInput = (val) => {
    setNewProduct((prev) => ({ ...prev, city: val }));
    setCitySuggestions(filterSuggestions(allCities, val));
  };

  // ================= Add Product =================
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.title || !newProduct.price || !newProduct.image) {
      return alert("Title, Price, and Image are required");
    }

    setLoading(true);
    try {
      let imageUrl = "";

      const formData = new FormData();
      formData.append("file", newProduct.image);
      formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

      const cloudRes = await axios.post(
        `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
        formData
      );
      imageUrl = cloudRes.data.secure_url;

      const res = await axios.post("/api/marketplace", {
        ...newProduct,
        price: Number(newProduct.price),
        image_url: imageUrl,
      });

      setProducts([res.data, ...products]);
      setFiltered([res.data, ...filtered]);
      setNewProduct((prev) => ({
        ...prev,
        title: "",
        price: "",
        state: "",
        city: "",
        category: "",
        condition: "New",
        image: null,
      }));
      setCategorySuggestions([]);
      setStateSuggestions([]);
      setCitySuggestions([]);
      alert("Product added successfully!");
    } catch (err) {
      console.error(err);
      alert("Error adding product. Check console.");
    } finally {
      setLoading(false);
    }
  };

  // ================= Filter Products =================
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    const term = e.target.value.toLowerCase();
    setFiltered(products.filter((p) => p.title.toLowerCase().includes(term)));
  };

  return (
    <div className="global-marketplace-page">
      <h2>Global Marketplace</h2>

      {/* Search */}
      <input
        type="text"
        placeholder="Search products..."
        value={searchTerm}
        onChange={handleSearch}
        className="search-input"
      />

      {/* Add Product Form */}
      <form className="add-product-form" onSubmit={handleAddProduct}>
        <h3>Add Product</h3>

        <input
          type="text"
          placeholder="Product Title"
          value={newProduct.title}
          onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
          required
        />

        <input
          type="number"
          placeholder="Price"
          value={newProduct.price}
          onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
          required
        />

        <input
          type="text"
          value={newProduct.country}
          readOnly
          placeholder="Country (auto-detected)"
        />

        {/* Category Auto-Suggest */}
        <input
          type="text"
          placeholder="Category"
          value={newProduct.category}
          onChange={(e) => handleCategoryInput(e.target.value)}
        />
        {categorySuggestions.length > 0 && (
          <ul className="suggestions-list">
            {categorySuggestions.map((c) => (
              <li key={c} onClick={() => setNewProduct({ ...newProduct, category: c })}>
                {c}
              </li>
            ))}
          </ul>
        )}

        {/* State Auto-Suggest */}
        <input
          type="text"
          placeholder="State"
          value={newProduct.state}
          onChange={(e) => handleStateInput(e.target.value)}
        />
        {stateSuggestions.length > 0 && (
          <ul className="suggestions-list">
            {stateSuggestions.map((s) => (
              <li key={s} onClick={() => handleStateChange(s)}>
                {s}
              </li>
            ))}
          </ul>
        )}

        {/* City Auto-Suggest */}
        <input
          type="text"
          placeholder="City"
          value={newProduct.city}
          onChange={(e) => handleCityInput(e.target.value)}
        />
        {citySuggestions.length > 0 && (
          <ul className="suggestions-list">
            {citySuggestions.map((c) => (
              <li key={c} onClick={() => setNewProduct({ ...newProduct, city: c })}>
                {c}
              </li>
            ))}
          </ul>
        )}

        <select
          value={newProduct.condition}
          onChange={(e) => setNewProduct({ ...newProduct, condition: e.target.value })}
        >
          <option>New</option>
          <option>Used</option>
          <option>Refurbished</option>
        </select>

        <input
          type="file"
          onChange={(e) => setNewProduct({ ...newProduct, image: e.target.files[0] })}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Product"}
        </button>
      </form>

      {/* Products Grid */}
      <div className="products-grid">
        {filtered.length === 0 && <p>No products found.</p>}
        {filtered.map((p) => (
          <div key={p._id} className="product-card">
            {p.image_url && <img src={p.image_url} alt={p.title} className="product-img" />}
            <h3>{p.title}</h3>
            <p>₦{p.price}</p>
            <p style={{ fontSize: "12px", color: "#555" }}>
              {p.city ? `${p.city}, ${p.state}` : p.country || "Global"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
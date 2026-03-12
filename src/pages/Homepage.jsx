// src/pages/Homepage.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

const Homepage = () => {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Login/Register state
  const [isLogin, setIsLogin] = useState(true);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ name: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");

  useEffect(() => {
    axios.get("/api/marketplace")
      .then((res) => setProducts(res.data.data))
      .catch((err) => console.error("Failed to fetch products:", err))
      .finally(() => setLoadingProducts(false));
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError(""); 
    try {
      const { data } = await axios.post("/api/auth/login", loginData);
      localStorage.setItem("token", data.token);
      setAuthSuccess("Logged in successfully!");
    } catch (err) {
      setAuthError(err.response?.data?.message || "Login failed");
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const { data } = await axios.post("/api/auth/signup", registerData);
      setAuthSuccess(data.message || "Account created! Check your email.");
      setTimeout(() => setIsLogin(true), 2000);
    } catch (err) {
      setAuthError(err.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div className="container">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>MiniMart Marketplace</h2>
        <nav>
          <button onClick={() => setIsLogin(true)} style={{ marginRight: "10px" }}>Login</button>
          <button onClick={() => setIsLogin(false)}>Register</button>
        </nav>
      </header>

      <section style={{ marginTop: "20px" }}>
        {/* Login/Register Form */}
        <div style={{ marginBottom: "30px", border: "1px solid #ccc", padding: "20px", maxWidth: "400px" }}>
          {authError && <p style={{ color: "red" }}>{authError}</p>}
          {authSuccess && <p style={{ color: "green" }}>{authSuccess}</p>}

          {isLogin ? (
            <form onSubmit={handleLogin}>
              <h3>Login</h3>
              <input
                type="email"
                placeholder="Email"
                value={loginData.email}
                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                required
              />
              <button type="submit">Login</button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <h3>Register</h3>
              <input
                type="text"
                placeholder="Full Name"
                value={registerData.name}
                onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={registerData.email}
                onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={registerData.password}
                onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                required
              />
              <button type="submit">Register</button>
            </form>
          )}
        </div>

        {/* Add Product Link */}
        <a href="/add-product" style={{ display: "inline-block", marginBottom: "20px" }}>
          Add New Product
        </a>

        {/* Products */}
        <div className="products" style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
          {loadingProducts ? (
            <p>Loading products...</p>
          ) : products.length > 0 ? (
            products.map((p) => (
              <div key={p.id} className="product-card" style={{ border: "1px solid #ccc", padding: "10px", width: "200px" }}>
                <img
                  src={p.image_url || "/placeholder.png"}
                  alt={p.title || "Product image"}
                  style={{ width: "100%", height: "150px", objectFit: "cover" }}
                />
                <h3>{p.title}</h3>
                <p>₦{p.price}</p>
              </div>
            ))
          ) : (
            <p>No products available.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default Homepage;
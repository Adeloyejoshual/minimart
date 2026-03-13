// src/App.jsx
import React, { useState } from "react";
import Home from "./pages/Homepage";
import Login from "./pages/Login";
import Register from "./pages/Register";

export default function App() {
  const [user, setUser] = useState(null); // Logged-in user
  const [page, setPage] = useState("home"); // 'home' | 'login' | 'register'

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setPage("home");
  };

  const handleLogout = () => {
    setUser(null);
    setPage("home");
  };

  const renderPage = () => {
    switch (page) {
      case "login":
        return <Login onLogin={handleLoginSuccess} switchToRegister={() => setPage("register")} />;
      case "register":
        return <Register switchToLogin={() => setPage("login")} />;
      case "home":
      default:
        return <Home user={user} onLogout={handleLogout} />;
    }
  };

  return (
    <div>
      {/* Simple nav */}
      <nav style={{ padding: "10px", borderBottom: "1px solid #ccc" }}>
        <button onClick={() => setPage("home")}>Home</button>
        {!user && <button onClick={() => setPage("login")}>Login</button>}
        {!user && <button onClick={() => setPage("register")}>Register</button>}
        {user && <button onClick={handleLogout}>Logout</button>}
      </nav>

      {/* Page content */}
      <div>{renderPage()}</div>
    </div>
  );
}
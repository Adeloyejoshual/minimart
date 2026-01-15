// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "./firebase";

// Pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import MiniMart from "./pages/MiniMart";
import Marketplace from "./pages/Marketplace";
import Profile from "./pages/Profile";
import ApplySeller from "./pages/ApplySeller";
import AdminPanel from "./pages/AdminPanel";
import ProductDetail from "./pages/ProductDetail";
import AddProduct from "./pages/AddProduct";
import Chat from "./pages/Chat"; // <-- import Chat page

function App() {
  const [user, loading] = useAuthState(auth);

  if (loading) return <p>Loading...</p>; // Wait until Firebase loads auth state

  return (
    <Router>
      <Routes>
        {/* Guest routes */}
        {!user ? (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <>
            {/* Redirect root to MiniMart */}
            <Route path="/" element={<Navigate to="/minimart" replace />} />

            {/* Main pages */}
            <Route path="/minimart" element={<MiniMart />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/profile" element={<Profile />} />

            {/* Verified Seller Application */}
            <Route path="/apply-seller" element={<ApplySeller />} />

            {/* Admin panel */}
            <Route path="/admin" element={<AdminPanel />} />

            {/* Product detail */}
            <Route path="/product/:productId" element={<ProductDetail />} />

            {/* Add Product */}
            <Route path="/add-product" element={<AddProduct />} />

            {/* Chat route — MUST be before catch-all */}
            <Route path="/chat/:sellerId" element={<Chat />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/minimart" replace />} />
          </>
        )}
      </Routes>
    </Router>
  );
}

export default App;
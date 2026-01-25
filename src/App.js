import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "./firebase";

// Pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import HomePage from "./pages/HomePage";
import MiniMart from "./pages/MiniMart";
import Marketplace from "./pages/Marketplace";
import Profile from "./pages/Profile";
import ApplySeller from "./pages/ApplySeller";
import AdminPanel from "./pages/AdminPanel";
import ProductDetail from "./pages/ProductDetail";
import AddProduct from "./pages/AddProduct";
import ChatPage from "./pages/ChatPage";

// New Pages
import CartPage from "./pages/CartPage";
import MessagesPage from "./pages/MessagesPage";
import SavedItemsPage from "./pages/SavedItemsPage";
import SearchPage from "./pages/SearchPage"; // Optional search page
import SelectLocation from "./pages/SelectLocation"; // Region selection page
import PriceFiltersPage from "./pages/PriceFiltersPage"; // Price filters

function App() {
  const [user, loading] = useAuthState(auth);

  if (loading) return <p>Loading...</p>;

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
            {/* Root homepage */}
            <Route path="/" element={<HomePage />} />

            {/* Main pages */}
            <Route path="/minimart" element={<MiniMart />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/profile" element={<Profile />} />

            {/* Cart, Messages, Saved Items */}
            <Route path="/cart" element={<CartPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/saved-items" element={<SavedItemsPage />} />

            {/* Search & Location */}
            <Route path="/search" element={<SearchPage />} />
            <Route path="/select-location" element={<SelectLocation />} />

            {/* Price Filters & Add Product */}
            <Route path="/price-filters" element={<PriceFiltersPage />} />
            <Route path="/add-product" element={<AddProduct />} />

            {/* Verified Seller Application */}
            <Route path="/apply-seller" element={<ApplySeller />} />

            {/* Admin panel */}
            <Route path="/admin" element={<AdminPanel />} />

            {/* Product detail */}
            <Route path="/product/:productId" element={<ProductDetail />} />

            {/* Chat route */}
            <Route path="/chat/:sellerId" element={<ChatPage />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </Router>
  );
}

export default App;
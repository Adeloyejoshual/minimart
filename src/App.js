import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "./firebase";

/* ================= AUTH PAGES ================= */
import Login from "./pages/Login";
import Register from "./pages/Register";

/* ================= MAIN USER PAGES ================= */
import HomePage from "./pages/HomePage";
import MiniMart from "./pages/MiniMart";
import Marketplace from "./pages/Marketplace";
import Profile from "./pages/Profile";
import ApplySeller from "./pages/ApplySeller";
import ProductDetail from "./pages/ProductDetail";
import AddProduct from "./pages/AddProduct";
import ChatPage from "./pages/ChatPage";

/* ================= FEATURE PAGES ================= */
import CartPage from "./pages/CartPage";
import MessagesPage from "./pages/MessagesPage";
import SavedItemsPage from "./pages/SavedItemsPage";
import SearchBar from "./pages/SearchBar";
import SelectLocation from "./pages/SelectLocation";
import PriceFiltersPage from "./pages/PriceFiltersPage";

/* ================= ADMIN PAGES ================= */
import AdminPanel from "./pages/AdminPanel";
import AdminManager from "./pages/admin/AdminManager";
import ModeratorPanel from "./pages/admin/ModeratorPanel";
import FinanceAdminPanel from "./pages/admin/FinanceAdminPanel";
import SupportAdminPanel from "./pages/admin/SupportAdminPanel";

/* ================= SUPER ADMIN ================= */
import SuperAdminLogin from "./pages/admin/SuperAdminLogin";
import SuperAdminDashboard from "./pages/admin/SuperAdminDashboard";
import SuperAdminRoute from "./routes/SuperAdminRoute";

/* ================= ROLE-BASED ADMIN ROUTER ================= */
function AdminRolePage() {
  const { role } = useParams();

  switch (role?.toLowerCase()) {
    case "moderator":
      return <ModeratorPanel />;
    case "finance":
      return <FinanceAdminPanel />;
    case "support":
      return <SupportAdminPanel />;
    case "manager":
      return <AdminManager />;
    default:
      return <Navigate to="/admin" replace />;
  }
}

function App() {
  const [user, loading] = useAuthState(auth);

  if (loading) return <p>Loading...</p>;

  return (
    <Router>
      <Routes>

        {/* ===================================================== */}
        {/* 🔐 SUPER ADMIN (NOT CONNECTED TO FIREBASE AUTH) */}
        {/* ===================================================== */}
        <Route path="/superadmin-login" element={<SuperAdminLogin />} />
        <Route
          path="/superadmin/dashboard"
          element={
            <SuperAdminRoute>
              <SuperAdminDashboard />
            </SuperAdminRoute>
          }
        />

        {/* ===================================================== */}
        {/* 👤 NORMAL USERS (FIREBASE AUTH REQUIRED) */}
        {/* ===================================================== */}
        {!user ? (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <>
            {/* Home */}
            <Route path="/" element={<HomePage />} />

            {/* Core Marketplace */}
            <Route path="/minimart" element={<MiniMart />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/profile" element={<Profile />} />

            {/* Shopping */}
            <Route path="/cart" element={<CartPage />} />
            <Route path="/saved-items" element={<SavedItemsPage />} />

            {/* Messaging */}
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/chat/:sellerId" element={<ChatPage />} />

            {/* Search & Filters */}
            <Route path="/search" element={<SearchBar />} />
            <Route path="/select-location" element={<SelectLocation />} />
            <Route path="/price-filters" element={<PriceFiltersPage />} />

            {/* Selling */}
            <Route path="/add-product" element={<AddProduct />} />
            <Route path="/apply-seller" element={<ApplySeller />} />

            {/* Product */}
            <Route path="/product/:productId" element={<ProductDetail />} />

            {/* Admin Base Panel */}
            <Route path="/admin" element={<AdminPanel />} />

            {/* Role-Based Admin Dashboards */}
            <Route path="/admin/:role" element={<AdminRolePage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}

      </Routes>
    </Router>
  );
}

export default App;
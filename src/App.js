// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

/* ================= AUTH PAGES ================= */
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminLogin from "./pages/AdminLogin";

/* ================= MAIN USER PAGES ================= */
import HomePage from "./pages/HomePage";
import MiniMart from "./pages/MiniMart";
import Marketplace from "./pages/Marketplace";
import Profile from "./pages/Profile";
import ApplySeller from "./pages/ApplySeller";
import ProductDetail from "./pages/ProductDetail";
import AddProduct from "./pages/AddProduct"; // Jiji-style quick post
import MartProduct from "./pages/MartProduct"; // Jumia-style smart seller flow
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

/* ================= PROTECTED WRAPPERS ================= */
function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoleRoute({ children, allowedRoles = ["Admin", "Manager", "Moderator", "Finance", "Support"] }) {
  const [user, loadingUser] = useAuthState(auth);
  const [loading, setLoading] = React.useState(true);
  const [isAllowed, setIsAllowed] = React.useState(false);

  React.useEffect(() => {
    const fetchRole = async () => {
      if (!user) {
        setIsAllowed(false);
        setLoading(false);
        return;
      }

      try {
        const adminSnap = await getDoc(doc(db, "admins", user.uid));
        if (!adminSnap.exists()) {
          setIsAllowed(false);
        } else {
          const role = adminSnap.data().role;
          setIsAllowed(allowedRoles.includes(role));
        }
      } catch (err) {
        console.error("Failed to fetch admin role:", err);
        setIsAllowed(false);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [user, allowedRoles]);

  if (loadingUser || loading) return <p>Loading admin...</p>;
  if (!user) return <Navigate to="/admin-login" replace />;
  if (!isAllowed) return <Navigate to="/" replace />;

  return children;
}

/* ================= ROLE-BASED ADMIN PAGE ================= */
function AdminRolePage() {
  const { role } = useParams();

  switch (role?.toLowerCase()) {
    case "manager":
      return <AdminManager />;
    case "moderator":
      return <ModeratorPanel />;
    case "finance":
      return <FinanceAdminPanel />;
    case "support":
      return <SupportAdminPanel />;
    default:
      return <Navigate to="/admin" replace />;
  }
}

/* ================= APP ================= */
function App() {
  const [user, loading] = useAuthState(auth);

  if (loading) return <p>Loading...</p>;

  return (
    <Router>
      <Routes>

        {/* SUPER ADMIN */}
        <Route path="/superadmin-login" element={<SuperAdminLogin />} />
        <Route
          path="/superadmin/dashboard"
          element={
            <SuperAdminRoute>
              <SuperAdminDashboard />
            </SuperAdminRoute>
          }
        />

        {/* ADMIN LOGIN */}
        <Route path="/admin-login" element={<AdminLogin />} />

        {/* GUEST ROUTES */}
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/" replace />} />

        {/* NORMAL USER ROUTES */}
        <Route path="/" element={<ProtectedRoute user={user}><HomePage /></ProtectedRoute>} />
        <Route path="/minimart" element={<ProtectedRoute user={user}><MiniMart /></ProtectedRoute>} />
        <Route path="/marketplace" element={<ProtectedRoute user={user}><Marketplace /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute user={user}><Profile /></ProtectedRoute>} />

        {/* SHOPPING */}
        <Route path="/cart" element={<ProtectedRoute user={user}><CartPage /></ProtectedRoute>} />
        <Route path="/saved-items" element={<ProtectedRoute user={user}><SavedItemsPage /></ProtectedRoute>} />

        {/* MESSAGING */}
        <Route path="/messages" element={<ProtectedRoute user={user}><MessagesPage /></ProtectedRoute>} />
        <Route path="/chat/:sellerId" element={<ProtectedRoute user={user}><ChatPage /></ProtectedRoute>} />

        {/* SEARCH & FILTERS */}
        <Route path="/search" element={<ProtectedRoute user={user}><SearchBar /></ProtectedRoute>} />
        <Route path="/select-location" element={<ProtectedRoute user={user}><SelectLocation /></ProtectedRoute>} />
        <Route path="/price-filters" element={<ProtectedRoute user={user}><PriceFiltersPage /></ProtectedRoute>} />

        {/* SELLING */}
        <Route path="/add-product" element={<ProtectedRoute user={user}><AddProduct /></ProtectedRoute>} />
        <Route path="/sell-smart" element={<ProtectedRoute user={user}><MartProduct /></ProtectedRoute>} />
        <Route path="/apply-seller" element={<ProtectedRoute user={user}><ApplySeller /></ProtectedRoute>} />

        {/* PRODUCT */}
        <Route path="/product/:productId" element={<ProtectedRoute user={user}><ProductDetail /></ProtectedRoute>} />

        {/* ADMIN PANEL */}
        <Route path="/admin" element={
          <AdminRoleRoute allowedRoles={["Admin", "Manager", "Moderator", "Finance", "Support"]}>
            <AdminPanel />
          </AdminRoleRoute>
        }/>
        <Route path="/admin/:role" element={
          <AdminRoleRoute allowedRoles={["Admin", "Manager", "Moderator", "Finance", "Support"]}>
            <AdminRolePage />
          </AdminRoleRoute>
        }/>

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />

      </Routes>
    </Router>
  );
}

export default App;
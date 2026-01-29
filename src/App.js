// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

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

/* ======================= WRAPPERS ======================= */

// Normal user protected route
function ProtectedRoute({ children }) {
  const [user, loading] = useAuthState(auth);

  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}

// Role-based admin protected route
function AdminRoleRoute({ children }) {
  const [user, loading] = useAuthState(auth);
  const [authorized, setAuthorized] = React.useState(false);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setAuthorized(false);
        setChecking(false);
        return;
      }

      try {
        const docRef = doc(db, "admins", user.uid);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data();

        if (data && ["Admin", "Moderator", "Finance", "Support"].includes(data.role)) {
          setAuthorized(true);
        } else {
          setAuthorized(false);
        }
      } catch (err) {
        console.error("Admin role fetch failed:", err);
        setAuthorized(false);
      } finally {
        setChecking(false);
      }
    };

    checkAdmin();
  }, [user]);

  if (loading || checking) return <p>Loading Admin...</p>;
  if (!user || !authorized) return <Navigate to="/" replace />;

  return children;
}

/* ======================= ROLE-BASED ADMIN PAGE ======================= */
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

/* ======================= APP ======================= */
function App() {
  const [user, loading] = useAuthState(auth);
  if (loading) return <p>Loading...</p>;

  return (
    <Router>
      <Routes>
        {/* ================= SUPER ADMIN ================= */}
        <Route path="/superadmin-login" element={<SuperAdminLogin />} />
        <Route
          path="/superadmin/dashboard"
          element={
            <SuperAdminRoute>
              <SuperAdminDashboard />
            </SuperAdminRoute>
          }
        />

        {/* ================= GUEST ROUTES ================= */}
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/" replace />} />

        {/* ================= NORMAL USER ROUTES ================= */}
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/minimart" element={<ProtectedRoute><MiniMart /></ProtectedRoute>} />
        <Route path="/marketplace" element={<ProtectedRoute><Marketplace /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
        <Route path="/saved-items" element={<ProtectedRoute><SavedItemsPage /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
        <Route path="/chat/:sellerId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><SearchBar /></ProtectedRoute>} />
        <Route path="/select-location" element={<ProtectedRoute><SelectLocation /></ProtectedRoute>} />
        <Route path="/price-filters" element={<ProtectedRoute><PriceFiltersPage /></ProtectedRoute>} />
        <Route path="/add-product" element={<ProtectedRoute><AddProduct /></ProtectedRoute>} />
        <Route path="/apply-seller" element={<ProtectedRoute><ApplySeller /></ProtectedRoute>} />
        <Route path="/product/:productId" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />

        {/* ================= ADMIN PANEL ================= */}
        <Route path="/admin" element={<AdminRoleRoute><AdminPanel /></AdminRoleRoute>} />
        <Route path="/admin/:role" element={<AdminRoleRoute><AdminRolePage /></AdminRoleRoute>} />

        {/* ================= FALLBACK ================= */}
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>
    </Router>
  );
}

export default App;
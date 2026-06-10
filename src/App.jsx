// App.js
import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { useProductCache } from "./context/ProductCacheContext";

// ── Pages — Public ────────────────────────────────────────────
import Homepage           from "./pages/Homepage";
import SearchPage         from "./pages/SearchPage";
import ProductDetail      from "./pages/ProductDetail";
import MarketDetail       from "./pages/MarketDetail";
import SellerProfile      from "./pages/SellerProfile";
import TermsAndConditions from "./pages/TermsAndConditions";
import MinimartPage       from "./pages/MinimartPage";
import P2P                from "./pages/P2P";
import MenuPage           from "./pages/MenuPage";
import CartPage           from "./pages/CartPage";          // ← NEW

// ── Pages — Homepage Sub-pages ────────────────────────────────
import NearbyPage      from "./pages/Homepage/NearbyPage";
import DealsPage       from "./pages/Homepage/DealsPage";
import NewArrivalsPage from "./pages/Homepage/NewArrivalsPage";
import TrendingPage    from "./pages/Homepage/TrendingPage";

// ── Pages — Auth ──────────────────────────────────────────────
import AuthPage from "./pages/AuthPage";

// ── Pages — Seller ────────────────────────────────────────────
import BecomeSeller    from "./pages/BecomeSeller";
import SellerDashboard from "./pages/seller/SellerDashboard";

// ── Pages — User Protected ────────────────────────────────────
import Profile           from "./pages/Profile";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage      from "./pages/SettingsPage";
import AddProduct        from "./pages/AddProduct";
import Conversations     from "./pages/Conversations";
import Chat              from "./pages/Chat";
import Coupons           from "./pages/Profile/Coupons";
import Dashboard         from "./pages/Profile/Dashboard";
import Leaderboard       from "./pages/Profile/Leaderboard";
import Verification      from "./pages/Profile/Verification";
import Wallet            from "./pages/Profile/Wallet";
import FAQ               from "./pages/FAQ";
import Complain          from "./pages/Complain";
import Support           from "./pages/Support";
import Invitation        from "./pages/Invitation";
import PostAds           from "./pages/PostAds";
import PaymentSuccess    from "./pages/PaymentSuccess";

// ── Pages — Admin ─────────────────────────────────────────────
import AdminLogin     from "./pages/admin/AdminLogin";
import AdminDashboard from "./page/admin/AdminDashboard";

// ─────────────────────────────────────────────────────────────
// TOKEN KEYS — single source of truth
// marketplace_token → public.users  (marketplace buyers)
// seller_token      → market.users  (seller accounts)
// admin_token       → admins
// ─────────────────────────────────────────────────────────────
export const TOKEN_KEYS = {
  marketplace: "marketplace_token",
  seller:      "seller_token",
  admin:       "admin_token",
};

const USERS_API = "https://minimart-ivrm.onrender.com/api/users";
const CART_API  = "https://minimart-ivrm.onrender.com/api/cart";

// ─────────────────────────────────────────────────────────────
// CART SYNC — merges guest localStorage cart into server cart
// after a successful marketplace login.
// ─────────────────────────────────────────────────────────────
async function syncCartAfterLogin(token) {
  const localCart = JSON.parse(localStorage.getItem("mm_cart") || "[]");
  if (!localCart.length) return;

  for (const item of localCart) {
    try {
      await axios.post(
        CART_API,
        {
          productId: item.productId,
          variantId: item.variant?.id ?? null,
          qty:       item.qty,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {
      // Individual item failures are silently swallowed so one
      // bad item doesn't abort the rest of the sync.
    }
  }

  localStorage.removeItem("mm_cart");
  window.dispatchEvent(new Event("cart-updated"));
}

// ─────────────────────────────────────────────────────────────
// SCROLL TO TOP ON ROUTE CHANGE
// ─────────────────────────────────────────────────────────────
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

// ─────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [user,         setUser]         = useState(null);
  const [admin,        setAdmin]        = useState(null);
  const [loadingUser,  setLoadingUser]  = useState(true);
  const [loadingAdmin, setLoadingAdmin] = useState(true);
  const [slowServer,   setSlowServer]   = useState(false);

  const { resetCache } = useProductCache();

  // ── Marketplace user auth ─────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEYS.marketplace);

    if (!token) {
      setLoadingUser(false);
      return;
    }

    axios
      .get(`${USERS_API}/me`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8_000,
      })
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEYS.marketplace);
        setUser(null);
      })
      .finally(() => setLoadingUser(false));
  }, []);

  // ── Admin auth (local only) ───────────────────────────────
  useEffect(() => {
    const token       = localStorage.getItem(TOKEN_KEYS.admin);
    const storedAdmin = localStorage.getItem("admin_data");

    if (!token || !storedAdmin) {
      setLoadingAdmin(false);
      return;
    }

    try {
      setAdmin(JSON.parse(storedAdmin));
    } catch {
      localStorage.removeItem("admin_data");
      localStorage.removeItem(TOKEN_KEYS.admin);
    } finally {
      setLoadingAdmin(false);
    }
  }, []);

  // ── Slow-server hint after 5 s ────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setSlowServer(true), 5_000);
    return () => clearTimeout(t);
  }, []);

  // ── Loading screen ────────────────────────────────────────
  if (loadingUser || loadingAdmin) {
    return (
      <div className="global-loader">
        <div className="logo">Minimart</div>
        <div className="spinner" />
        <p>
          {slowServer
            ? "Waking up server… please wait"
            : "Loading Minimart…"}
        </p>
      </div>
    );
  }

  // ── Marketplace login handler ─────────────────────────────
  // Called by AuthPage on success.
  // Saves ONLY marketplace_token — never touches seller_token.
  const handleAuthSuccess = (userData, token, navigateFn, from) => {
    localStorage.setItem(TOKEN_KEYS.marketplace, token);
    resetCache();
    localStorage.removeItem("lastLocation");
    localStorage.removeItem("active_location");
    localStorage.removeItem("cacheTime");
    setUser(userData);
    syncCartAfterLogin(token); // ← NEW: fire-and-forget; errors are swallowed internally
    toast.success(`Welcome back, ${userData.name}!`);
    navigateFn(from || "/", { replace: true });
  };

  // ── Logout helper ─────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEYS.marketplace);
    setUser(null);
    resetCache();
    toast.success("Signed out");
  };

  // ── Route guards ──────────────────────────────────────────
  const ProtectedRoute = ({ children }) => {
    const location = useLocation();
    if (!user) {
      return (
        <Navigate to="/auth" state={{ from: location }} replace />
      );
    }
    return children;
  };

  const AdminProtectedRoute = ({ children }) => {
    if (!admin) return <Navigate to="/admin/login" replace />;
    return children;
  };

  // ─────────────────────────────────────────────────────────
  return (
    <Router>
      <ScrollToTop />

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3_500,
          style: {
            padding:      "10px 14px",
            borderRadius: 8,
            color:        "#fff",
            fontSize:     "0.9rem",
          },
          success: { style: { background: "#16a34a" } },
          error:   { style: { background: "#dc2626" } },
        }}
      />

      <Routes>

        {/* ══════════════════════════════════════════════
            PUBLIC ROUTES
        ══════════════════════════════════════════════ */}
        <Route path="/"
          element={<Homepage key={user?.id ?? "guest"} user={user} />}
        />
        <Route path="/search"
          element={<SearchPage user={user} />}
        />
        <Route path="/product/:slug"
          element={<ProductDetail user={user} />}
        />
        <Route path="/shop/:slug"
          element={<MarketDetail user={user} />}
        />
        <Route path="/seller/:id"
          element={<SellerProfile user={user} />}
        />
        <Route path="/terms"
          element={<TermsAndConditions />}
        />
        <Route path="/minimart"
          element={<MinimartPage user={user} />}
        />
        <Route path="/p2p"
          element={<P2P user={user} />}
        />
        <Route path="/menu"
          element={<MenuPage user={user} />}
        />

        {/* Homepage sub-pages */}
        <Route path="/nearby"
          element={<NearbyPage user={user} />}
        />
        <Route path="/deals"
          element={<DealsPage user={user} />}
        />
        <Route path="/latest"
          element={<NewArrivalsPage user={user} />}
        />
        <Route path="/trending"
          element={<TrendingPage user={user} />}
        />

        {/* ══════════════════════════════════════════════
            MARKETPLACE AUTH
        ══════════════════════════════════════════════ */}
        <Route
          path="/auth"
          element={
            user
              ? <Navigate to="/" replace />
              : <AuthPage setUser={handleAuthSuccess} />
          }
        />

        {/* ══════════════════════════════════════════════
            SELLER ROUTES
            Both are self-contained — they read/write
            seller_token (market.users) independently.
            They never touch marketplace_token.
        ══════════════════════════════════════════════ */}
        <Route path="/become-seller"
          element={<BecomeSeller user={user} />}
        />
        <Route path="/seller/dashboard"
          element={<SellerDashboard />}
        />
        <Route path="/seller/dashboard/:tab"
          element={<SellerDashboard />}
        />

        {/* ══════════════════════════════════════════════
            PROTECTED MARKETPLACE ROUTES
        ══════════════════════════════════════════════ */}
        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile user={user} onLogout={handleLogout} />
          </ProtectedRoute>
        } />
        <Route path="/notifications" element={
          <ProtectedRoute>
            <NotificationsPage user={user} />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <SettingsPage user={user} />
          </ProtectedRoute>
        } />
        <Route path="/minimart/add" element={
          <ProtectedRoute>
            <AddProduct user={user} />
          </ProtectedRoute>
        } />
        <Route path="/conversations" element={
          <ProtectedRoute>
            <Conversations user={user} />
          </ProtectedRoute>
        } />
        <Route path="/chat/:threadId" element={
          <ProtectedRoute>
            <Chat user={user} />
          </ProtectedRoute>
        } />
        <Route path="/coupons" element={
          <ProtectedRoute>
            <Coupons user={user} />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard user={user} />
          </ProtectedRoute>
        } />
        <Route path="/leaderboard" element={
          <ProtectedRoute>
            <Leaderboard user={user} />
          </ProtectedRoute>
        } />
        <Route path="/verification" element={
          <ProtectedRoute>
            <Verification user={user} />
          </ProtectedRoute>
        } />
        <Route path="/wallet" element={
          <ProtectedRoute>
            <Wallet user={user} />
          </ProtectedRoute>
        } />
        <Route path="/faq" element={
          <ProtectedRoute>
            <FAQ user={user} />
          </ProtectedRoute>
        } />
        <Route path="/complain" element={
          <ProtectedRoute>
            <Complain user={user} />
          </ProtectedRoute>
        } />
        <Route path="/support" element={
          <ProtectedRoute>
            <Support user={user} />
          </ProtectedRoute>
        } />
        <Route path="/invitation" element={
          <ProtectedRoute>
            <Invitation user={user} />
          </ProtectedRoute>
        } />
        <Route path="/minimart/post-ad" element={
          <ProtectedRoute>
            <PostAds user={user} />
          </ProtectedRoute>
        } />
        <Route path="/payment/success"
          element={<PaymentSuccess />}
        />

        {/* ══════════════════════════════════════════════
            CART                                         ← NEW
        ══════════════════════════════════════════════ */}
        <Route path="/shop/cart"
          element={<CartPage user={user} />}
        />

        {/* ══════════════════════════════════════════════
            ADMIN ROUTES
        ══════════════════════════════════════════════ */}
        <Route
          path="/admin"
          element={
            admin
              ? <Navigate to="/admin/dashboard" replace />
              : <Navigate to="/admin/login"     replace />
          }
        />
        <Route
          path="/admin/login"
          element={
            admin
              ? <Navigate to="/admin/dashboard" replace />
              : <AdminLogin setAdmin={setAdmin} />
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <AdminProtectedRoute>
              <AdminDashboard admin={admin} />
            </AdminProtectedRoute>
          }
        />

        {/* ══════════════════════════════════════════════
            FALLBACK
        ══════════════════════════════════════════════ */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </Router>
  );
}
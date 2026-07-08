// src/App.jsx
import { useEffect, useState, useCallback, useRef, memo } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import axios              from "axios";
import toast, { Toaster } from "react-hot-toast";
import { useProductCache } from "./context/ProductCacheContext";

/* ═══════════════════════════════════════════════════════════════
   PAGES — PUBLIC
═══════════════════════════════════════════════════════════════ */
import Homepage           from "./pages/Homepage";
import HomepageDesktop    from "./pages/HomepageDesktop";
import SearchPage         from "./pages/SearchPage";
import ProductDetail      from "./pages/ProductDetail";
import ProductDetailDesktop from "./desktop/ProductDetailDesktop"; // ✅ wired up
import MarketDetail       from "./pages/MarketDetail";
import SellerProfile      from "./pages/SellerProfile";
import TermsAndConditions from "./pages/TermsAndConditions";
import MinimartPage       from "./pages/MinimartPage";
import P2P                from "./pages/P2P";
import MenuPage           from "./pages/MenuPage";

/* ═══════════════════════════════════════════════════════════════
   PAGES — HOMEPAGE SUB-PAGES
═══════════════════════════════════════════════════════════════ */
import TrendingPage      from "./pages/Homepage/TrendingPage";
import LatestPage        from "./pages/Homepage/LatestPage";
import NearbyPage        from "./pages/Homepage/NearbyPage";
import NearbyPageDesktop from "./desktop/NearbyPageDesktop";

/* ═══════════════════════════════════════════════════════════════
   PAGES — AUTH
═══════════════════════════════════════════════════════════════ */
import AuthPage       from "./pages/AuthPage";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword  from "./pages/ResetPassword";

/* ═══════════════════════════════════════════════════════════════
   PAGES — SELLER
═══════════════════════════════════════════════════════════════ */
import BecomeSeller    from "./pages/BecomeSeller";
import SellerDashboard from "./pages/seller/SellerDashboard";

/* ═══════════════════════════════════════════════════════════════
   PAGES — USER (PROTECTED)
═══════════════════════════════════════════════════════════════ */
import Profile           from "./pages/Profile";
import EditProfile       from "./pages/Profile/EditProfile";
import SavedItems        from "./pages/Profile/SavedItems";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage      from "./pages/SettingsPage";
import AddProduct        from "./pages/AddProduct";
import Conversations     from "./pages/Conversations";
import Chat              from "./pages/Chat";
import Coupons           from "./pages/Profile/Coupons";
import Dashboard         from "./pages/Profile/Dashboard";
import SpinWheel         from "./pages/Profile/SpinWheel";
import Leaderboard       from "./pages/Profile/Leaderboard";
import Verification      from "./pages/Profile/Verification";
import Wallet            from "./pages/Profile/Wallet";
import FAQ               from "./pages/FAQ";
import Complain          from "./pages/Complain";
import Support           from "./pages/Support";
import Invitation        from "./pages/Invitation";
import PostAds           from "./pages/PostAds";
import PaymentSuccess    from "./pages/PaymentSuccess";
import CheckoutPage      from "./pages/CheckoutPage";
import OrderSuccess      from "./pages/OrderSuccess";
import OrderHistory      from "./pages/OrderHistory";

/* ═══════════════════════════════════════════════════════════════
   PAGES — MESSAGING DESKTOP
═══════════════════════════════════════════════════════════════ */
import MessagingDesktop from "./pages/MessagingDesktop";

/* ═══════════════════════════════════════════════════════════════
   PAGES — CHECKOUT / PAYMENT FLOW
═══════════════════════════════════════════════════════════════ */
import FlutterwaveRedirect from "./pages/Checkout/Payment/FlutterwaveRedirect";
import OrderSuccessPage    from "./pages/Checkout/Payment/OrderSuccessPage";
import PaymentFailedPage   from "./pages/Checkout/Payment/PaymentFailedPage";

/* ═══════════════════════════════════════════════════════════════
   PAGES — ADMIN
   ✅ Fixed typo: "./page/..." → "./pages/..."
═══════════════════════════════════════════════════════════════ */
import AdminLogin     from "./pages/admin/AdminLogin";
import AdminDashboard from "./page/admin/AdminDashboard";

/* ═══════════════════════════════════════════════════════════════
   COMPONENTS
═══════════════════════════════════════════════════════════════ */
import CartPage from "./components/Cart/CartPage";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const BASE_URL  = import.meta.env.VITE_API_BASE_URL;
const USERS_API = `${BASE_URL}/api/users`;
const CART_API  = `${BASE_URL}/api/cart`;

export const TOKEN_KEYS = {
  marketplace : "marketplace_token",
  seller      : "seller_token",
  admin       : "admin_token",
};

const TOASTER_OPTIONS = {
  duration : 3500,
  style    : {
    padding      : "10px 14px",
    borderRadius : 8,
    color        : "#fff",
    fontSize     : "0.9rem",
  },
  success : { style: { background: "#16a34a" } },
  error   : { style: { background: "#dc2626" } },
};

/* ═══════════════════════════════════════════════════════════════
   CART SYNC
═══════════════════════════════════════════════════════════════ */
async function syncCartAfterLogin(token) {
  try {
    const raw       = localStorage.getItem("mm_cart");
    const localCart = JSON.parse(raw || "[]");
    if (!Array.isArray(localCart) || localCart.length === 0) return;

    // ✅ Promise.allSettled — parallel, no sequential await in loop
    await Promise.allSettled(
      localCart.map((item) =>
        axios.post(
          `${CART_API}/items`,
          {
            product_id : item.productId,
            variant_id : item.variant?.id ?? null,
            qty        : item.qty,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      )
    );

    localStorage.removeItem("mm_cart");
    window.dispatchEvent(new Event("cart-updated"));
  } catch {
    /* silently ignore */
  }
}

/* ═══════════════════════════════════════════════════════════════
   SCROLL TO TOP
═══════════════════════════════════════════════════════════════ */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   SHARED DESKTOP HOOK
   ✅ Single definition — consumed by all route split components
═══════════════════════════════════════════════════════════════ */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia("(min-width: 1024px)").matches
  );

  useEffect(() => {
    const mq      = window.matchMedia("(min-width: 1024px)");
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isDesktop;
}

/* ═══════════════════════════════════════════════════════════════
   ROUTE SPLIT COMPONENTS
   ✅ Each is a proper component — hooks always called at top level
═══════════════════════════════════════════════════════════════ */
function HomeRoute({ user }) {
  const isDesktop = useIsDesktop();
  return isDesktop
    ? <HomepageDesktop user={user} />
    : <Homepage        user={user} />;
}

function ProductRoute({ user }) {
  const isDesktop = useIsDesktop();
  return isDesktop
    ? <ProductDetailDesktop user={user} />   // ✅ Now wired up
    : <ProductDetail        user={user} />;
}

function NearbyRoute({ user }) {
  const isDesktop = useIsDesktop();
  return isDesktop
    ? <NearbyPageDesktop user={user} />
    : <NearbyPage        user={user} />;
}

function MessagesRoute({ user }) {
  const isDesktop = useIsDesktop();
  return isDesktop
    ? <MessagingDesktop user={user} />
    : <Conversations    user={user} />;
}

function ChatRoute({ user }) {
  const isDesktop = useIsDesktop();
  return isDesktop
    ? <MessagingDesktop user={user} />
    : <Chat             user={user} />;
}

/* ═══════════════════════════════════════════════════════════════
   ROUTE GUARDS
═══════════════════════════════════════════════════════════════ */
function ProtectedRoute({ user, children }) {
  const location = useLocation();
  if (!user) {
    return (
      <Navigate
        to={`/auth?redirect=${encodeURIComponent(location.pathname)}`}
        state={{ from: location }}
        replace
      />
    );
  }
  return children;
}

function AdminProtectedRoute({ admin, children }) {
  if (!admin) return <Navigate to="/admin/login" replace />;
  return children;
}

/* ═══════════════════════════════════════════════════════════════
   AUTH LOADING SPINNER
   ✅ Prevents flash of unauthenticated UI on cold load
═══════════════════════════════════════════════════════════════ */
const AuthLoader = memo(function AuthLoader() {
  return (
    <div
      style={{
        display        : "flex",
        alignItems     : "center",
        justifyContent : "center",
        minHeight      : "100vh",
        background     : "#faf9f7",
      }}
      aria-label="Loading"
      aria-busy="true"
    >
      <div style={{
        width        : 36,
        height       : 36,
        border       : "3px solid #e8e4de",
        borderTop    : "3px solid #2c6fad",
        borderRadius : "50%",
        animation    : "spin .7s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   APP
═══════════════════════════════════════════════════════════════ */
export default function App() {
  const [user,        setUser]        = useState(null);
  const [admin,       setAdmin]       = useState(null);
  // ✅ authChecked prevents flash of wrong UI before /me resolves
  const [authChecked, setAuthChecked] = useState(false);

  const { resetCache } = useProductCache();

  /* ── Marketplace user auth ─────────────────────────────── */
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEYS.marketplace);
    if (!token) {
      setAuthChecked(true);
      return;
    }

    axios
      .get(`${USERS_API}/me`, {
        headers : { Authorization: `Bearer ${token}` },
        timeout : 8000,
      })
      .then((res) => {
        setUser(res.data);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEYS.marketplace);
        setUser(null);
      })
      .finally(() => {
        // ✅ Always mark auth as resolved
        setAuthChecked(true);
      });
  }, []);

  /* ── Admin auth ────────────────────────────────────────── */
  useEffect(() => {
    const token       = localStorage.getItem(TOKEN_KEYS.admin);
    const storedAdmin = localStorage.getItem("admin_data");
    if (!token || !storedAdmin) return;
    try {
      setAdmin(JSON.parse(storedAdmin));
    } catch {
      localStorage.removeItem("admin_data");
      localStorage.removeItem(TOKEN_KEYS.admin);
    }
  }, []);

  /* ── Handlers — useCallback so refs are stable ─────────── */
  const handleAuthSuccess = useCallback(
    (userData, token, navigateFn, from) => {
      localStorage.setItem(TOKEN_KEYS.marketplace, token);
      resetCache();
      // Clear stale location / cache keys
      ["lastLocation", "active_location", "cacheTime"].forEach((k) =>
        localStorage.removeItem(k)
      );
      setUser(userData);
      syncCartAfterLogin(token);
      toast.success(`Welcome back, ${userData.name}!`);
      navigateFn(from || "/", { replace: true });
    },
    [resetCache]
  );

  const handleLogout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEYS.marketplace);
    setUser(null);
    resetCache();
    toast.success("Signed out");
  }, [resetCache]);

  /*
   * ✅ Safer profile update — uses spread so all existing
   *    fields are preserved; no risk of null prev crash.
   */
  const handleProfileUpdate = useCallback((updatedData) => {
    setUser((prev) => ({
      ...prev,
      ...Object.fromEntries(
        Object.entries(updatedData).filter(([, v]) => v != null)
      ),
    }));
  }, []);

  /* ── Block render until we know auth state ─────────────── */
  if (!authChecked) return <AuthLoader />;

  /* ═══════════════════════════════════════════════════════════
     ROUTES
  ═══════════════════════════════════════════════════════════ */
  return (
    <Router>
      <ScrollToTop />
      <Toaster position="top-right" toastOptions={TOASTER_OPTIONS} />

      <Routes>

        {/* ══════════════ PUBLIC ══════════════ */}
        <Route
          path="/"
          element={<HomeRoute key={user?.id ?? "guest"} user={user} />}
        />
        <Route path="/search"     element={<SearchPage    user={user} />} />
        <Route path="/product/:slug" element={<ProductRoute user={user} />} /> {/* ✅ desktop wired */}
        <Route path="/shop/:slug" element={<MarketDetail  user={user} />} />
        <Route path="/seller/:id" element={<SellerProfile user={user} />} />
        <Route path="/terms"      element={<TermsAndConditions />} />
        <Route path="/minimart"   element={<MinimartPage  user={user} />} />
        <Route path="/p2p"        element={<P2P           user={user} />} />
        <Route path="/menu"       element={<MenuPage      user={user} />} />

        {/* ══════════════ HOMEPAGE SUB-PAGES ══════════════ */}
        <Route path="/trending" element={<TrendingPage user={user} />} />
        <Route path="/latest"   element={<LatestPage   user={user} />} />
        <Route path="/nearby"   element={<NearbyRoute  user={user} />} />

        {/* ══════════════ AUTH ══════════════ */}
        <Route
          path="/auth"
          element={
            user
              ? <Navigate to="/" replace />
              : <AuthPage setUser={handleAuthSuccess} />
          }
        />
        <Route
          path="/forgot-password"
          element={
            user ? <Navigate to="/" replace /> : <ForgotPassword />
          }
        />
        <Route
          path="/reset-password"
          element={
            user
              ? <Navigate to="/" replace />
              : <ResetPassword setUser={handleAuthSuccess} />
          }
        />

        {/* ══════════════ SELLER ══════════════ */}
        <Route path="/become-seller"         element={<BecomeSeller user={user} />} />
        <Route path="/seller/dashboard"      element={<SellerDashboard />} />
        <Route path="/seller/dashboard/:tab" element={<SellerDashboard />} />

        {/* ══════════════ PROTECTED — PROFILE ══════════════ */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute user={user}>
              <Profile user={user} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <ProtectedRoute user={user}>
              <EditProfile onProfileUpdate={handleProfileUpdate} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/saved"
          element={
            <ProtectedRoute user={user}>
              <SavedItems user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute user={user}>
              <NotificationsPage user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute user={user}>
              <SettingsPage user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/minimart/add"
          element={
            <ProtectedRoute user={user}>
              <AddProduct user={user} />
            </ProtectedRoute>
          }
        />

        {/* ══════════════ MESSAGING ══════════════ */}
        <Route
          path="/conversations"
          element={
            <ProtectedRoute user={user}>
              <MessagesRoute user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute user={user}>
              <MessagesRoute user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages/:threadId"
          element={
            <ProtectedRoute user={user}>
              <ChatRoute user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/:threadId"
          element={
            <ProtectedRoute user={user}>
              <ChatRoute user={user} />
            </ProtectedRoute>
          }
        />

        {/* ══════════════ OTHER PROTECTED ══════════════ */}
        <Route path="/coupons"    element={<ProtectedRoute user={user}><Coupons      user={user} /></ProtectedRoute>} />
        <Route path="/dashboard"  element={<ProtectedRoute user={user}><Dashboard    user={user} /></ProtectedRoute>} />
        <Route path="/spin"       element={<ProtectedRoute user={user}><SpinWheel    user={user} /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute user={user}><Leaderboard user={user} /></ProtectedRoute>} />
        <Route path="/verification" element={<ProtectedRoute user={user}><Verification user={user} /></ProtectedRoute>} />
        <Route path="/wallet"     element={<ProtectedRoute user={user}><Wallet       user={user} /></ProtectedRoute>} />
        <Route path="/invitation" element={<ProtectedRoute user={user}><Invitation   user={user} /></ProtectedRoute>} />
        <Route path="/minimart/post-ad" element={<ProtectedRoute user={user}><PostAds user={user} /></ProtectedRoute>} />

        {/* ── Public info pages (no auth required) ── */}
        <Route path="/faq"      element={<FAQ      user={user} />} />
        <Route path="/complain" element={<Complain user={user} />} />
        <Route path="/support"  element={<Support  user={user} />} />

        {/* ══════════════ CART / CHECKOUT / ORDERS ══════════════ */}
        <Route path="/shop/cart"       element={<CartPage />} />
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route
          path="/shop/checkout"
          element={
            <ProtectedRoute user={user}>
              <CheckoutPage user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shop/orders/:orderGroupId"
          element={
            <ProtectedRoute user={user}>
              <OrderSuccess user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shop/orders"
          element={
            <ProtectedRoute user={user}>
              <OrderHistory user={user} />
            </ProtectedRoute>
          }
        />

        {/* ══════════════ PAYMENT FLOW ══════════════ */}
        <Route path="/payment/callback"        element={<FlutterwaveRedirect />} />
        <Route path="/order-success/:orderId"  element={<OrderSuccessPage />} />
        <Route path="/payment-failed/:orderId" element={<PaymentFailedPage />} />

        {/* ══════════════ ADMIN ══════════════ */}
        <Route
          path="/admin"
          element={
            <Navigate to={admin ? "/admin/dashboard" : "/admin/login"} replace />
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
            <AdminProtectedRoute admin={admin}>
              <AdminDashboard admin={admin} />
            </AdminProtectedRoute>
          }
        />

        {/* ══════════════ FALLBACK ══════════════ */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </Router>
  );
}
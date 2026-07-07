// src/App.jsx
import { useEffect, useState } from "react";
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
import MarketDetail       from "./pages/MarketDetail";
import SellerProfile      from "./pages/SellerProfile";
import TermsAndConditions from "./pages/TermsAndConditions";
import MinimartPage       from "./pages/MinimartPage";
import P2P                from "./pages/P2P";
import MenuPage           from "./pages/MenuPage";

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
   PAGES — ADMIN (note: folder is "page" not "pages")
═══════════════════════════════════════════════════════════════ */
import AdminLogin     from "./pages/admin/AdminLogin";
import AdminDashboard from "./page/admin/AdminDashboard";

/* ═══════════════════════════════════════════════════════════════
   COMPONENTS
═══════════════════════════════════════════════════════════════ */
import CartPage from "./components/Cart/CartPage";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
var BASE_URL  = import.meta.env.VITE_API_BASE_URL;
var USERS_API = BASE_URL + "/api/users";
var CART_API  = BASE_URL + "/api/cart";

/* ═══════════════════════════════════════════════════════════════
   TOKEN KEYS
═══════════════════════════════════════════════════════════════ */
export var TOKEN_KEYS = {
  marketplace : "marketplace_token",
  seller      : "seller_token",
  admin       : "admin_token",
};

/* ═══════════════════════════════════════════════════════════════
   TOASTER CONFIG
═══════════════════════════════════════════════════════════════ */
var TOASTER_OPTIONS = {
  duration : 3500,
  style : {
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
    var raw = localStorage.getItem("mm_cart");
    var localCart = JSON.parse(raw || "[]");
    if (!Array.isArray(localCart) || localCart.length === 0) return;

    for (var i = 0; i < localCart.length; i++) {
      var item = localCart[i];
      try {
        await axios.post(
          CART_API + "/items",
          {
            product_id : item.productId,
            variant_id : (item.variant && item.variant.id) ? item.variant.id : null,
            qty        : item.qty,
          },
          { headers: { Authorization: "Bearer " + token } }
        );
      } catch (e) {
        /* one bad item should not block the rest */
      }
    }

    localStorage.removeItem("mm_cart");
    window.dispatchEvent(new Event("cart-updated"));
  } catch (e) {
    /* silently ignore — cart sync is best-effort */
  }
}

/* ═══════════════════════════════════════════════════════════════
   SCROLL TO TOP ON ROUTE CHANGE
═══════════════════════════════════════════════════════════════ */
function ScrollToTop() {
  var location = useLocation();
  useEffect(function () {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   DESKTOP / MOBILE HOMEPAGE SPLIT
═══════════════════════════════════════════════════════════════ */
function useIsDesktop() {
  var result = useState(function () {
    return window.matchMedia("(min-width: 1024px)").matches;
  });
  var desktop = result[0];
  var setDesktop = result[1];

  useEffect(function () {
    var mq = window.matchMedia("(min-width: 1024px)");
    function fn(e) { setDesktop(e.matches); }
    mq.addEventListener("change", fn);
    return function () { mq.removeEventListener("change", fn); };
  }, []);

  return desktop;
}

function HomeRoute(props) {
  var isDesktop = useIsDesktop();
  if (isDesktop) return <HomepageDesktop user={props.user} />;
  return <Homepage user={props.user} />;
}

/* ═══════════════════════════════════════════════════════════════
   DESKTOP / MOBILE MESSAGING SPLIT
═══════════════════════════════════════════════════════════════ */
function MessagesRoute(props) {
  var isDesktop = useIsDesktop();
  if (isDesktop) return <MessagingDesktop user={props.user} />;
  return <Conversations user={props.user} />;
}

function ChatRoute(props) {
  var isDesktop = useIsDesktop();
  if (isDesktop) return <MessagingDesktop user={props.user} />;
  return <Chat user={props.user} />;
}

/* ═══════════════════════════════════════════════════════════════
   ROUTE GUARDS
═══════════════════════════════════════════════════════════════ */
function ProtectedRoute(props) {
  var location = useLocation();
  if (!props.user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  return props.children;
}

function AdminProtectedRoute(props) {
  if (!props.admin) return <Navigate to="/admin/login" replace />;
  return props.children;
}

/* ═══════════════════════════════════════════════════════════════
   APP
═══════════════════════════════════════════════════════════════ */
export default function App() {
  var userState = useState(null);
  var user = userState[0];
  var setUser = userState[1];

  var adminState = useState(null);
  var admin = adminState[0];
  var setAdmin = adminState[1];

  var loadingUserState = useState(true);
  var loadingUser = loadingUserState[0];
  var setLoadingUser = loadingUserState[1];

  var loadingAdminState = useState(true);
  var loadingAdmin = loadingAdminState[0];
  var setLoadingAdmin = loadingAdminState[1];

  var slowState = useState(false);
  var slowServer = slowState[0];
  var setSlowServer = slowState[1];

  var cache = useProductCache();
  var resetCache = cache.resetCache;

  /* ── Marketplace user auth ── */
  useEffect(function () {
    var token = localStorage.getItem(TOKEN_KEYS.marketplace);
    if (!token) { setLoadingUser(false); return; }

    axios
      .get(USERS_API + "/me", {
        headers : { Authorization: "Bearer " + token },
        timeout : 8000,
      })
      .then(function (res) {
        setUser(res.data);
      })
      .catch(function () {
        localStorage.removeItem(TOKEN_KEYS.marketplace);
        setUser(null);
      })
      .finally(function () { setLoadingUser(false); });
  }, []);

  /* ── Admin auth (local only) ── */
  useEffect(function () {
    var token = localStorage.getItem(TOKEN_KEYS.admin);
    var storedAdmin = localStorage.getItem("admin_data");
    if (!token || !storedAdmin) { setLoadingAdmin(false); return; }
    try {
      setAdmin(JSON.parse(storedAdmin));
    } catch (e) {
      localStorage.removeItem("admin_data");
      localStorage.removeItem(TOKEN_KEYS.admin);
    } finally {
      setLoadingAdmin(false);
    }
  }, []);

  /* ── Slow-server hint after 5s ── */
  useEffect(function () {
    if (!loadingUser && !loadingAdmin) return;
    var timer = setTimeout(function () { setSlowServer(true); }, 5000);
    return function () { clearTimeout(timer); };
  }, [loadingUser, loadingAdmin]);

  /* ── Loading screen ── */
  if (loadingUser || loadingAdmin) {
    return (
      <div className="global-loader">
        <div className="logo">Loemart</div>
        <div className="spinner" />
        <p>{slowServer ? "Waking up server… please wait" : "Loading Loemart…"}</p>
      </div>
    );
  }

  /* ── Marketplace login handler ── */
  function handleAuthSuccess(userData, token, navigateFn, from) {
    localStorage.setItem(TOKEN_KEYS.marketplace, token);
    resetCache();
    localStorage.removeItem("lastLocation");
    localStorage.removeItem("active_location");
    localStorage.removeItem("cacheTime");
    setUser(userData);
    syncCartAfterLogin(token);
    toast.success("Welcome back, " + userData.name + "!");
    navigateFn(from || "/", { replace: true });
  }

  /* ── Logout handler ── */
  function handleLogout() {
    localStorage.removeItem(TOKEN_KEYS.marketplace);
    setUser(null);
    resetCache();
    toast.success("Signed out");
  }

  /* ── Profile update handler ── */
  function handleProfileUpdate(updatedData) {
    setUser(function (prev) {
      return {
        name:           updatedData.name           != null ? updatedData.name           : (prev && prev.name),
        profile_image:  updatedData.profile_image  != null ? updatedData.profile_image  : (prev && prev.profile_image),
        username:       updatedData.username        != null ? updatedData.username        : (prev && prev.username),
        store_name:     updatedData.store_name      != null ? updatedData.store_name      : (prev && prev.store_name),
        email_verified: updatedData.email_verified  != null ? updatedData.email_verified  : (prev && prev.email_verified),
        id:             prev && prev.id,
        email:          prev && prev.email,
      };
    });
  }

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <Router>
      <ScrollToTop />
      <Toaster position="top-right" toastOptions={TOASTER_OPTIONS} />

      <Routes>

        {/* ══════════════ PUBLIC ══════════════ */}
        <Route path="/" element={
          <HomeRoute key={user ? user.id : "guest"} user={user} />
        } />
        <Route path="/search"        element={<SearchPage    user={user} />} />
        <Route path="/product/:slug" element={<ProductDetail user={user} />} />
        <Route path="/shop/:slug"    element={<MarketDetail  user={user} />} />
        <Route path="/seller/:id"    element={<SellerProfile user={user} />} />
        <Route path="/terms"         element={<TermsAndConditions />} />
        <Route path="/minimart"      element={<MinimartPage  user={user} />} />
        <Route path="/p2p"           element={<P2P           user={user} />} />
        <Route path="/menu"          element={<MenuPage      user={user} />} />

        {/* ══════════════ AUTH ══════════════ */}
        <Route path="/auth" element={
          user
            ? <Navigate to="/" replace />
            : <AuthPage setUser={handleAuthSuccess} />
        } />
        <Route path="/forgot-password" element={
          user
            ? <Navigate to="/" replace />
            : <ForgotPassword />
        } />
        <Route path="/reset-password" element={
          user
            ? <Navigate to="/" replace />
            : <ResetPassword setUser={handleAuthSuccess} />
        } />

        {/* ══════════════ SELLER ══════════════ */}
        <Route path="/become-seller"         element={<BecomeSeller user={user} />} />
        <Route path="/seller/dashboard"      element={<SellerDashboard />} />
        <Route path="/seller/dashboard/:tab" element={<SellerDashboard />} />

        {/* ══════════════ PROTECTED — USER ══════════════ */}
        <Route path="/profile" element={
          <ProtectedRoute user={user}>
            <Profile user={user} onLogout={handleLogout} />
          </ProtectedRoute>
        } />

        <Route path="/profile/edit" element={
          <ProtectedRoute user={user}>
            <EditProfile onProfileUpdate={handleProfileUpdate} />
          </ProtectedRoute>
        } />

        <Route path="/saved" element={
          <ProtectedRoute user={user}>
            <SavedItems user={user} />
          </ProtectedRoute>
        } />

        <Route path="/notifications" element={
          <ProtectedRoute user={user}>
            <NotificationsPage user={user} />
          </ProtectedRoute>
        } />

        <Route path="/settings" element={
          <ProtectedRoute user={user}>
            <SettingsPage user={user} />
          </ProtectedRoute>
        } />

        <Route path="/minimart/add" element={
          <ProtectedRoute user={user}>
            <AddProduct user={user} />
          </ProtectedRoute>
        } />

        {/* ══════════════ MESSAGING ══════════════ */}
        <Route path="/conversations" element={
          <ProtectedRoute user={user}>
            <MessagesRoute user={user} />
          </ProtectedRoute>
        } />

        <Route path="/messages" element={
          <ProtectedRoute user={user}>
            <MessagesRoute user={user} />
          </ProtectedRoute>
        } />

        <Route path="/messages/:threadId" element={
          <ProtectedRoute user={user}>
            <ChatRoute user={user} />
          </ProtectedRoute>
        } />

        <Route path="/chat/:threadId" element={
          <ProtectedRoute user={user}>
            <ChatRoute user={user} />
          </ProtectedRoute>
        } />

        {/* ══════════════ OTHER PROTECTED ══════════════ */}
        <Route path="/coupons" element={
          <ProtectedRoute user={user}>
            <Coupons user={user} />
          </ProtectedRoute>
        } />

        <Route path="/dashboard" element={
          <ProtectedRoute user={user}>
            <Dashboard user={user} />
          </ProtectedRoute>
        } />

        <Route path="/spin" element={
          <ProtectedRoute user={user}>
            <SpinWheel user={user} />
          </ProtectedRoute>
        } />

        <Route path="/leaderboard" element={
          <ProtectedRoute user={user}>
            <Leaderboard user={user} />
          </ProtectedRoute>
        } />

        <Route path="/verification" element={
          <ProtectedRoute user={user}>
            <Verification user={user} />
          </ProtectedRoute>
        } />

        <Route path="/wallet" element={
          <ProtectedRoute user={user}>
            <Wallet user={user} />
          </ProtectedRoute>
        } />

        <Route path="/faq" element={
          <ProtectedRoute user={user}>
            <FAQ user={user} />
          </ProtectedRoute>
        } />

        <Route path="/complain" element={
          <ProtectedRoute user={user}>
            <Complain user={user} />
          </ProtectedRoute>
        } />

        <Route path="/support" element={
          <ProtectedRoute user={user}>
            <Support user={user} />
          </ProtectedRoute>
        } />

        <Route path="/invitation" element={
          <ProtectedRoute user={user}>
            <Invitation user={user} />
          </ProtectedRoute>
        } />

        <Route path="/minimart/post-ad" element={
          <ProtectedRoute user={user}>
            <PostAds user={user} />
          </ProtectedRoute>
        } />

        {/* ══════════════ CART / CHECKOUT / ORDERS ══════════════ */}
        <Route path="/shop/cart"       element={<CartPage />} />
        <Route path="/payment/success" element={<PaymentSuccess />} />

        <Route path="/shop/checkout" element={
          <ProtectedRoute user={user}>
            <CheckoutPage user={user} />
          </ProtectedRoute>
        } />

        <Route path="/shop/orders/:orderGroupId" element={
          <ProtectedRoute user={user}>
            <OrderSuccess user={user} />
          </ProtectedRoute>
        } />

        <Route path="/shop/orders" element={
          <ProtectedRoute user={user}>
            <OrderHistory user={user} />
          </ProtectedRoute>
        } />

        {/* ══════════════ PAYMENT FLOW ══════════════ */}
        <Route path="/payment/callback"        element={<FlutterwaveRedirect />} />
        <Route path="/order-success/:orderId"  element={<OrderSuccessPage />} />
        <Route path="/payment-failed/:orderId" element={<PaymentFailedPage />} />

        {/* ══════════════ ADMIN ══════════════ */}
        <Route path="/admin" element={
          admin
            ? <Navigate to="/admin/dashboard" replace />
            : <Navigate to="/admin/login" replace />
        } />
        <Route path="/admin/login" element={
          admin
            ? <Navigate to="/admin/dashboard" replace />
            : <AdminLogin setAdmin={setAdmin} />
        } />
        <Route path="/admin/dashboard" element={
          <AdminProtectedRoute admin={admin}>
            <AdminDashboard admin={admin} />
          </AdminProtectedRoute>
        } />

        {/* ══════════════ FALLBACK ══════════════ */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </Router>
  );
}
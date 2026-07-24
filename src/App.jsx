// ════════════════════════════════════════════════════════════
// FILE: App.jsx
// ════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback, memo, useRef } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import axios              from "axios";
import toast, { Toaster } from "react-hot-toast";
import { useProductCache } from "./context/ProductCacheContext";

/* ── Global design tokens ── */
import "./index.css";

/* ════════════════════════════════════════════════════════════
   THEME
════════════════════════════════════════════════════════════ */
const THEME_KEY = "loemart_theme";

const getSystemTheme = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const applyTheme = (theme) => {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.setAttribute("data-theme", resolved);
};

applyTheme(
  (() => {
    try { return localStorage.getItem(THEME_KEY) ?? "system"; }
    catch { return "system"; }
  })()
);

/* ════════════════════════════════════════════════════════════
   PAGES — PUBLIC
════════════════════════════════════════════════════════════ */
import Homepage             from "./pages/Homepage";
import HomepageDesktop      from "./pages/HomepageDesktop";
import SearchPage           from "./pages/SearchPage";
import ProductDetail        from "./pages/ProductDetail";
import ProductDetailDesktop from "./desktop/ProductDetailDesktop";
import MarketDetail         from "./pages/MarketDetail";
import SellerProfile        from "./pages/SellerProfile";
import TermsAndConditions   from "./pages/TermsAndConditions";
import MinimartPage         from "./pages/MinimartPage";
import P2P                  from "./pages/P2P";
import MenuPage             from "./pages/MenuPage";

/* ════════════════════════════════════════════════════════════
   PAGES — LEGAL
════════════════════════════════════════════════════════════ */
import CommunityGuidelines from "./pages/CommunityGuidelines/CommunityGuidelines";
import PrivacyPolicy       from "./pages/PrivacyPolicy/PrivacyPolicy";
import HallOfFame          from "./pages/HallOfFame";

/* ════════════════════════════════════════════════════════════
   PAGES — HOMEPAGE SUB-PAGES
════════════════════════════════════════════════════════════ */
import TrendingPage      from "./pages/Homepage/TrendingPage";
import LatestPage        from "./pages/Homepage/LatestPage";
import NearbyPage        from "./pages/Homepage/NearbyPage";
import NearbyPageDesktop from "./desktop/NearbyPageDesktop";
import DealsPage         from "./pages/Homepage/DealsPage";

/* ════════════════════════════════════════════════════════════
   PAGES — AUTH
════════════════════════════════════════════════════════════ */
import AuthPage       from "./pages/AuthPage";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword  from "./pages/ResetPassword";

/* ════════════════════════════════════════════════════════════
   PAGES — SELLER
════════════════════════════════════════════════════════════ */
import BecomeSeller    from "./pages/BecomeSeller";
import SellerDashboard from "./pages/seller/SellerDashboard";

/* ════════════════════════════════════════════════════════════
   PAGES — SUBSCRIPTION
════════════════════════════════════════════════════════════ */
import Subscription        from "./pages/Subscription/Subscription";
import Plans               from "./pages/Subscription/Plans";
import Payment             from "./pages/Subscription/Payment";
import DesktopSubscription from "./desktop/Subscription/DesktopSubscription";
import DesktopPlans        from "./desktop/Subscription/DesktopPlans";

/* ════════════════════════════════════════════════════════════
   PAGES — USER (PROTECTED)
════════════════════════════════════════════════════════════ */
import Profile           from "./pages/Profile";
import EditProfile       from "./pages/Profile/EditProfile";
import SavedItems        from "./pages/Profile/SavedItems";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage      from "./pages/SettingsPage";
import AddProduct        from "./pages/AddProduct";
import Conversations     from "./pages/Conversations";
import Chat              from "./pages/Chat";
import Coupons           from "./pages/Profile/Coupons";
import AirtimeCoupons    from "./pages/Profile/AirtimeCoupons";
import Dashboard         from "./pages/Profile/Dashboard";
import SpinWheel         from "./pages/Profile/SpinWheel";
import Leaderboard       from "./pages/Profile/Leaderboard";
import Verification      from "./pages/Profile/Verification";
import Wallet            from "./pages/Profile/Wallet";
import FAQ               from "./pages/FAQ";
import Invitation        from "./pages/Invitation";
import PostAds           from "./pages/PostAds";
import PaymentSuccess    from "./pages/PaymentSuccess";
import CheckoutPage      from "./pages/CheckoutPage";
import OrderSuccess      from "./pages/OrderSuccess";
import OrderHistory      from "./pages/OrderHistory";

/* ════════════════════════════════════════════════════════════
   PAGES — HELP & SUPPORT
════════════════════════════════════════════════════════════ */
import HelpCenter          from "./pages/Help/HelpCenter";
import HelpSearchResults   from "./pages/Help/HelpSearchResults";
import HelpCategoryPage    from "./pages/Help/HelpCategoryPage";
import HelpArticleDetail   from "./pages/Help/HelpArticleDetail";
import SupportHub          from "./pages/Support/SupportHub";
import ContactSupport      from "./pages/Support/ContactSupport";
import SupportTickets      from "./pages/Support/SupportTickets";
import SupportTicketDetail from "./pages/Support/SupportTicketDetail";
import ReportCenter        from "./pages/Support/ReportCenter";
import DisputeCenter       from "./pages/Support/DisputeCenter";
import AppealsPage         from "./pages/Support/AppealsPage";
import FeedbackPage        from "./pages/Support/FeedbackPage";

/* ════════════════════════════════════════════════════════════
   PAGES — DESKTOP
════════════════════════════════════════════════════════════ */
import LeaderboardDesktop from "./desktop/LeaderboardDesktop";
import DesktopProfile     from "./desktop/Profile";
import CouponsDesktop     from "./desktop/CouponsDesktop";
import MessagingDesktop   from "./pages/MessagingDesktop";

/* ════════════════════════════════════════════════════════════
   PAGES — CHECKOUT / PAYMENT
════════════════════════════════════════════════════════════ */
import FlutterwaveRedirect from "./pages/Checkout/Payment/FlutterwaveRedirect";
import OrderSuccessPage    from "./pages/Checkout/Payment/OrderSuccessPage";
import PaymentFailedPage   from "./pages/Checkout/Payment/PaymentFailedPage";

/* ════════════════════════════════════════════════════════════
   PAGES — ADMIN
════════════════════════════════════════════════════════════ */
import AdminLogin       from "./pages/admin/AdminLogin";
import AdminDashboard   from "./page/admin/AdminDashboard";
import ManagerDashboard from "./page/admin/Manager/ManagerDashboard";

/* ════════════════════════════════════════════════════════════
   COMPONENTS
════════════════════════════════════════════════════════════ */
import CartPage      from "./components/Cart/CartPage";
import DesktopHeader from "./components/DesktopHeader";

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */
const BASE_URL  = import.meta.env.VITE_API_BASE_URL;
const USERS_API = `${BASE_URL}/api/users`;
const CART_API  = `${BASE_URL}/api/cart`;
const FAVS_API  = `${BASE_URL}/api/favorites`;

export const TOKEN_KEYS = {
  marketplace : "marketplace_token",
  seller      : "seller_token",
  admin       : "admin_token",
};

const FAV_KEY = "loemart_favs";

const TOASTER_OPTIONS = {
  duration : 3500,
  style    : {
    padding      : "10px 14px",
    borderRadius : 8,
    color        : "#fff",
    fontSize     : "0.9rem",
    fontFamily   : "var(--fb)",
  },
  success : { style: { background: "#15803D" } },
  error   : { style: { background: "#DC2626" } },
};

/* ════════════════════════════════════════════════════════════
   HEADER HIDDEN ROUTES
════════════════════════════════════════════════════════════ */
const HEADER_HIDDEN_PREFIXES = [
  "/auth",
  "/forgot-password",
  "/reset-password",
  "/admin",
  "/invite/",
];

/* ════════════════════════════════════════════════════════════
   FAVOURITES
════════════════════════════════════════════════════════════ */
const loadFavs = () => {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || "{}"); }
  catch { return {}; }
};

const saveFavs = (f) => {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(f)); } catch {}
};

const syncFavouritesOnLogin = async (token, userId) => {
  if (!token || !userId) return;
  try {
    const res = await fetch(`${FAVS_API}/ids`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const { ids: dbIds = [] } = await res.json();
    const localFavs = loadFavs();
    const localIds  = Object.keys(localFavs);
    const dbIdSet   = new Set(dbIds);
    const guestOnly = localIds.filter((id) => !dbIdSet.has(id));
    const merged    = {};
    dbIds.forEach((id) => { merged[id] = true; });
    if (guestOnly.length > 0) {
      Promise.allSettled(
        guestOnly.map((productId) =>
          fetch(`${FAVS_API}/${productId}`, {
            method  : "POST",
            headers : {
              "Content-Type" : "application/json",
              Authorization  : `Bearer ${token}`,
            },
          }).then((r) => { if (r.ok) merged[productId] = true; })
        )
      ).catch(() => {});
    }
    saveFavs(merged);
  } catch {}
};

const clearFavouritesOnLogout = () => {
  try { localStorage.removeItem(FAV_KEY); } catch {}
};

/* ════════════════════════════════════════════════════════════
   CART SYNC
════════════════════════════════════════════════════════════ */
async function syncCartAfterLogin(token) {
  try {
    const raw       = localStorage.getItem("mm_cart");
    const localCart = JSON.parse(raw || "[]");
    if (!Array.isArray(localCart) || localCart.length === 0) return;
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
  } catch {}
}

/* ════════════════════════════════════════════════════════════
   AUTH STORAGE — clear every key the app might use
════════════════════════════════════════════════════════════ */
function clearAllAuthStorage() {
  localStorage.removeItem(TOKEN_KEYS.marketplace);
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("auth_user");
  sessionStorage.removeItem(TOKEN_KEYS.marketplace);
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
}

/* ════════════════════════════════════════════════════════════
   HOOKS
════════════════════════════════════════════════════════════ */
function useSystemThemeWatcher() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const saved = localStorage.getItem(THEME_KEY) ?? "system";
      if (saved === "system") applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

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

/* ════════════════════════════════════════════════════════════
   DESKTOP HEADER
════════════════════════════════════════════════════════════ */
function SiteHeader({ user, onLogout }) {
  const { pathname } = useLocation();
  const navigate     = useNavigate();
  const isDesktop    = useIsDesktop();
  if (!isDesktop) return null;
  const hidden = HEADER_HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));
  if (hidden) return null;
  return (
    <>
      <DesktopHeader
        user={user}
        onLogout={() => onLogout(navigate)}
      />
      <div className="dh-spacer" aria-hidden="true" />
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   RESPONSIVE ROUTES
════════════════════════════════════════════════════════════ */
function HomeRoute({ user }) {
  const isDesktop = useIsDesktop();
  return isDesktop
    ? <HomepageDesktop user={user} />
    : <Homepage        user={user} />;
}
function ProductRoute({ user }) {
  const isDesktop = useIsDesktop();
  return isDesktop
    ? <ProductDetailDesktop user={user} />
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
function LeaderboardRoute({ user }) {
  const isDesktop = useIsDesktop();
  return isDesktop
    ? <LeaderboardDesktop />
    : <Leaderboard user={user} />;
}
function ProfileRoute({ onLogout }) {
  const isDesktop = useIsDesktop();
  const navigate  = useNavigate();
  return isDesktop
    ? <DesktopProfile onLogout={() => onLogout(navigate)} />
    : <Profile        onLogout={() => onLogout(navigate)} />;
}
function SubscriptionRoute() {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DesktopSubscription /> : <Subscription />;
}
function PlansRoute() {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DesktopPlans /> : <Plans />;
}
function CouponsRoute({ user }) {
  const isDesktop = useIsDesktop();
  return isDesktop
    ? <CouponsDesktop user={user} />
    : <Coupons        user={user} />;
}

/* ════════════════════════════════════════════════════════════
   INVITE REDIRECT
════════════════════════════════════════════════════════════ */
function InviteRedirect() {
  const { code } = useParams();
  const safe = (code ?? "")
    .toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  if (!safe || safe.length < 4) return <Navigate to="/auth" replace />;
  return <Navigate to={`/auth?ref=${safe}`} replace />;
}

/* ════════════════════════════════════════════════════════════
   ROUTE GUARDS
════════════════════════════════════════════════════════════ */
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

function AuthGuestRoute({ user, redirectTo, children }) {
  const [params] = useSearchParams();
  if (user) {
    const target = redirectTo || params.get("redirect") || "/";
    return <Navigate to={target} replace />;
  }
  return children;
}

/* ════════════════════════════════════════════════════════════
   AUTH LOADER
════════════════════════════════════════════════════════════ */
const AuthLoader = memo(() => (
  <div
    style={{
      display        : "flex",
      alignItems     : "center",
      justifyContent : "center",
      minHeight      : "100vh",
      background     : "var(--bg)",
    }}
    role="status"
    aria-label="Loading"
    aria-busy="true"
  >
    <div
      style={{
        width        : 36,
        height       : 36,
        border       : "3px solid var(--bd)",
        borderTop    : "3px solid var(--o)",
        borderRadius : "50%",
        animation    : "spin .7s linear infinite",
      }}
    />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
));

/* ════════════════════════════════════════════════════════════
   APP
════════════════════════════════════════════════════════════ */
export default function App() {
  const [user,        setUser]        = useState(null);
  const [admin,       setAdmin]       = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const { resetCache }  = useProductCache();
  const loggingOutRef   = useRef(false);

  useSystemThemeWatcher();

  /* ── Auth check on mount ── */
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEYS.marketplace);
    if (!token) { setAuthChecked(true); return; }

    axios
      .get(`${USERS_API}/me`, {
        headers : { Authorization: `Bearer ${token}` },
        timeout : 8_000,
      })
      .then((res) => {
        if (loggingOutRef.current) return;
        setUser(res.data?.user ?? res.data);
        syncFavouritesOnLogin(token, (res.data?.user ?? res.data).id);
      })
      .catch(() => {
        clearAllAuthStorage();
        clearFavouritesOnLogout();
        setUser(null);
      })
      .finally(() => setAuthChecked(true));
  }, []);

  /* ── Admin ── */
  useEffect(() => {
    const token       = localStorage.getItem(TOKEN_KEYS.admin);
    const storedAdmin = localStorage.getItem("admin_data");
    if (!token || !storedAdmin) return;
    try { setAdmin(JSON.parse(storedAdmin)); } catch {
      localStorage.removeItem("admin_data");
      localStorage.removeItem(TOKEN_KEYS.admin);
    }
  }, []);

  /* ── Login success ── */
  const handleAuthSuccess = useCallback(
    (userData, token, navigateFn, from) => {
      localStorage.setItem(TOKEN_KEYS.marketplace, token);
      resetCache();
      ["lastLocation", "active_location", "cacheTime"].forEach((k) =>
        localStorage.removeItem(k)
      );
      setUser(userData);
      syncCartAfterLogin(token);
      syncFavouritesOnLogin(token, userData.id);
      toast.success(`Welcome back, ${userData.name}!`);
      navigateFn(from || "/", { replace: true });
    },
    [resetCache]
  );

  /* ════════════════════════════════════════════════════════
     LOGOUT
     ─────────────────────────────────────────────────────
     handleLogout(navigateFn)

     • navigateFn is the useNavigate() function from the
       calling component. Passing it in keeps navigation
       inside the Router context and avoids the "navigate
       called outside Router" error.

     • Every logout path (DangerZone, HamburgerMenu,
       DesktopHeader, ProfileRoute) calls this one function
       and always lands on /auth.
  ════════════════════════════════════════════════════════ */
  const handleLogout = useCallback(
    async (navigateFn) => {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;

      /* 1. Tell server — sets is_online = false (fire & forget) */
      const token = localStorage.getItem(TOKEN_KEYS.marketplace);
      if (token) {
        fetch(`${USERS_API}/me`, {
          method    : "DELETE",
          headers   : { Authorization: `Bearer ${token}` },
          keepalive : true,       // survives page unload
        }).catch(() => {});
      }

      /* 2. Wipe all local auth data */
      clearAllAuthStorage();

      /* 3. Reset React + cache state */
      setUser(null);
      resetCache();
      clearFavouritesOnLogout();

      toast.success("Signed out");

      /* 4. Navigate — always /auth, always replace so back
            button doesn't return to a protected page */
      if (typeof navigateFn === "function") {
        navigateFn("/auth", { replace: true });
      }

      setTimeout(() => { loggingOutRef.current = false; }, 100);
    },
    [resetCache]
  );

  /* ── Profile update ── */
  const handleProfileUpdate = useCallback((updatedData) => {
    setUser((prev) => ({
      ...prev,
      ...Object.fromEntries(
        Object.entries(updatedData).filter(([, v]) => v != null)
      ),
    }));
  }, []);

  if (!authChecked) return <AuthLoader />;

  return (
    <Router>
      <ScrollToTop />
      <Toaster position="top-right" toastOptions={TOASTER_OPTIONS} />
      <SiteHeader user={user} onLogout={handleLogout} />

      <Routes>
        {/* ── PUBLIC ── */}
        <Route path="/"
          element={<HomeRoute key={user?.id ?? "guest"} user={user} />} />
        <Route path="/search"
          element={<SearchPage    user={user} />} />
        <Route path="/product/:slug"
          element={<ProductRoute  user={user} />} />
        <Route path="/shop/:slug"
          element={<MarketDetail  user={user} />} />
        <Route path="/seller/:id"
          element={<SellerProfile user={user} />} />
        <Route path="/terms"
          element={<TermsAndConditions />} />
        <Route path="/minimart"
          element={<MinimartPage  user={user} />} />
        <Route path="/p2p"
          element={<P2P           user={user} />} />
        <Route path="/menu"
          element={<MenuPage      user={user} />} />
        <Route path="/privacy"
          element={<PrivacyPolicy />} />
        <Route path="/community-guidelines"
          element={<CommunityGuidelines />} />
        <Route path="/hall-of-fame"
          element={<HallOfFame />} />

        {/* ── HOMEPAGE SUB-PAGES ── */}
        <Route path="/trending"
          element={<TrendingPage user={user} />} />
        <Route path="/latest"
          element={<LatestPage   user={user} />} />
        <Route path="/nearby"
          element={<NearbyRoute  user={user} />} />
        <Route path="/deals"
          element={<DealsPage    user={user} />} />

        {/* ── AUTH (guests only) ── */}
        <Route
          path="/auth"
          element={
            <AuthGuestRoute user={user}>
              <AuthPage setUser={handleAuthSuccess} />
            </AuthGuestRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={user ? <Navigate to="/" replace /> : <ForgotPassword />}
        />
        <Route
          path="/reset-password"
          element={
            user
              ? <Navigate to="/" replace />
              : <ResetPassword setUser={handleAuthSuccess} />
          }
        />

        {/* ── INVITE ── */}
        <Route path="/invite/:code" element={<InviteRedirect />} />

        {/* ── SELLER ── */}
        <Route path="/become-seller"
          element={<BecomeSeller user={user} />} />
        <Route path="/seller/dashboard"
          element={<SellerDashboard />} />
        <Route path="/seller/dashboard/:tab"
          element={<SellerDashboard />} />

        {/* ── SUBSCRIPTION ── */}
        <Route path="/seller/subscription"
          element={
            <ProtectedRoute user={user}>
              <SubscriptionRoute />
            </ProtectedRoute>
          }
        />
        <Route path="/seller/subscription/plans"
          element={
            <ProtectedRoute user={user}>
              <PlansRoute />
            </ProtectedRoute>
          }
        />
        <Route path="/subscription/callback/paystack"
          element={<Payment />} />

        {/* ── PROFILE ── */}
        <Route path="/profile"
          element={
            <ProtectedRoute user={user}>
              <ProfileRoute onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route path="/profile/edit"
          element={
            <ProtectedRoute user={user}>
              <EditProfile onProfileUpdate={handleProfileUpdate} />
            </ProtectedRoute>
          }
        />
        <Route path="/saved"
          element={
            <ProtectedRoute user={user}>
              <SavedItems user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/notifications"
          element={
            <ProtectedRoute user={user}>
              <NotificationsPage user={user} />
            </ProtectedRoute>
          }
        />

        {/* ── SETTINGS — passes handleLogout so DangerZone
             can call handleLogout(navigate) ── */}
        <Route path="/settings"
          element={
            <ProtectedRoute user={user}>
              <SettingsPage
                user={user}
                onLogout={handleLogout}
              />
            </ProtectedRoute>
          }
        />

        <Route path="/minimart/add"
          element={
            <ProtectedRoute user={user}>
              <AddProduct user={user} />
            </ProtectedRoute>
          }
        />

        {/* ── MESSAGING ── */}
        <Route path="/conversations"
          element={
            <ProtectedRoute user={user}>
              <MessagesRoute user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/messages"
          element={
            <ProtectedRoute user={user}>
              <MessagesRoute user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/messages/:threadId"
          element={
            <ProtectedRoute user={user}>
              <ChatRoute user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/chat/:threadId"
          element={
            <ProtectedRoute user={user}>
              <ChatRoute user={user} />
            </ProtectedRoute>
          }
        />

        {/* ── OTHER PROTECTED ── */}
        <Route path="/coupons"
          element={
            <ProtectedRoute user={user}>
              <CouponsRoute user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/airtime-coupons"
          element={
            <ProtectedRoute user={user}>
              <AirtimeCoupons user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/dashboard"
          element={
            <ProtectedRoute user={user}>
              <Dashboard user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/spin"
          element={
            <ProtectedRoute user={user}>
              <SpinWheel user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/leaderboard"
          element={
            <ProtectedRoute user={user}>
              <LeaderboardRoute user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/verification"
          element={
            <ProtectedRoute user={user}>
              <Verification user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/wallet"
          element={
            <ProtectedRoute user={user}>
              <Wallet user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/invitation"
          element={
            <ProtectedRoute user={user}>
              <Invitation user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/minimart/post-ad"
          element={
            <ProtectedRoute user={user}>
              <PostAds user={user} />
            </ProtectedRoute>
          }
        />

        {/* ── HELP CENTER ── */}
        <Route path="/help"
          element={<HelpCenter user={user} />} />
        <Route path="/help/search"
          element={<HelpSearchResults user={user} />} />
        <Route path="/help/category/:slug"
          element={<HelpCategoryPage user={user} />} />
        <Route path="/help/article/:slug"
          element={<HelpArticleDetail user={user} />} />

        {/* ── SUPPORT ── */}
        <Route path="/support"
          element={<SupportHub user={user} />} />
        <Route path="/support/contact"
          element={
            <ProtectedRoute user={user}>
              <ContactSupport user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/support/tickets"
          element={
            <ProtectedRoute user={user}>
              <SupportTickets user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/support/tickets/:id"
          element={
            <ProtectedRoute user={user}>
              <SupportTicketDetail user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/support/report"
          element={
            <ProtectedRoute user={user}>
              <ReportCenter user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/support/disputes"
          element={
            <ProtectedRoute user={user}>
              <DisputeCenter user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/support/appeals"
          element={
            <ProtectedRoute user={user}>
              <AppealsPage user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/support/feedback"
          element={
            <ProtectedRoute user={user}>
              <FeedbackPage user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/faq" element={<FAQ user={user} />} />

        {/* ── CART / CHECKOUT / ORDERS ── */}
        <Route path="/shop/cart"
          element={<CartPage />} />
        <Route path="/payment/success"
          element={<PaymentSuccess />} />
        <Route path="/shop/checkout"
          element={
            <ProtectedRoute user={user}>
              <CheckoutPage user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/shop/orders/:orderGroupId"
          element={
            <ProtectedRoute user={user}>
              <OrderSuccess user={user} />
            </ProtectedRoute>
          }
        />
        <Route path="/shop/orders"
          element={
            <ProtectedRoute user={user}>
              <OrderHistory user={user} />
            </ProtectedRoute>
          }
        />

        {/* ── PAYMENT FLOW ── */}
        <Route path="/payment/callback"
          element={<FlutterwaveRedirect />} />
        <Route path="/order-success/:orderId"
          element={<OrderSuccessPage />} />
        <Route path="/payment-failed/:orderId"
          element={<PaymentFailedPage />} />

        {/* ── ADMIN ── */}
        <Route path="/admin"
          element={
            <Navigate
              to={admin ? "/admin/dashboard" : "/admin/login"}
              replace
            />
          }
        />
        <Route path="/admin/login"
          element={
            admin
              ? <Navigate to="/admin/dashboard" replace />
              : <AdminLogin setAdmin={setAdmin} />
          }
        />
        <Route path="/admin/dashboard"
          element={
            <AdminProtectedRoute admin={admin}>
              <AdminDashboard admin={admin} />
            </AdminProtectedRoute>
          }
        />
        <Route path="/admin/dashboard/:tab"
          element={
            <AdminProtectedRoute admin={admin}>
              <AdminDashboard admin={admin} />
            </AdminProtectedRoute>
          }
        />
        <Route path="/admin/manager"
          element={
            <AdminProtectedRoute admin={admin}>
              <ManagerDashboard admin={admin} />
            </AdminProtectedRoute>
          }
        />

        {/* ── FALLBACK ── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
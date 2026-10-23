/**
 * src/App.jsx
 *
 * v3.4 — Persistent Authentication & Independent Auth Systems
 *
 * BUYER AUTHENTICATION
 * - Uses marketplace_token for public.users.
 * - Restores the saved buyer session on application startup.
 * - Preserves tokens during network failures and server errors.
 * - Restores cached profile data while validating the session.
 * - Does not automatically log out users during tab wake failures.
 * - Preserves authentication across navigation and browser refreshes.
 *
 * SELLER AUTHENTICATION
 * - Uses sellerToken for market.users.
 * - Supports legacy seller token keys.
 * - Does not depend on buyer authentication.
 *
 * ADMIN AUTHENTICATION
 * - Uses admin_token and the stored admin profile.
 * - Remains independent of buyer and seller sessions.
 *
 * APP RECOVERY
 * - Offline banner.
 * - Tab-wake listener.
 * - System theme watcher.
 * - Responsive desktop/mobile routes.
 *
 * IMPORTANT
 * - Persistent browser storage does not extend JWT expiration.
 * - A confirmed invalid token still requires reauthentication
 *   unless the backend supports token refresh.
 */

import {
  useEffect,
  useState,
  useCallback,
  memo,
  useRef,
} from "react";

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

import axios from "axios";

import toast, { Toaster } from "react-hot-toast";

import { useQueryClient } from "@tanstack/react-query";

import { useProductCache } from "./context/ProductCacheContext";

import {
  OfflineBanner,
  useTabWakeListener,
} from "./components/AppRecovery";

import "./index.css";

/* ============================================================
   THEME
============================================================ */

const THEME_KEY = "loemart_theme";

const getSystemTheme = () => {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const applyTheme = (theme) => {
  const resolvedTheme =
    theme === "system" ? getSystemTheme() : theme;

  document.documentElement.setAttribute(
    "data-theme",
    resolvedTheme
  );
};

applyTheme(
  (() => {
    try {
      return localStorage.getItem(THEME_KEY) ?? "system";
    } catch {
      return "system";
    }
  })()
);

/* ============================================================
   UTM SOURCE CAPTURE
============================================================ */

(() => {
  try {
    const params = new URLSearchParams(window.location.search);

    const source = params.get("utm_source");

    if (source) {
      localStorage.setItem(
        "utm_source",
        source.trim().toLowerCase()
      );
    }
  } catch {
    // Tracking must never prevent application startup.
  }
})();

/* ============================================================
   PAGES — PUBLIC
============================================================ */

import Homepage from "./pages/Homepage";
import HomepageDesktop from "./pages/HomepageDesktop";
import SearchPage from "./pages/SearchPage";
import ProductDetail from "./pages/ProductDetail";
import ProductDetailDesktop from "./desktop/ProductDetailDesktop";
import MarketDetail from "./pages/MarketDetail";
import CategoryCatalog from "./pages/CategoryCatalog";
import SellerProfile from "./pages/SellerProfile";
import SellerPage from "./pages/SellerPage";
import TermsAndConditions from "./pages/TermsAndConditions";
import MinimartPage from "./pages/MinimartPage";
import P2P from "./pages/P2P";
import MenuPage from "./pages/MenuPage";

/* ============================================================
   PAGES — LOEMART
============================================================ */

import HomePage from "./loemart/HomePage";
import LoemartSearchPage from "./loemart/mobile/SearchPage";

/* ============================================================
   PAGES — LEGAL
============================================================ */

import CommunityGuidelines from "./pages/CommunityGuidelines/CommunityGuidelines";
import PrivacyPolicy from "./pages/PrivacyPolicy/PrivacyPolicy";
import HallOfFame from "./pages/HallOfFame";

/* ============================================================
   PAGES — HOMEPAGE SUB-PAGES
============================================================ */

import TrendingPage from "./pages/Homepage/TrendingPage";
import LatestPage from "./pages/Homepage/LatestPage";
import NearbyPage from "./pages/Homepage/NearbyPage";
import NearbyPageDesktop from "./desktop/NearbyPageDesktop";
import DealsPage from "./pages/Homepage/DealsPage";

/* ============================================================
   PAGES — BUYER AUTHENTICATION
============================================================ */

import AuthPage from "./pages/AuthPage";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

/* ============================================================
   PAGES — SELLER
============================================================ */

import BecomeSeller from "./pages/BecomeSeller";
import SellerDashboard from "./pages/seller/SellerDashboard";

/* ============================================================
   PAGES — SUBSCRIPTION
============================================================ */

import Subscription from "./pages/Subscription/Subscription";
import Plans from "./pages/Subscription/Plans";
import Payment from "./pages/Subscription/Payment";
import DesktopSubscription from "./desktop/Subscription/DesktopSubscription";
import DesktopPlans from "./desktop/Subscription/DesktopPlans";

/* ============================================================
   PAGES — BUYER PROFILE AND PROTECTED PAGES
============================================================ */

import Profile from "./pages/Profile";
import EditProfile from "./pages/Profile/EditProfile";
import SavedItems from "./pages/Profile/SavedItems";
import NotificationsPage from "./pages/NotificationsPage";
import NotificationDetail from "./pages/NotificationDetail";
import SettingsPage from "./pages/SettingsPage";
import AddProduct from "./pages/AddProduct";
import Conversations from "./pages/Conversations";
import Chat from "./pages/Chat";
import Coupons from "./pages/Profile/Coupons";
import Dashboard from "./pages/Profile/Dashboard";
import SpinWheel from "./pages/Profile/SpinWheel";
import Leaderboard from "./pages/Profile/Leaderboard";
import Verification from "./pages/Profile/Verification";
import Wallet from "./pages/Profile/Wallet";
import FAQ from "./pages/FAQ";
import Invitation from "./pages/Invitation";
import PostAds from "./pages/PostAds";
import PaymentSuccess from "./pages/PaymentSuccess";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";

/* ============================================================
   PAGES — SHOP AND ORDERS
============================================================ */

import MyOrders from "./pages/Shop/MyOrders";
import OrderTracking from "./pages/Shop/OrderTracking";

/* ============================================================
   PAGES — CHECKOUT AND PAYMENT
============================================================ */

import FlutterwaveRedirect from "./pages/Checkout/Payment/FlutterwaveRedirect";
import PaymentReturnRouter from "./pages/Checkout/Payment/PaymentReturnRouter";
import OrderSuccessPage from "./pages/Checkout/Payment/OrderSuccessPage";
import PaymentFailedPage from "./pages/Checkout/Payment/PaymentFailedPage";

/* ============================================================
   PAGES — HELP AND SUPPORT
============================================================ */

import HelpCenter from "./pages/Help/HelpCenter";
import HelpSearchResults from "./pages/Help/HelpSearchResults";
import HelpCategoryPage from "./pages/Help/HelpCategoryPage";
import HelpArticleDetail from "./pages/Help/HelpArticleDetail";
import SupportHub from "./pages/Support/SupportHub";
import ContactSupport from "./pages/Support/ContactSupport";
import SupportTickets from "./pages/Support/SupportTickets";
import SupportTicketDetail from "./pages/Support/SupportTicketDetail";
import ReportCenter from "./pages/Support/ReportCenter";
import DisputeCenter from "./pages/Support/DisputeCenter";
import AppealsPage from "./pages/Support/AppealsPage";
import FeedbackPage from "./pages/Support/FeedbackPage";

/* ============================================================
   PAGES — DESKTOP
============================================================ */

import LeaderboardDesktop from "./desktop/LeaderboardDesktop";
import DesktopProfile from "./desktop/Profile";
import CouponsDesktop from "./desktop/CouponsDesktop";
import MessagingDesktop from "./pages/MessagingDesktop";

/* ============================================================
   PAGES — ADMIN
============================================================ */

import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./page/admin/AdminDashboard";
import ManagerDashboard from "./page/admin/Manager/ManagerDashboard";
import FinanceDashboard from "./page/admin/Finance/FinanceDashboard";
import ModeratorDashboard from "./page/admin/Moderator/ModeratorDashboard";
import SupportDashboard from "./page/admin/Support/SupportDashboard";

/* ============================================================
   COMPONENTS
============================================================ */

import DesktopHeader from "./components/DesktopHeader";
import SpinWinModal from "./components/SpinWinModal";

/* ============================================================
   API CONFIGURATION
============================================================ */

const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  window.location.origin
).replace(/\/+$/, "");

const USERS_API = `${BASE_URL}/api/users`;
const CART_API = `${BASE_URL}/api/cart`;
const FAVS_API = `${BASE_URL}/api/favorites`;

/* ============================================================
   AUTHENTICATION TOKEN KEYS
============================================================ */

export const TOKEN_KEYS = {
  marketplace: "marketplace_token",
  seller: "sellerToken",
  admin: "admin_token",
};

const SELLER_TOKEN_FALLBACKS = [
  "sellerToken",
  "seller_token",
  "market_token",
  "sellerAuthToken",
  "seller_auth_token",
];

const BUYER_PROFILE_KEY = "marketplace_user";
const FAV_KEY = "loemart_favs";

/* ============================================================
   ADMIN ROUTES
============================================================ */

const ADMIN_ROUTES = {
  super_admin: "/admin/dashboard",
  admin: "/admin/manager",
  finance_admin: "/admin/finance",
  content_moderator: "/admin/moderator",
  support_admin: "/admin/support",
};

const getAdminHome = (admin) => {
  return ADMIN_ROUTES[admin?.role] || "/admin/dashboard";
};

/* ============================================================
   TOAST CONFIGURATION
============================================================ */

const TOASTER_OPTIONS = {
  duration: 3500,

  style: {
    padding: "10px 14px",
    borderRadius: 8,
    color: "#fff",
    fontSize: "0.9rem",
    fontFamily: "var(--fb)",
  },

  success: {
    style: {
      background: "#15803D",
    },
  },

  error: {
    style: {
      background: "#DC2626",
    },
  },
};

/* ============================================================
   HEADER VISIBILITY
============================================================ */

const HEADER_HIDDEN_PREFIXES = [
  "/auth",
  "/forgot-password",
  "/reset-password",
  "/admin",
  "/invite/",
  "/seller/login",
  "/seller/dashboard",
  "/minimart/post-ad",
];

/* ============================================================
   SAFE STORAGE HELPERS
============================================================ */

function readLocalStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeLocalStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage cleanup must not crash the application.
  }
}

function removeSessionStorage(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Storage cleanup must not crash the application.
  }
}

/* ============================================================
   TOKEN HELPERS
============================================================ */

const getSellerToken = () => {
  for (const key of SELLER_TOKEN_FALLBACKS) {
    const token = readLocalStorage(key);

    if (token) {
      return token;
    }
  }

  return null;
};

/* ============================================================
   FAVOURITES
============================================================ */

const loadFavs = () => {
  try {
    const raw = localStorage.getItem(FAV_KEY);

    const parsed = JSON.parse(raw || "{}");

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
};

const saveFavs = (favourites) => {
  writeLocalStorage(
    FAV_KEY,
    JSON.stringify(favourites)
  );
};

async function syncFavouritesOnLogin(token, userId) {
  if (!token || !userId) {
    return;
  }

  try {
    const response = await fetch(`${FAVS_API}/ids`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return;
    }

    const responseData = await response.json();

    const dbIds = Array.isArray(responseData.ids)
      ? responseData.ids
      : [];

    const localFavourites = loadFavs();

    const localIds = Object.keys(localFavourites);

    const dbIdSet = new Set(
      dbIds.map(String)
    );

    const guestOnlyIds = localIds.filter(
      (id) => !dbIdSet.has(String(id))
    );

    const mergedFavourites = {};

    dbIds.forEach((id) => {
      mergedFavourites[id] = true;
    });

    saveFavs(mergedFavourites);

    if (guestOnlyIds.length === 0) {
      return;
    }

    const results = await Promise.allSettled(
      guestOnlyIds.map(async (productId) => {
        const result = await fetch(
          `${FAVS_API}/${encodeURIComponent(productId)}`,
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!result.ok) {
          throw new Error("Favourite synchronization failed");
        }

        return productId;
      })
    );

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        mergedFavourites[result.value] = true;
      }
    });

    saveFavs(mergedFavourites);
  } catch {
    // A favourite synchronization failure must not log out a user.
  }
}

const clearFavouritesOnLogout = () => {
  removeLocalStorage(FAV_KEY);
};

/* ============================================================
   CART SYNCHRONIZATION
============================================================ */

async function syncCartAfterLogin(token) {
  if (!token) {
    return;
  }

  try {
    const rawCart = readLocalStorage("mm_cart");

    const localCart = JSON.parse(rawCart || "[]");

    if (!Array.isArray(localCart) || localCart.length === 0) {
      return;
    }

    const results = await Promise.allSettled(
      localCart.map((item) =>
        axios.post(
          `${CART_API}/items`,
          {
            product_id: item.productId,

            variant_id: item.variant?.id ?? null,

            qty: item.qty,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },

            timeout: 10000,
          }
        )
      )
    );

    const allItemsSynced = results.every(
      (result) => result.status === "fulfilled"
    );

    /*
     * Keep the local cart if any item failed to synchronize.
     * This avoids losing cart items during a temporary outage.
     */
    if (allItemsSynced) {
      removeLocalStorage("mm_cart");

      window.dispatchEvent(
        new Event("cart-updated")
      );
    }
  } catch {
    // Cart synchronization must never log out a user.
  }
}

/* ============================================================
   BUYER AUTHENTICATION STORAGE
============================================================ */

/*
 * Clears buyer authentication only.
 *
 * Seller and admin tokens are intentionally preserved.
 */

function clearAllAuthStorage() {
  [
    TOKEN_KEYS.marketplace,
    "token",
    "user",
    "auth_user",
    BUYER_PROFILE_KEY,
    "verified_phone",
    "verified_network",
  ].forEach(removeLocalStorage);

  [
    TOKEN_KEYS.marketplace,
    "token",
    "user",
  ].forEach(removeSessionStorage);
}

/* ============================================================
   PROFILE QUERY KEYS
============================================================ */

export const PROFILE_QUERY_KEYS = [
  ["profile-user"],
  ["profile-listings"],
  ["profile-unread-count"],
  ["profile-subscription-status"],
];

/* ============================================================
   THEME WATCHER
============================================================ */

function useSystemThemeWatcher() {
  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(prefers-color-scheme: dark)"
    );

    const handleThemeChange = () => {
      const savedTheme = readLocalStorage(THEME_KEY) ?? "system";

      if (savedTheme === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener(
      "change",
      handleThemeChange
    );

    return () => {
      mediaQuery.removeEventListener(
        "change",
        handleThemeChange
      );
    };
  }, []);
}

/* ============================================================
   SCROLL RESTORATION
============================================================ */

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
  }, [pathname]);

  return null;
}

/* ============================================================
   RESPONSIVE SCREEN DETECTION
============================================================ */

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => {
    return window.matchMedia(
      "(min-width: 1024px)"
    ).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(min-width: 1024px)"
    );

    const handleChange = (event) => {
      setIsDesktop(event.matches);
    };

    mediaQuery.addEventListener(
      "change",
      handleChange
    );

    return () => {
      mediaQuery.removeEventListener(
        "change",
        handleChange
      );
    };
  }, []);

  return isDesktop;
}

/* ============================================================
   AUTH LOADER
============================================================ */

const AuthLoader = memo(function AuthLoader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg, #f8f9fa)",
      }}
      role="status"
      aria-label="Restoring your session"
      aria-busy="true"
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: "3px solid var(--bd, #e9ecef)",
          borderTop: "3px solid var(--o, #ff6000)",
          borderRadius: "50%",
          animation: "spin .7s linear infinite",
        }}
      />

      <style>
        {`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
});

/* ============================================================
   DESKTOP HEADER
============================================================ */

function SiteHeader({ user, onLogout }) {
  const { pathname } = useLocation();

  const navigate = useNavigate();

  const isDesktop = useIsDesktop();

  if (!isDesktop) {
    return null;
  }

  const shouldHideHeader = HEADER_HIDDEN_PREFIXES.some(
    (prefix) => pathname.startsWith(prefix)
  );

  if (shouldHideHeader) {
    return null;
  }

  return (
    <>
      <DesktopHeader
        user={user}
        onLogout={() => onLogout(navigate)}
      />

      <div
        className="dh-spacer"
        aria-hidden="true"
      />
    </>
  );
}

/* ============================================================
   RESPONSIVE ROUTES
============================================================ */

function HomeRoute({ user }) {
  const isDesktop = useIsDesktop();

  return isDesktop ? (
    <HomepageDesktop user={user} />
  ) : (
    <Homepage user={user} />
  );
}

function ProductRoute({ user }) {
  const isDesktop = useIsDesktop();

  return isDesktop ? (
    <ProductDetailDesktop user={user} />
  ) : (
    <ProductDetail user={user} />
  );
}

function NearbyRoute({ user }) {
  const isDesktop = useIsDesktop();

  return isDesktop ? (
    <NearbyPageDesktop user={user} />
  ) : (
    <NearbyPage user={user} />
  );
}

function MessagesRoute({ user }) {
  const isDesktop = useIsDesktop();

  return isDesktop ? (
    <MessagingDesktop user={user} />
  ) : (
    <Conversations user={user} />
  );
}

function ChatRoute({ user }) {
  const isDesktop = useIsDesktop();

  return isDesktop ? (
    <MessagingDesktop user={user} />
  ) : (
    <Chat user={user} />
  );
}

function LeaderboardRoute({ user }) {
  const isDesktop = useIsDesktop();

  return isDesktop ? (
    <LeaderboardDesktop />
  ) : (
    <Leaderboard user={user} />
  );
}

function ProfileRoute({ onLogout }) {
  const navigate = useNavigate();

  const isDesktop = useIsDesktop();

  return isDesktop ? (
    <DesktopProfile
      onLogout={() => onLogout(navigate)}
    />
  ) : (
    <Profile
      onLogout={() => onLogout(navigate)}
    />
  );
}

function SubscriptionRoute() {
  const isDesktop = useIsDesktop();

  return isDesktop ? (
    <DesktopSubscription />
  ) : (
    <Subscription />
  );
}

function PlansRoute() {
  const isDesktop = useIsDesktop();

  return isDesktop ? (
    <DesktopPlans />
  ) : (
    <Plans />
  );
}

function CouponsRoute({ user }) {
  const isDesktop = useIsDesktop();

  return isDesktop ? (
    <CouponsDesktop user={user} />
  ) : (
    <Coupons user={user} />
  );
}

/* ============================================================
   SMART ORDER ROUTE
============================================================ */

function SmartOrderRoute({ user }) {
  const [searchParams] = useSearchParams();

  const isVerifying =
    searchParams.get("verify") === "true";

  const flutterwaveStatus =
    searchParams.get("status");

  if (isVerifying || flutterwaveStatus) {
    return <PaymentReturnRouter />;
  }

  return <OrderTracking user={user} />;
}

/* ============================================================
   INVITE REDIRECT
============================================================ */

function InviteRedirect() {
  const { code } = useParams();

  const safeCode = (code ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);

  if (!safeCode || safeCode.length < 4) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <Navigate
      to={`/auth?ref=${safeCode}`}
      replace
    />
  );
}

/* ============================================================
   BUYER ROUTE GUARD
============================================================ */

function ProtectedRoute({
  user,
  authChecked,
  children,
}) {
  const location = useLocation();

  const buyerToken = readLocalStorage(
    TOKEN_KEYS.marketplace
  );

  /*
   * Do not redirect while the application is restoring the
   * initial authentication state.
   */
  if (!authChecked) {
    return <AuthLoader />;
  }

  /*
   * A saved token without a restored profile is not an explicit
   * logout. Wait for the profile to be restored.
   */
  if (!user && buyerToken) {
    return <AuthLoader />;
  }

  if (!user) {
    const redirectPath = encodeURIComponent(
      `${location.pathname}${location.search}${location.hash}`
    );

    return (
      <Navigate
        to={`/auth?redirect=${redirectPath}`}
        state={{
          from: location,
        }}
        replace
      />
    );
  }

  return children;
}

/* ============================================================
   SELLER ROUTE GUARD
============================================================ */

function SellerProtectedRoute({ children }) {
  const location = useLocation();

  const sellerToken = getSellerToken();

  if (!sellerToken) {
    const redirectPath = encodeURIComponent(
      `${location.pathname}${location.search}${location.hash}`
    );

    return (
      <Navigate
        to={`/seller/login?redirect=${redirectPath}`}
        replace
      />
    );
  }

  return children;
}

/* ============================================================
   ADMIN ROUTE GUARD
============================================================ */

function AdminProtectedRoute({
  admin,
  role,
  children,
}) {
  if (!admin) {
    return (
      <Navigate
        to="/admin/login"
        replace
      />
    );
  }

  if (admin.role === "super_admin") {
    return children;
  }

  if (role && admin.role !== role) {
    return (
      <Navigate
        to={getAdminHome(admin)}
        replace
      />
    );
  }

  return children;
}

/* ============================================================
   AUTH GUEST GUARD
============================================================ */

function AuthGuestRoute({
  user,
  authChecked,
  redirectTo,
  children,
}) {
  const [params] = useSearchParams();

  if (!authChecked) {
    return <AuthLoader />;
  }

  if (user) {
    const requestedTarget =
      redirectTo ||
      params.get("redirect") ||
      "/";

    /*
     * Prevent redirects to external websites or protocol URLs.
     */
    const safeTarget =
      requestedTarget.startsWith("/") &&
      !requestedTarget.startsWith("//")
        ? requestedTarget
        : "/";

    return (
      <Navigate
        to={safeTarget}
        replace
      />
    );
  }

  return children;
}

/* ============================================================
   INNER APP
============================================================ */

function AppInner() {
  const [user, setUser] = useState(null);

  const [admin, setAdmin] = useState(null);

  const [authChecked, setAuthChecked] = useState(false);

  const { resetCache } = useProductCache();

  const queryClient = useQueryClient();

  const loggingOutRef = useRef(false);

  const authRequestIdRef = useRef(0);

  const navigate = useNavigate();

  useTabWakeListener();

  useSystemThemeWatcher();

  /* ==========================================================
     QUERY CACHE CLEANUP
  ========================================================== */

  const clearQueryCache = useCallback(() => {
    PROFILE_QUERY_KEYS.forEach((queryKey) => {
      queryClient.removeQueries({
        queryKey,
      });
    });

    queryClient.clear();
  }, [queryClient]);

  /* ==========================================================
     RESTORE CACHED BUYER PROFILE
  ========================================================== */

  const restoreCachedBuyerProfile = useCallback(() => {
    try {
      const cachedProfile = readLocalStorage(
        BUYER_PROFILE_KEY
      );

      if (!cachedProfile) {
        return null;
      }

      const parsedProfile = JSON.parse(cachedProfile);

      if (
        !parsedProfile ||
        typeof parsedProfile !== "object" ||
        Array.isArray(parsedProfile) ||
        parsedProfile.id == null
      ) {
        return null;
      }

      return parsedProfile;
    } catch {
      return null;
    }
  }, []);

  /* ==========================================================
     CLEAR BUYER SESSION AFTER CONFIRMED UNAUTHORIZED RESPONSE
  ========================================================== */

  const clearInvalidBuyerSession = useCallback(() => {
    clearAllAuthStorage();

    clearFavouritesOnLogout();

    clearQueryCache();

    resetCache();

    setUser(null);
  }, [
    clearQueryCache,
    resetCache,
  ]);

  /* ==========================================================
     INITIAL BUYER SESSION RESTORATION
  ========================================================== */

  useEffect(() => {
    let cancelled = false;

    const requestId = ++authRequestIdRef.current;

    const restoreBuyerSession = async () => {
      const token = readLocalStorage(
        TOKEN_KEYS.marketplace
      );

      /*
       * No saved buyer token means the visitor is a guest.
       * Seller and admin authentication are unaffected.
       */
      if (!token) {
        if (!cancelled) {
          setAuthChecked(true);
        }

        return;
      }

      /*
       * Show the cached profile while checking the server.
       * The cached profile is not proof of authentication.
       */
      const cachedUser = restoreCachedBuyerProfile();

      if (cachedUser && !cancelled) {
        setUser(cachedUser);
      }

      try {
        const response = await axios.get(
          `${USERS_API}/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },

            timeout: 15000,
          }
        );

        if (
          cancelled ||
          loggingOutRef.current ||
          requestId !== authRequestIdRef.current
        ) {
          return;
        }

        /*
         * Do not apply a response belonging to a session that
         * has already been replaced or logged out.
         */
        if (
          readLocalStorage(TOKEN_KEYS.marketplace) !== token
        ) {
          return;
        }

        const userData =
          response.data?.user ?? response.data;

        if (
          !userData ||
          typeof userData !== "object" ||
          userData.id == null
        ) {
          /*
           * Preserve the token on an unexpected response.
           * An unexpected response is not proof of logout.
           */
          return;
        }

        setUser(userData);

        writeLocalStorage(
          BUYER_PROFILE_KEY,
          JSON.stringify(userData)
        );

        syncFavouritesOnLogin(
          token,
          userData.id
        );
      } catch (error) {
        if (
          cancelled ||
          loggingOutRef.current ||
          requestId !== authRequestIdRef.current
        ) {
          return;
        }

        if (
          readLocalStorage(TOKEN_KEYS.marketplace) !== token
        ) {
          return;
        }

        const status = error.response?.status;

        if (status === 401) {
          /*
           * A 401 indicates the endpoint rejected this request.
           *
           * This version does not yet implement token refresh.
           * If the backend supports refresh tokens, refreshing
           * should happen before clearing this session.
           */
          clearInvalidBuyerSession();
        }

        /*
         * Do not delete the token for:
         * - Network failures.
         * - Request timeouts.
         * - Render cold starts.
         * - HTTP 403.
         * - HTTP 429.
         * - HTTP 5xx responses.
         * - Other unexpected server responses.
         *
         * The cached profile remains available if one existed.
         */
      } finally {
        if (!cancelled) {
          setAuthChecked(true);
        }
      }
    };

    restoreBuyerSession();

    return () => {
      cancelled = true;
    };
  }, [
    clearInvalidBuyerSession,
    restoreCachedBuyerProfile,
  ]);

  /* ==========================================================
     RECHECK BUYER SESSION WHEN TAB WAKES
  ========================================================== */

  useEffect(() => {
    let wakeController = null;

    const handleTabWake = async () => {
      if (
        loggingOutRef.current ||
        !navigator.onLine
      ) {
        return;
      }

      const token = readLocalStorage(
        TOKEN_KEYS.marketplace
      );

      if (!token) {
        return;
      }

      /*
       * Avoid multiple simultaneous validation requests when
       * Chrome fires several visibility or wake events.
       */
      if (wakeController) {
        wakeController.abort();
      }

      const controller = new AbortController();

      wakeController = controller;

      const requestId = ++authRequestIdRef.current;

      try {
        const response = await axios.get(
          `${USERS_API}/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },

            timeout: 15000,

            signal: controller.signal,
          }
        );

        if (
          controller.signal.aborted ||
          loggingOutRef.current ||
          requestId !== authRequestIdRef.current
        ) {
          return;
        }

        if (
          readLocalStorage(TOKEN_KEYS.marketplace) !== token
        ) {
          return;
        }

        const userData =
          response.data?.user ?? response.data;

        if (
          !userData ||
          typeof userData !== "object" ||
          userData.id == null
        ) {
          return;
        }

        setUser(userData);

        writeLocalStorage(
          BUYER_PROFILE_KEY,
          JSON.stringify(userData)
        );
      } catch (error) {
        if (
          controller.signal.aborted ||
          axios.isCancel(error) ||
          error.code === "ERR_CANCELED" ||
          loggingOutRef.current
        ) {
          return;
        }

        if (
          readLocalStorage(TOKEN_KEYS.marketplace) !== token
        ) {
          return;
        }

        /*
         * A failed wake-up request does not mean the user logged
         * out. Preserve the token for network errors, timeouts,
         * server failures and other unexpected responses.
         */
        if (error.response?.status === 401) {
          /*
           * Prevent an old wake-up request from clearing a newer
           * session.
           */
          if (
            requestId === authRequestIdRef.current &&
            readLocalStorage(TOKEN_KEYS.marketplace) === token
          ) {
            clearInvalidBuyerSession();
          }
        }
      } finally {
        if (wakeController === controller) {
          wakeController = null;
        }
      }
    };

    window.addEventListener(
      "tab-wake",
      handleTabWake
    );

    return () => {
      window.removeEventListener(
        "tab-wake",
        handleTabWake
      );

      wakeController?.abort();
    };
  }, [
    clearInvalidBuyerSession,
  ]);

  /* ==========================================================
     ADMIN SESSION RESTORATION
  ========================================================== */

  useEffect(() => {
    const adminToken = readLocalStorage(
      TOKEN_KEYS.admin
    );

    const storedAdmin = readLocalStorage("admin");

    if (!adminToken || !storedAdmin) {
      return;
    }

    try {
      const parsedAdmin = JSON.parse(storedAdmin);

      if (
        parsedAdmin &&
        typeof parsedAdmin === "object" &&
        parsedAdmin.role
      ) {
        setAdmin(parsedAdmin);
      }
    } catch {
      removeLocalStorage("admin");

      removeLocalStorage(TOKEN_KEYS.admin);
    }
  }, []);

  /* ==========================================================
     BUYER LOGIN SUCCESS
  ========================================================== */

  const handleAuthSuccess = useCallback(
    (userData, token, navigateFn, from) => {
      if (!token || !userData) {
        toast.error(
          "Login was unsuccessful. Please try again."
        );

        return;
      }

      /*
       * Invalidate any pending restoration or wake-up request.
       */
      authRequestIdRef.current += 1;

      loggingOutRef.current = false;

      clearQueryCache();

      writeLocalStorage(
        TOKEN_KEYS.marketplace,
        token
      );

      writeLocalStorage(
        BUYER_PROFILE_KEY,
        JSON.stringify(userData)
      );

      resetCache();

      [
        "lastLocation",
        "active_location",
        "cacheTime",
      ].forEach(removeLocalStorage);

      setUser(userData);

      setAuthChecked(true);

      syncCartAfterLogin(token);

      syncFavouritesOnLogin(
        token,
        userData.id
      );

      toast.success(
        `Welcome back, ${userData.name || "to Loemart"}!`
      );

      const navigateFunction =
        typeof navigateFn === "function"
          ? navigateFn
          : navigate;

      const requestedDestination =
        typeof from === "string"
          ? from
          : from?.pathname || "/";

      const safeDestination =
        requestedDestination.startsWith("/") &&
        !requestedDestination.startsWith("//")
          ? requestedDestination
          : "/";

      navigateFunction(
        safeDestination,
        {
          replace: true,
        }
      );
    },
    [
      clearQueryCache,
      resetCache,
      navigate,
    ]
  );

  /* ==========================================================
     BUYER LOGOUT
  ========================================================== */

  const handleLogout = useCallback(
    async (navigateFn) => {
      if (loggingOutRef.current) {
        return;
      }

      loggingOutRef.current = true;

      /*
       * Invalidate pending authentication requests before
       * removing the token.
       */
      authRequestIdRef.current += 1;

      const token = readLocalStorage(
        TOKEN_KEYS.marketplace
      );

      /*
       * Request backend logout without blocking local logout.
       * The browser should not remain logged in just because
       * the server is temporarily unavailable.
       */
      if (token) {
        try {
          fetch(`${USERS_API}/logout`, {
            method: "POST",

            headers: {
              Authorization: `Bearer ${token}`,
            },

            keepalive: true,
          }).catch(() => {});
        } catch {
          // Local logout must continue even if fetch fails.
        }
      }

      clearQueryCache();

      clearAllAuthStorage();

      clearFavouritesOnLogout();

      resetCache();

      setUser(null);

      toast.success("Signed out");

      const navigateFunction =
        typeof navigateFn === "function"
          ? navigateFn
          : navigate;

      navigateFunction(
        "/auth",
        {
          replace: true,
        }
      );

      /*
       * Release the logout lock after React has had time to
       * process the state changes.
       */
      window.setTimeout(() => {
        loggingOutRef.current = false;
      }, 250);
    },
    [
      clearQueryCache,
      resetCache,
      navigate,
    ]
  );

  /* ==========================================================
     BUYER PROFILE UPDATE
  ========================================================== */

  const handleProfileUpdate = useCallback(
    (updatedData) => {
      if (
        !updatedData ||
        typeof updatedData !== "object"
      ) {
        return;
      }

      setUser((previousUser) => {
        if (!previousUser) {
          return previousUser;
        }

        const filteredUpdates = Object.fromEntries(
          Object.entries(updatedData).filter(
            ([, value]) => value != null
          )
        );

        const mergedUser = {
          ...previousUser,
          ...filteredUpdates,
        };

        writeLocalStorage(
          BUYER_PROFILE_KEY,
          JSON.stringify(mergedUser)
        );

        return mergedUser;
      });

      queryClient.setQueryData(
        ["profile-user"],
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            ...updatedData,
          };
        }
      );
    },
    [queryClient]
  );

  /* ==========================================================
     INITIAL AUTHENTICATION LOADING
  ========================================================== */

  if (!authChecked) {
    return <AuthLoader />;
  }

  /* ==========================================================
     APPLICATION
  ========================================================== */

  return (
    <>
      <OfflineBanner />

      <SpinWinModal user={user} />

      <ScrollToTop />

      <Toaster
        position="top-right"
        toastOptions={TOASTER_OPTIONS}
      />

      <SiteHeader
        user={user}
        onLogout={handleLogout}
      />

      <Routes>
        {/* PUBLIC ROUTES */}

        <Route
          path="/"
          element={
            <HomeRoute
              user={user}
            />
          }
        />

        <Route
          path="/search"
          element={
            <SearchPage user={user} />
          }
        />

        <Route
          path="/product/:slug"
          element={
            <ProductRoute user={user} />
          }
        />

        <Route
          path="/shop/:slug"
          element={
            <MarketDetail user={user} />
          }
        />

        <Route
          path="/catalog"
          element={
            <CategoryCatalog user={user} />
          }
        />

        <Route
          path="/category/:slug"
          element={
            <CategoryCatalog user={user} />
          }
        />

        <Route
          path="/seller/:id"
          element={
            <SellerProfile user={user} />
          }
        />

        <Route
          path="/seller/store/:sellerId"
          element={<SellerPage />}
        />

        <Route
          path="/terms"
          element={<TermsAndConditions />}
        />

        <Route
          path="/minimart"
          element={
            <MinimartPage user={user} />
          }
        />

        <Route
          path="/p2p"
          element={<P2P user={user} />}
        />

        <Route
          path="/menu"
          element={<MenuPage user={user} />}
        />

        <Route
          path="/privacy"
          element={<PrivacyPolicy />}
        />

        <Route
          path="/community-guidelines"
          element={<CommunityGuidelines />}
        />

        <Route
          path="/hall-of-fame"
          element={<HallOfFame />}
        />

        <Route
          path="/loemart"
          element={<HomePage user={user} />}
        />

        <Route
          path="/loemart/search"
          element={
            <LoemartSearchPage user={user} />
          }
        />

        <Route
          path="/trending"
          element={
            <TrendingPage user={user} />
          }
        />

        <Route
          path="/latest"
          element={
            <LatestPage user={user} />
          }
        />

        <Route
          path="/nearby"
          element={
            <NearbyRoute user={user} />
          }
        />

        <Route
          path="/deals"
          element={
            <DealsPage user={user} />
          }
        />

        {/* BUYER AUTHENTICATION */}

        <Route
          path="/auth"
          element={
            <AuthGuestRoute
              user={user}
              authChecked={authChecked}
            >
              <AuthPage
                setUser={handleAuthSuccess}
              />
            </AuthGuestRoute>
          }
        />

        <Route
          path="/forgot-password"
          element={
            user ? (
              <Navigate
                to="/"
                replace
              />
            ) : (
              <ForgotPassword />
            )
          }
        />

        <Route
          path="/reset-password"
          element={
            user ? (
              <Navigate
                to="/"
                replace
              />
            ) : (
              <ResetPassword
                setUser={handleAuthSuccess}
              />
            )
          }
        />

        <Route
          path="/invite/:code"
          element={<InviteRedirect />}
        />

        {/* SELLER ROUTES */}

        <Route
          path="/become-seller"
          element={
            <BecomeSeller user={user} />
          }
        />

        <Route
          path="/seller/dashboard"
          element={
            <SellerProtectedRoute>
              <SellerDashboard />
            </SellerProtectedRoute>
          }
        />

        <Route
          path="/seller/dashboard/:tab"
          element={
            <SellerProtectedRoute>
              <SellerDashboard />
            </SellerProtectedRoute>
          }
        />

        <Route
          path="/minimart/post-ad"
          element={
            <SellerProtectedRoute>
              <PostAds />
            </SellerProtectedRoute>
          }
        />

        {/* SUBSCRIPTION */}

        <Route
          path="/seller/subscription"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <SubscriptionRoute />
            </ProtectedRoute>
          }
        />

        <Route
          path="/seller/subscription/plans"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <PlansRoute />
            </ProtectedRoute>
          }
        />

        <Route
          path="/subscription/callback/paystack"
          element={<Payment />}
        />

        {/* BUYER PROFILE */}

        <Route
          path="/profile"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <ProfileRoute
                onLogout={handleLogout}
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile/edit"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <EditProfile
                onProfileUpdate={handleProfileUpdate}
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="/saved"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <SavedItems user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/notifications"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <NotificationsPage user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/notifications/:id"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <NotificationDetail user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <SettingsPage
                user={user}
                onLogout={handleLogout}
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="/minimart/add"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <AddProduct user={user} />
            </ProtectedRoute>
          }
        />

        {/* MESSAGING */}

        <Route
          path="/conversations"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <MessagesRoute user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/messages"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <MessagesRoute user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/messages/:threadId"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <ChatRoute user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/chat/:threadId"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <ChatRoute user={user} />
            </ProtectedRoute>
          }
        />

        {/* COUPONS */}

        <Route
          path="/coupons"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <CouponsRoute user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/airtime-coupons"
          element={
            <Navigate
              to="/coupons?tab=airtime"
              replace
            />
          }
        />

        {/* OTHER PROTECTED BUYER ROUTES */}

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <Dashboard user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/spin"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <SpinWheel user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <LeaderboardRoute user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/verification"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <Verification user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/wallet"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <Wallet user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/invitation"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <Invitation user={user} />
            </ProtectedRoute>
          }
        />

        {/* HELP AND SUPPORT */}

        <Route
          path="/help"
          element={<HelpCenter user={user} />}
        />

        <Route
          path="/help/search"
          element={<HelpSearchResults user={user} />}
        />

        <Route
          path="/help/category/:slug"
          element={<HelpCategoryPage user={user} />}
        />

        <Route
          path="/help/article/:slug"
          element={<HelpArticleDetail user={user} />}
        />

        <Route
          path="/support"
          element={<SupportHub user={user} />}
        />

        <Route
          path="/support/contact"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <ContactSupport user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/support/tickets"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <SupportTickets user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/support/tickets/:id"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <SupportTicketDetail user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/support/report"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <ReportCenter user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/support/disputes"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <DisputeCenter user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/support/appeals"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <AppealsPage user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/support/feedback"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <FeedbackPage user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/faq"
          element={<FAQ user={user} />}
        />

        {/* CART, CHECKOUT AND ORDERS */}

        <Route
          path="/shop/cart"
          element={<CartPage user={user} />}
        />

        <Route
          path="/payment/success"
          element={<PaymentSuccess />}
        />

        <Route
          path="/shop/checkout"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <CheckoutPage user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/shop/orders"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <MyOrders />
            </ProtectedRoute>
          }
        />

        <Route
          path="/shop/orders/:orderId"
          element={
            <ProtectedRoute
              user={user}
              authChecked={authChecked}
            >
              <SmartOrderRoute user={user} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payment/callback"
          element={<FlutterwaveRedirect />}
        />

        <Route
          path="/order-success/:orderId"
          element={<OrderSuccessPage />}
        />

        <Route
          path="/payment-failed/:orderId"
          element={<PaymentFailedPage />}
        />

        {/* ADMIN */}

        <Route
          path="/admin"
          element={
            admin ? (
              <Navigate
                to={getAdminHome(admin)}
                replace
              />
            ) : (
              <Navigate
                to="/admin/login"
                replace
              />
            )
          }
        />

        <Route
          path="/admin/login"
          element={
            admin ? (
              <Navigate
                to={getAdminHome(admin)}
                replace
              />
            ) : (
              <AdminLogin setAdmin={setAdmin} />
            )
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <AdminProtectedRoute
              admin={admin}
              role="super_admin"
            >
              <AdminDashboard admin={admin} />
            </AdminProtectedRoute>
          }
        />

        <Route
          path="/admin/dashboard/:tab"
          element={
            <AdminProtectedRoute
              admin={admin}
              role="super_admin"
            >
              <AdminDashboard admin={admin} />
            </AdminProtectedRoute>
          }
        />

        <Route
          path="/admin/manager"
          element={
            <AdminProtectedRoute
              admin={admin}
              role="admin"
            >
              <ManagerDashboard admin={admin} />
            </AdminProtectedRoute>
          }
        />

        <Route
          path="/admin/manager/:tab"
          element={
            <AdminProtectedRoute
              admin={admin}
              role="admin"
            >
              <ManagerDashboard admin={admin} />
            </AdminProtectedRoute>
          }
        />

        <Route
          path="/admin/finance"
          element={
            <AdminProtectedRoute
              admin={admin}
              role="finance_admin"
            >
              <FinanceDashboard admin={admin} />
            </AdminProtectedRoute>
          }
        />

        <Route
          path="/admin/finance/:tab"
          element={
            <AdminProtectedRoute
              admin={admin}
              role="finance_admin"
            >
              <FinanceDashboard admin={admin} />
            </AdminProtectedRoute>
          }
        />

        <Route
          path="/admin/moderator"
          element={
            <AdminProtectedRoute
              admin={admin}
              role="content_moderator"
            >
              <ModeratorDashboard admin={admin} />
            </AdminProtectedRoute>
          }
        />

        <Route
          path="/admin/moderator/:tab"
          element={
            <AdminProtectedRoute
              admin={admin}
              role="content_moderator"
            >
              <ModeratorDashboard admin={admin} />
            </AdminProtectedRoute>
          }
        />

        <Route
          path="/admin/support"
          element={
            <AdminProtectedRoute
              admin={admin}
              role="support_admin"
            >
              <SupportDashboard admin={admin} />
            </AdminProtectedRoute>
          }
        />

        <Route
          path="/admin/support/:tab"
          element={
            <AdminProtectedRoute
              admin={admin}
              role="support_admin"
            >
              <SupportDashboard admin={admin} />
            </AdminProtectedRoute>
          }
        />

        {/* FALLBACK */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />
      </Routes>
    </>
  );
}

/* ============================================================
   APPLICATION ROOT
============================================================ */

export default function App() {
  return (
    <Router>
      <AppInner />
    </Router>
  );
}
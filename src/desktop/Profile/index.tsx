/* ═══════════════════════════════════════════════════════════════
   DESKTOP PROFILE — Main entry
═══════════════════════════════════════════════════════════════ */
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";

import { Sidebar }       from "./Sidebar";
import { DesktopHero }   from "./DesktopHero";
import { ListingsGrid }  from "./ListingsGrid";
import { StatsBar }      from "./StatsBar";
import { QuickActions }  from "./QuickActions";
import { useOutsideClick } from "./hooks";

import type {
  DesktopProfileProps,
  User,
  Listing,
  SubscriptionStatus,
  MenuSection,
  MenuItem,
} from "./types";

import "../../styles/DesktopProfile.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const fmtJoined = (d?: string): string | null => {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString("en-NG", {
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
};

const getToken = (): string | null =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const normalizeUser = (raw: any): User | null => {
  if (!raw) return null;
  return {
    ...raw,
    phone: raw.phone || raw.phone_number || "",
    location_state:
      raw.location?.state || raw.location_state || raw.state || "",
    location_city:
      raw.location?.city || raw.location_city || raw.city || "",
  };
};

/* ═══════════════════════════════════════════════════════════════
   API FETCHERS
═══════════════════════════════════════════════════════════════ */
async function fetchUserData(): Promise<User> {
  const token = getToken();
  if (!token) throw new Error("NO_TOKEN");
  const { data } = await axios.get(`${API}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return normalizeUser(data) as User;
}

async function fetchUserListings(): Promise<Listing[]> {
  const token = getToken();
  if (!token) return [];
  try {
    const { data } = await axios.get(`${API}/seller-dashboard/products`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 8, page: 1, tab: "all" },
    });
    return (data?.products || []).slice(0, 8);
  } catch {
    return [];
  }
}

async function fetchUnreadCount(): Promise<number> {
  const token = getToken();
  if (!token) return 0;
  try {
    const { data } = await axios.get(`${API}/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return Number(data?.count ?? data?.unread ?? 0);
  } catch {
    return 0;
  }
}

async function fetchSubscriptionStatus(): Promise<SubscriptionStatus | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const { data } = await axios.get(`${API}/subscription/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   ICONS (inline for menu config)
═══════════════════════════════════════════════════════════════ */
const Ic = {
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>,
  plus:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  crown:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M3 20h18"/></svg>,
  trending:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  saved:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  messages:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  gift:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>,
  zap:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  settings:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  shield:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  notify:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  support:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16l.19.92z"/></svg>,
  help:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
};

/* ═══════════════════════════════════════════════════════════════
   MENU BUILDER
═══════════════════════════════════════════════════════════════ */
function buildMenuSections(
  unreadCount: number,
  subStatus: SubscriptionStatus | null
): MenuSection[] {
  const subBadge: MenuItem["badge"] = subStatus?.isActive
    ? { text: subStatus.planBadge || "PRO", type: "sub" }
    : null;

  return [
    {
      title: "Selling",
      sectionIcon: Ic.trending,
      color: "var(--dp-accent)",
      items: [
        { to: "/dashboard",    icon: Ic.dashboard, label: "Seller Dashboard", desc: "Manage your store"  },
        { to: "/minimart/add", icon: Ic.plus,      label: "Post a Listing",   desc: "Create listing", badge: { text: "NEW", type: "new" } },
        { to: "/seller/subscription", icon: Ic.crown, label: "Subscription", desc: "Manage your plan", badge: subBadge },
        { to: "/leaderboard",  icon: Ic.trending,  label: "Leaderboard",     desc: "Top sellers" },
      ],
    },
    {
      title: "Buying",
      sectionIcon: Ic.saved,
      color: "var(--dp-pink)",
      items: [
        { to: "/saved",         icon: Ic.saved,    label: "Saved Items", desc: "Your wishlist"      },
        { to: "/conversations", icon: Ic.messages, label: "Messages",    desc: "Chat with sellers"  },
      ],
    },
    {
      title: "Rewards",
      sectionIcon: Ic.gift,
      color: "var(--dp-gold)",
      items: [
        { to: "/spin",       icon: Ic.zap,  label: "Spin & Win",      desc: "Try your luck",   badge: { text: "WIN", type: "win" } },
        { to: "/coupons",    icon: Ic.gift, label: "Coupons & Promos", desc: "Available offers" },
        { to: "/invitation", icon: Ic.gift, label: "Refer & Earn",     desc: "Invite friends",  badge: { text: "₦500", type: "money" } },
      ],
    },
    {
      title: "Account",
      sectionIcon: Ic.settings,
      color: "var(--dp-green)",
      items: [
        { to: "/settings",     icon: Ic.settings, label: "Settings",      desc: "App preferences"    },
        { to: "/verification", icon: Ic.shield,   label: "Verification",  desc: "Verify your identity" },
        {
          to: "/notifications",
          icon: Ic.notify,
          label: "Notifications",
          desc: "Stay updated",
          badge: unreadCount > 0
            ? { text: unreadCount > 99 ? "99+" : String(unreadCount), type: "notif" }
            : null,
        },
        { to: "/support", icon: Ic.support, label: "Help & Support", desc: "Get assistance"   },
        { to: "/faq",     icon: Ic.help,    label: "FAQ",            desc: "Common questions" },
      ],
    },
  ];
}

/* ═══════════════════════════════════════════════════════════════
   ERROR BANNER
═══════════════════════════════════════════════════════════════ */
const WifiIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>;
const RefreshIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>;

const spring = { type: "spring", stiffness: 300, damping: 26 } as const;

const ErrorBanner = memo(function ErrorBanner({
  message,
  onRetry,
  isRetrying,
}: {
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <motion.div
      className="dp-error"
      role="alert"
      aria-live="assertive"
      initial={{ opacity: 0, y: -14, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -14, scale: 0.94 }}
      transition={spring}
    >
      <span className="dp-error__icon"><WifiIcon /></span>
      <div className="dp-error__body">
        <p className="dp-error__title">Connection issue</p>
        <p className="dp-error__msg">{message}</p>
      </div>
      <motion.button
        className="dp-error__btn"
        onClick={onRetry}
        disabled={isRetrying}
        whileTap={isRetrying ? {} : { scale: 0.95 }}
      >
        {isRetrying
          ? <><span className="dp-spinner-sm" /> Refreshing…</>
          : <><RefreshIcon /> Retry</>
        }
      </motion.button>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN — DESKTOP PROFILE
═══════════════════════════════════════════════════════════════ */
export default function DesktopProfile({ onLogout }: DesktopProfileProps) {
  const navigate    = useNavigate();
  const location    = useLocation();
  const currentPath = location.pathname;
  const queryClient = useQueryClient();

  const [isRetrying, setIsRetrying] = useState(false);

  /* ── Expose navigate for Sidebar (avoids prop drilling) ── */
  useEffect(() => {
    (window as any).__navigate = navigate;
  }, [navigate]);

  /* ── Queries ── */
  const {
    data: user,
    error: userError,
    isError: userIsError,
    refetch: refetchUser,
  } = useQuery<User>({
    queryKey: ["profile-user"],
    queryFn: fetchUserData,
    staleTime: 2 * 60_000,
    gcTime:    30 * 60_000,
    retry: (count, err: any) => {
      const s = err?.response?.status;
      return s !== 401 && s !== 403 && count < 3;
    },
  });

  const {
    data: listings = [],
    isLoading: listingsLoading,
    refetch: refetchListings,
  } = useQuery<Listing[]>({
    queryKey: ["profile-listings"],
    queryFn: fetchUserListings,
    staleTime: 3 * 60_000,
    gcTime:    30 * 60_000,
    retry: 1,
    enabled: !!getToken(),
  });

  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ["profile-unread-count"],
    queryFn: fetchUnreadCount,
    staleTime: 60_000,
    gcTime:    5 * 60_000,
    retry: 1,
    enabled: !!getToken(),
    refetchInterval: 60_000,
  });

  const { data: subStatus = null } = useQuery<SubscriptionStatus | null>({
    queryKey: ["profile-subscription-status"],
    queryFn: fetchSubscriptionStatus,
    staleTime: 2 * 60_000,
    gcTime:    10 * 60_000,
    retry: 1,
    enabled: !!getToken(),
  });

  const menuSections = useMemo(
    () => buildMenuSections(unreadCount, subStatus),
    [unreadCount, subStatus]
  );

  /* ── Auth redirect ── */
  useEffect(() => {
    if (!getToken()) { navigate("/auth"); return; }
    if (userIsError) {
      const s = (userError as any)?.response?.status;
      if (s === 401 || s === 403) {
        ["marketplace_token", "token"].forEach((k) => localStorage.removeItem(k));
        navigate("/auth");
      }
    }
  }, [userIsError, userError, navigate]);

  /* ── Callbacks ── */
  const logout = useCallback(() => {
    ["marketplace_token", "token", "seller_token"].forEach((k) =>
      localStorage.removeItem(k)
    );
    onLogout?.();
    navigate("/auth");
  }, [navigate, onLogout]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await Promise.all([refetchUser(), refetchListings()]);
    } finally {
      setIsRetrying(false);
    }
  }, [refetchUser, refetchListings]);

  const goEdit    = useCallback(() => navigate("/profile/edit"),  [navigate]);
  const goViewAll = useCallback(() => navigate("/dashboard"),     [navigate]);

  const joinedLabel = fmtJoined(user?.created_at || user?.joined_at);

  const errorMessage =
    userIsError &&
    (userError as any)?.response?.status !== 401 &&
    (userError as any)?.response?.status !== 403
      ? (userError as any)?.response?.status >= 500
        ? "Server is temporarily unavailable."
        : !(userError as any)?.response
        ? "Network error. Check your connection."
        : "Something went wrong."
      : null;

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="dp-root" role="main">

      {/* ── Two-column layout ── */}
      <div className="dp-layout">

        {/* ── LEFT: Sidebar ── */}
        <Sidebar
          user={user}
          joinedLabel={joinedLabel}
          subStatus={subStatus}
          menuSections={menuSections}
          currentPath={currentPath}
          onEditProfile={goEdit}
          onLogout={logout}
        />

        {/* ── RIGHT: Main content ── */}
        <div className="dp-main">

          {/* Error */}
          <AnimatePresence>
            {errorMessage && (
              <ErrorBanner
                message={errorMessage}
                onRetry={handleRetry}
                isRetrying={isRetrying}
              />
            )}
          </AnimatePresence>

          {/* Quick actions bar */}
          <QuickActions
            onPost={() => navigate("/minimart/add")}
            onDashboard={() => navigate("/dashboard")}
            onMessages={() => navigate("/conversations")}
            onNotifications={() => navigate("/notifications")}
            unreadCount={unreadCount}
          />

          {/* Hero */}
          <DesktopHero
            user={user}
            joinedLabel={joinedLabel}
            subStatus={subStatus}
            listingsCount={listings.length}
            onEdit={goEdit}
          />

          {/* Stats bar */}
          <StatsBar user={user} listingsCount={listings.length} />

          {/* Listings */}
          {!listingsLoading && (
            <ListingsGrid listings={listings} onViewAll={goViewAll} />
          )}

          {listingsLoading && (
            <div className="dp-grid" aria-label="Loading listings">
              {[1,2,3,4,5,6,7,8].map((i) => (
                <div key={i} className="dp-grid-sk">
                  <div className="dp-grid-sk__img dp-shimmer" />
                  <div className="dp-grid-sk__body">
                    <div className="dp-grid-sk__line dp-shimmer" style={{ width: "75%" }} />
                    <div className="dp-grid-sk__line dp-shimmer" style={{ width: "45%", height: "9px" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <p className="dp-footer">
            Loemart Technologies Ltd · {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
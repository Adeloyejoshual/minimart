// ════════════════════════════════════════════════════════════
// FILE: src/components/BottomNav.jsx
// ════════════════════════════════════════════════════════════

import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaHome,
  FaShoppingCart,
  FaHandshake,
  FaComments,
  FaUser,
} from "react-icons/fa";

import { useUnreadCount } from "../hooks/useUnreadCount";
import "../styles/BottomNav.css";

/* ═══════════════════════════════════════════════════════════════
   NAV CONFIG
═══════════════════════════════════════════════════════════════ */
const NAV_ITEMS = [
  { label: "Home",     Icon: FaHome,         path: "/",              exact: true },
  { label: "Market",   Icon: FaShoppingCart, path: "/minimart" },
  { label: "P2P",      Icon: FaHandshake,    path: "/P2P" },
  { label: "Messages", Icon: FaComments,     path: "/conversations", showBadge: true },
  { label: "Profile",  Icon: FaUser,         path: "/profile" },
];

/* ═══════════════════════════════════════════════════════════════
   BADGE HELPER
═══════════════════════════════════════════════════════════════ */
function resolveBadge(value) {
  if (value == null || value === 0) return null;
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return n > 99 ? "99+" : String(n);
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   SINGLE NAV ITEM
═══════════════════════════════════════════════════════════════ */
const NavItem = memo(function NavItem({
  label,
  Icon,
  active,
  badge,
  onClick,
}) {
  const badgeText = resolveBadge(badge);

  return (
    <motion.button
      className={`bn-item${active ? " active" : ""}`}
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      whileTap={{ scale: 0.88 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
    >
      <span className="bn-icon">
        <Icon />

        <AnimatePresence>
          {badgeText && (
            <motion.span
              className="bn-badge"
              key="badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{   scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 24 }}
            >
              {badgeText}
            </motion.span>
          )}
        </AnimatePresence>
      </span>

      <span className="bn-label">{label}</span>
    </motion.button>
  );
});

/* ═══════════════════════════════════════════════════════════════
   BOTTOM NAV
   Rendered via portal into <body> so no ancestor transform
   (from Framer Motion, filters, will-change, etc.) can break
   its `position: fixed` behaviour.
═══════════════════════════════════════════════════════════════ */
const BottomNav = memo(function BottomNav() {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const [mounted, setMounted] = useState(false);

  const { data: unreadCount = 0 } = useUnreadCount();

  /* Portal only after mount to avoid SSR/hydration issues */
  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (path, exact) =>
    exact
      ? pathname === path
      : pathname === path || pathname.startsWith(path + "/");

  /* ── Use opacity-only animation (NO transform on the nav itself) ── */
  const navContent = (
    <motion.nav
      className="bn-wrap"
      aria-label="Main navigation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, delay: 0.08 }}
    >
      {NAV_ITEMS.map((item) => (
        <NavItem
          key={item.path}
          label={item.label}
          Icon={item.Icon}
          active={isActive(item.path, item.exact)}
          badge={item.showBadge ? unreadCount : null}
          onClick={() => navigate(item.path)}
        />
      ))}
    </motion.nav>
  );

  if (!mounted) return null;

  return createPortal(navContent, document.body);
});

export default BottomNav;
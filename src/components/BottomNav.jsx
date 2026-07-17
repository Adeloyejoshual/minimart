// ════════════════════════════════════════════════════════════
// FILE: src/components/BottomNav.jsx
// ════════════════════════════════════════════════════════════

import { memo } from "react";
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
  {
    label: "Home",
    Icon:  FaHome,
    path:  "/",
    exact: true,
  },
  {
    label: "Market",
    Icon:  FaShoppingCart,
    path:  "/minimart",
  },
  {
    label: "P2P",
    Icon:  FaHandshake,
    path:  "/P2P",
  },
  {
    label:    "Messages",
    Icon:     FaComments,
    path:     "/conversations",
    showBadge: true,
  },
  {
    label: "Profile",
    Icon:  FaUser,
    path:  "/profile",
  },
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
  path,
  exact   = false,
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
              transition={{
                type:      "spring",
                stiffness: 500,
                damping:   24,
              }}
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
═══════════════════════════════════════════════════════════════ */
const BottomNav = memo(function BottomNav() {
  const navigate     = useNavigate();
  const { pathname } = useLocation();

  /* ── Real unread count ── */
  const { data: unreadCount = 0 } = useUnreadCount();

  const isActive = (path, exact) =>
    exact
      ? pathname === path
      : pathname === path || pathname.startsWith(path + "/");

  return (
    <motion.nav
      className="bn-wrap"
      aria-label="Main navigation"
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0,  opacity: 1 }}
      transition={{
        type:      "spring",
        stiffness: 280,
        damping:   26,
        delay:     0.08,
      }}
    >
      {NAV_ITEMS.map((item) => (
        <NavItem
          key={item.path}
          label={item.label}
          Icon={item.Icon}
          path={item.path}
          exact={item.exact}
          active={isActive(item.path, item.exact)}
          badge={item.showBadge ? unreadCount : null}
          onClick={() => navigate(item.path)}
        />
      ))}
    </motion.nav>
  );
});

export default BottomNav;
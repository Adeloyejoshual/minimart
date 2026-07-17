// src/components/BottomNav.jsx
import { memo } from "react";
import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaHome,
  FaShoppingCart,
  FaHandshake,
  FaComments,
  FaUser,
} from "react-icons/fa";

import "./BottomNav.css";

const spring = { type: "spring", stiffness: 420, damping: 30 };

const NAV_ITEMS = [
  { label: "Home", Icon: FaHome, path: "/", end: true },
  { label: "Market", Icon: FaShoppingCart, path: "/minimart" },
  { label: "P2P", Icon: FaHandshake, path: "/P2P" },
  { label: "Messages", Icon: FaComments, path: "/conversations", badgeKey: "messages" },
  { label: "Profile", Icon: FaUser, path: "/profile" },
];

const BottomNavItem = memo(function BottomNavItem({
  label,
  Icon,
  path,
  end = false,
  badge,
}) {
  const badgeText =
    badge == null || badge === 0
      ? null
      : Number.isFinite(Number(badge))
        ? Number(badge) > 99
          ? "99+"
          : String(Number(badge))
        : String(badge);

  return (
    <NavLink
      to={path}
      end={end}
      className={({ isActive }) => `bn-item${isActive ? " active" : ""}`}
      aria-label={label}
    >
      {({ isActive }) => (
        <motion.span className="bn-item__inner" whileTap={{ scale: 0.94 }}>
          <span className="bn-icon-wrap">
            {isActive && (
              <motion.span
                layoutId="bn-active-pill"
                className="bn-active-pill"
                transition={spring}
              />
            )}

            <span className="bn-icon">
              <Icon />
            </span>

            {badgeText && <span className="bn-badge">{badgeText}</span>}
          </span>

          <span className="bn-label">{label}</span>
        </motion.span>
      )}
    </NavLink>
  );
});

const BottomNav = memo(function BottomNav({ badges = {} }) {
  return (
    <motion.nav
      className="bn-wrap"
      aria-label="Main navigation"
      initial={{ y: 18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
    >
      {NAV_ITEMS.map((item) => (
        <BottomNavItem
          key={item.path}
          {...item}
          badge={item.badgeKey ? badges[item.badgeKey] : null}
        />
      ))}
    </motion.nav>
  );
});

export default BottomNav;
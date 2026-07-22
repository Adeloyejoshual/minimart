// ════════════════════════════════════════════════════════════
// FILE: src/components/ProfileHeader.jsx
// ════════════════════════════════════════════════════════════

import { useEffect, useRef, memo } from "react";
import { useNavigate }             from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import "./ProfileHeader.css";

/* ═══════════════════════════════════════════════════════════════
   ANIMATION PRESETS
═══════════════════════════════════════════════════════════════ */
const spring = { type: "spring", stiffness: 320, damping: 28 };

const menuVariants = {
  hidden: {
    opacity         : 0,
    scale           : 0.92,
    y               : -10,
    transformOrigin : "top right",
  },
  visible: {
    opacity  : 1,
    scale    : 1,
    y        : 0,
    transition: {
      ...spring,
      staggerChildren : 0.045,
      delayChildren   : 0.02,
    },
  },
  exit: {
    opacity    : 0,
    scale      : 0.92,
    y          : -8,
    transition : { duration: 0.18 },
  },
};

const itemVariants = {
  hidden  : { opacity: 0, x: 12 },
  visible : { opacity: 1, x: 0, transition: spring },
};

/* ═══════════════════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════════════════ */
const Icons = {
  back: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),

  edit: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),

  bell: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),

  dots: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5"  cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  ),

  close: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6"  x2="6"  y2="18" />
      <line x1="6"  y1="6"  x2="18" y2="18" />
    </svg>
  ),

  settings: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1
               0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82
               -.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0
               1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82
               .33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A
               1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0
               0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65
               1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0
               1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0
               1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0
               0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1
               2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9
               a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2
               2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   MENU ITEM
═══════════════════════════════════════════════════════════════ */
const DropMenuItem = memo(function DropMenuItem({
  icon,
  label,
  onClick,
  danger = false,
}) {
  return (
    <motion.button
      className={`ph-drop__item${danger ? " ph-drop__item--danger" : ""}`}
      onClick={onClick}
      variants={itemVariants}
      whileTap={{ scale: 0.96 }}
      role="menuitem"
    >
      <span className="ph-drop__item-icon" aria-hidden="true">{icon}</span>
      <span className="ph-drop__item-label">{label}</span>
    </motion.button>
  );
});

/* ═══════════════════════════════════════════════════════════════
   PROFILE HEADER

   Props
   ─────
   title        — heading text
   menuOpen     — controlled open state
   onMenuToggle — toggle the dropdown open/closed
   onMenuClose  — close the dropdown
   menuRef      — optional forwarded ref to the dropdown element
   onEdit       — navigate to edit profile
   onNotif      — navigate to notifications
   onSettings   — navigate to settings page
   showBack     — show the back button (default true)
   fallbackPath — navigate here if history is empty (default "/")
═══════════════════════════════════════════════════════════════ */
const ProfileHeader = memo(function ProfileHeader({
  title        = "Profile",
  menuOpen     = false,
  onMenuToggle,
  onMenuClose,
  menuRef,
  onEdit,
  onNotif,
  onSettings,
  showBack     = true,
  fallbackPath = "/",
}) {
  const navigate   = useNavigate();
  const dropRef    = useRef(null);
  const triggerRef = useRef(null);

  /* ── Go back ── */
  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(fallbackPath);
  };

  /* ── Close on outside click or Escape ── */
  useEffect(() => {
    if (!menuOpen) return;

    const handleClick = (e) => {
      if (
        dropRef.current    && !dropRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        onMenuClose?.();
      }
    };

    const handleKey = (e) => {
      if (e.key === "Escape") onMenuClose?.();
    };

    document.addEventListener("mousedown",  handleClick);
    document.addEventListener("touchstart", handleClick, { passive: true });
    document.addEventListener("keydown",    handleKey);

    return () => {
      document.removeEventListener("mousedown",  handleClick);
      document.removeEventListener("touchstart", handleClick);
      document.removeEventListener("keydown",    handleKey);
    };
  }, [menuOpen, onMenuClose]);

  /* ── Forward dropRef via menuRef prop ── */
  useEffect(() => {
    if (menuRef && typeof menuRef === "object") {
      menuRef.current = dropRef.current;
    }
  }, [menuRef]);

  /* ══════════════════════════════════════════════════════════
     HANDLERS
  ══════════════════════════════════════════════════════════ */
  const handleEdit = () => {
    onMenuClose?.();
    onEdit?.();
  };

  const handleNotif = () => {
    onMenuClose?.();
    onNotif?.();
  };

  const handleSettings = () => {
    onMenuClose?.();
    if (typeof onSettings === "function") {
      onSettings();
    } else {
      navigate("/settings");
    }
  };

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <header className="ph-root" role="banner">

      {/* ── Left: Back + Title ── */}
      <div className="ph-left">
        {showBack && (
          <motion.button
            className="ph-back-btn"
            onClick={handleBack}
            aria-label="Go back"
            whileTap={{ scale: 0.85, x: -3 }}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...spring, delay: 0.02 }}
          >
            <Icons.back />
          </motion.button>
        )}

        <motion.h1
          className="ph-title"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...spring, delay: 0.05 }}
        >
          {title}
        </motion.h1>
      </div>

      {/* ── Right: Notification bell + menu ── */}
      <div className="ph-right">
        <motion.button
          className="ph-icon-btn"
          onClick={onNotif}
          aria-label="Notifications"
          whileTap={{ scale: 0.88 }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...spring, delay: 0.08 }}
        >
          <Icons.bell />
        </motion.button>

        <div className="ph-menu-wrap">
          {/* Trigger */}
          <motion.button
            ref={triggerRef}
            className={`ph-icon-btn${menuOpen ? " ph-icon-btn--active" : ""}`}
            onClick={onMenuToggle}
            aria-label="More options"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            whileTap={{ scale: 0.88 }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...spring, delay: 0.11 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {menuOpen ? (
                <motion.span
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0,   opacity: 1 }}
                  exit={{ rotate: 90,     opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  aria-hidden="true"
                >
                  <Icons.close />
                </motion.span>
              ) : (
                <motion.span
                  key="dots"
                  initial={{ rotate: 90,  opacity: 0 }}
                  animate={{ rotate: 0,   opacity: 1 }}
                  exit={{ rotate: -90,    opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  aria-hidden="true"
                >
                  <Icons.dots />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Dropdown */}
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                ref={dropRef}
                className="ph-drop"
                role="menu"
                aria-label="Profile options"
                variants={menuVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="ph-drop__arrow" aria-hidden="true" />

                <DropMenuItem
                  icon={<Icons.edit />}
                  label="Edit Profile"
                  onClick={handleEdit}
                />

                <div className="ph-drop__divider" role="separator" />

                <DropMenuItem
                  icon={<Icons.bell />}
                  label="Notifications"
                  onClick={handleNotif}
                />

                <div className="ph-drop__divider" role="separator" />

                <DropMenuItem
                  icon={<Icons.settings />}
                  label="Settings"
                  onClick={handleSettings}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
});

export default ProfileHeader;
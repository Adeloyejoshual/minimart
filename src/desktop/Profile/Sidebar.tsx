/* ═══════════════════════════════════════════════════════════════
   SIDEBAR — Sticky left navigation panel
═══════════════════════════════════════════════════════════════ */
import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { SidebarProps, MenuSection, MenuItem } from "./types";

const spring  = { type: "spring", stiffness: 300, damping: 26 } as const;
const slideIn = { hidden: { opacity: 0, x: -28 }, visible: { opacity: 1, x: 0 } };
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.04, delayChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } };

/* ── Subscription map ── */
const SUB_MAP: Record<string, { label: string; gradient: string }> = {
  premium:  { label: "Premium",  gradient: "linear-gradient(135deg,#667eea,#764ba2)" },
  pro:      { label: "Pro",      gradient: "linear-gradient(135deg,#f093fb,#f5576c)" },
  business: { label: "Business", gradient: "linear-gradient(135deg,#4facfe,#00f2fe)" },
  elite:    { label: "Elite",    gradient: "linear-gradient(135deg,#FFD700,#FFA500)" },
  diamond:  { label: "Diamond",  gradient: "linear-gradient(135deg,#a8edea,#fed6e3)" },
};

/* ── Icons ── */
const LogoutIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const ChevronIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>;
const StarIcon    = () => <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const CrownIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M3 20h18"/></svg>;
const DiamondIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3l1 6"/><path d="M2 9h20"/></svg>;
const EditIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;

/* ── Sidebar user identity ── */
const SidebarIdentity = memo(function SidebarIdentity({
  user,
  joinedLabel,
  subStatus,
  onEdit,
}: Pick<SidebarProps, "user" | "joinedLabel" | "subStatus" | "onEditProfile"> & {
  onEdit: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const sub = subStatus?.isActive ? SUB_MAP[subStatus.plan ?? ""] : null;

  return (
    <motion.div
      className="dp-sb-identity"
      onClick={onEdit}
      role="button"
      tabIndex={0}
      aria-label="Edit your profile"
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onEdit()}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Avatar */}
      <div className="dp-sb-avatar-wrap">
        <div
          className="dp-sb-avatar-ring"
          style={sub ? { background: sub.gradient } : undefined}
        />
        <div className="dp-sb-avatar">
          {user?.profile_image && !imgErr ? (
            <img
              src={user.profile_image}
              alt={user.name}
              onError={() => setImgErr(true)}
            />
          ) : (
            <span>{(user?.name || "U").charAt(0).toUpperCase()}</span>
          )}
        </div>
        <span className="dp-sb-online" />
      </div>

      {/* Name */}
      <h2 className="dp-sb-name" title={user?.name || "User"}>
        {user?.name || "User"}
      </h2>

      {/* Store */}
      <p className="dp-sb-store">{user?.store_name || "Loemart Member"}</p>

      {/* Meta */}
      <div className="dp-sb-meta">
        {joinedLabel && (
          <span>Joined {joinedLabel}</span>
        )}
        {user?.location_state && (
          <span>{user.location_state}</span>
        )}
      </div>

      {/* Badges */}
      <div className="dp-sb-badges">
        {user?.verified      && <span className="dp-sbadge dp-sbadge--v">✓ Verified</span>}
        {user?.is_seller     && <span className="dp-sbadge dp-sbadge--s">Seller</span>}
        {user?.is_top_seller && <span className="dp-sbadge dp-sbadge--t">⭐ Top</span>}
        {sub && (
          <span
            className="dp-sbadge dp-sbadge--sub"
            style={{ background: sub.gradient }}
          >
            <CrownIcon /> {sub.label}
          </span>
        )}
      </div>

      {/* Rating */}
      {user?.rating != null && (
        <div className="dp-sb-rating">
          <span className="dp-sb-star"><StarIcon /></span>
          <span>{Number(user.rating).toFixed(1)}</span>
          <span className="dp-sb-rating-lbl">Rating</span>
        </div>
      )}

      {/* Edit hint */}
      <span className="dp-sb-edit-hint" aria-hidden="true">
        <EditIcon /> Edit Profile
      </span>
    </motion.div>
  );
});

/* ── Sub card ── */
const SidebarSubCard = memo(function SidebarSubCard({
  subStatus,
  onClick,
}: {
  subStatus: SidebarProps["subStatus"];
  onClick: () => void;
}) {
  if (!subStatus) return null;
  const isActive = subStatus.isActive;
  const info     = isActive ? SUB_MAP[subStatus.plan ?? ""] : null;

  return (
    <motion.div
      className={`dp-sb-sub${isActive ? " dp-sb-sub--active" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label="Manage subscription"
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      variants={fadeUp}
      whileTap={{ scale: 0.97 }}
      style={info ? { "--sub-glow": `0 4px 20px rgba(0,0,0,0.2)` } as React.CSSProperties : undefined}
    >
      <div
        className="dp-sb-sub__icon"
        style={info ? { background: info.gradient } : undefined}
      >
        {isActive ? <CrownIcon /> : <DiamondIcon />}
      </div>
      <div className="dp-sb-sub__body">
        {isActive && info ? (
          <>
            <span className="dp-sb-sub__name">{info.label} Plan</span>
            <span className="dp-sb-sub__status">
              <span className="dp-sb-sub__dot" /> Active
            </span>
          </>
        ) : (
          <>
            <span className="dp-sb-sub__name">Free Plan</span>
            <span className="dp-sb-sub__cta">Upgrade →</span>
          </>
        )}
      </div>
      <ChevronIcon />
    </motion.div>
  );
});

/* ── Nav link ── */
const NavLink = memo(function NavLink({
  item,
  isActive,
}: {
  item: MenuItem;
  isActive: boolean;
}) {
  const badgeCls = item.badge
    ? item.badge.type === "notif"   ? " dp-pill--notif"
    : item.badge.type === "sub"     ? " dp-pill--sub"
    : item.badge.text === "WIN"     ? " dp-pill--win"
    : item.badge.text === "NEW"     ? " dp-pill--new"
    : item.badge.text?.startsWith("₦") ? " dp-pill--money"
    : ""
    : "";

  return (
    <motion.div variants={fadeUp} transition={spring}>
      <Link
        to={item.to}
        className={`dp-nav-link${isActive ? " dp-nav-link--active" : ""}`}
        aria-current={isActive ? "page" : undefined}
        title={item.desc}
      >
        <span className={`dp-nav-link__icon${isActive ? " dp-nav-link__icon--on" : ""}`}>
          {item.icon}
          {item.badge?.type === "notif" && item.badge.text && (
            <span className="dp-nav-link__dot" aria-hidden="true" />
          )}
        </span>

        <div className="dp-nav-link__body">
          <span className="dp-nav-link__label">{item.label}</span>
          {item.desc && (
            <span className="dp-nav-link__desc">{item.desc}</span>
          )}
        </div>

        {item.badge && (
          <span
            className={`dp-pill${badgeCls}`}
            aria-label={
              item.badge.type === "notif"
                ? `${item.badge.text} unread notifications`
                : undefined
            }
          >
            {item.badge.text}
          </span>
        )}

        {isActive && (
          <motion.span
            className="dp-nav-link__active-bar"
            layoutId="nav-active"
            transition={spring}
          />
        )}
      </Link>
    </motion.div>
  );
});

/* ── Section group ── */
const NavSection = memo(function NavSection({
  section,
  currentPath,
}: {
  section: MenuSection;
  currentPath: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="dp-nav-section">
      <button
        className="dp-nav-section__hdr"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
      >
        <span
          className="dp-nav-section__icon"
          style={{ color: section.color }}
        >
          {section.sectionIcon}
        </span>
        <span className="dp-nav-section__title">{section.title}</span>
        <motion.span
          className="dp-nav-section__caret"
          animate={{ rotate: collapsed ? -90 : 0 }}
          transition={spring}
        >
          <ChevronIcon />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            className="dp-nav-section__items"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ ...spring, duration: 0.28 }}
          >
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
            >
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  item={item}
                  isActive={currentPath === item.to}
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/* ── Main export ── */
export const Sidebar = memo(function Sidebar({
  user,
  joinedLabel,
  subStatus,
  menuSections,
  currentPath,
  onEditProfile,
  onLogout,
}: SidebarProps) {
  const navigate = (window as any).__navigate; // injected via index.tsx

  return (
    <motion.aside
      className="dp-sidebar"
      aria-label="Profile sidebar"
      variants={slideIn}
      initial="hidden"
      animate="visible"
      transition={{ ...spring, delay: 0.08 }}
    >
      {/* Identity card */}
      <SidebarIdentity
        user={user}
        joinedLabel={joinedLabel}
        subStatus={subStatus}
        onEditProfile={onEditProfile}
        onEdit={onEditProfile}
      />

      {/* Sub card */}
      <SidebarSubCard
        subStatus={subStatus}
        onClick={() => {
          const path = subStatus?.isActive
            ? "/seller/subscription"
            : "/seller/subscription/plans";
          window.location.href = path;
        }}
      />

      {/* Scrollable nav */}
      <nav
        className="dp-sidebar-nav"
        aria-label="Profile navigation"
      >
        <div className="dp-sidebar-nav__scroll">
          {menuSections.map((section) => (
            <NavSection
              key={section.title}
              section={section}
              currentPath={currentPath}
            />
          ))}
        </div>
      </nav>

      {/* Logout */}
      <motion.button
        className="dp-sb-logout"
        onClick={onLogout}
        whileTap={{ scale: 0.97 }}
        whileHover={{ scale: 1.01 }}
        aria-label="Log out"
      >
        <LogoutIcon />
        <span>Log Out</span>
      </motion.button>
    </motion.aside>
  );
});
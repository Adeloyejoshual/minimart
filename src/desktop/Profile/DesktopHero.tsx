/* ═══════════════════════════════════════════════════════════════
   DESKTOP HERO — Wide layout identity card
═══════════════════════════════════════════════════════════════ */
import { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DesktopHeroProps } from "./types";
import { useCopyToClipboard } from "./hooks";

const spring   = { type: "spring", stiffness: 300, damping: 26 } as const;
const viewOnce = { once: true, amount: 0.15 } as const;
const fadeUp   = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };
const stagger  = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const popIn    = { hidden: { scale: 0, opacity: 0 }, visible: { scale: 1, opacity: 1 } };

/* ── Subscription map ── */
const SUB_MAP: Record<string, { label: string; gradient: string; glow: string }> = {
  premium:  { label: "Premium",  gradient: "linear-gradient(135deg,#667eea,#764ba2)", glow: "rgba(102,126,234,0.3)"  },
  pro:      { label: "Pro",      gradient: "linear-gradient(135deg,#f093fb,#f5576c)", glow: "rgba(240,147,251,0.3)"  },
  business: { label: "Business", gradient: "linear-gradient(135deg,#4facfe,#00f2fe)", glow: "rgba(79,172,254,0.3)"   },
  elite:    { label: "Elite",    gradient: "linear-gradient(135deg,#FFD700,#FFA500)", glow: "rgba(255,215,0,0.3)"    },
  diamond:  { label: "Diamond",  gradient: "linear-gradient(135deg,#a8edea,#fed6e3)", glow: "rgba(168,237,234,0.3)"  },
};

/* ── Icons ── */
const EditIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const StarIcon   = () => <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const CrownIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M3 20h18"/></svg>;
const CheckIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>;
const CopyIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
const MapPinIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const CalIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;

/* ── Avatar ── */
const HeroAvatar = memo(function HeroAvatar({
  user,
  subGradient,
  onEdit,
}: {
  user: DesktopHeroProps["user"];
  subGradient?: string;
  onEdit: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <motion.div
      className="dp-hero-avatar"
      initial={{ scale: 0.75, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 360, damping: 26, delay: 0.08 }}
    >
      {/* Spinning ring */}
      <div
        className="dp-hero-avatar__ring"
        style={subGradient ? { background: subGradient } : undefined}
      />

      {/* Photo */}
      <div className="dp-hero-avatar__photo">
        {user?.profile_image && !imgErr ? (
          <img
            src={user.profile_image}
            alt={user.name}
            onError={() => setImgErr(true)}
          />
        ) : (
          <span className="dp-hero-avatar__letter">
            {(user?.name || "U").charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Online dot */}
      <span className="dp-hero-avatar__online" title="Online" />

      {/* Edit trigger */}
      <motion.button
        className="dp-hero-avatar__edit"
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        aria-label="Change profile photo"
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.85 }}
      >
        <EditIcon />
      </motion.button>
    </motion.div>
  );
});

/* ── Main export ── */
export const DesktopHero = memo(function DesktopHero({
  user,
  joinedLabel,
  subStatus,
  listingsCount,
  onEdit,
}: DesktopHeroProps) {
  const sub          = subStatus?.isActive ? SUB_MAP[subStatus.plan ?? ""] : null;
  const { copied, copy } = useCopyToClipboard();

  return (
    <motion.section
      className="dp-hero"
      aria-label="Profile overview"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewOnce}
      transition={{ ...spring, delay: 0.04 }}
    >
      {/* ── Ambient background ── */}
      <div className="dp-hero__bg" aria-hidden="true">
        <div className="dp-hero__orb dp-hero__orb--1" />
        <div className="dp-hero__orb dp-hero__orb--2" />
        <div className="dp-hero__orb dp-hero__orb--3" />
        <div className="dp-hero__mesh" />
      </div>

      {/* ── Left column: avatar ── */}
      <div className="dp-hero__left">
        <HeroAvatar
          user={user}
          subGradient={sub?.gradient}
          onEdit={onEdit}
        />

        {/* Sub crown */}
        {sub && (
          <motion.div
            className="dp-hero__sub-crown"
            style={{ background: sub.gradient, boxShadow: `0 4px 20px ${sub.glow}` }}
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.35 }}
          >
            <CrownIcon />
            <span>{sub.label}</span>
          </motion.div>
        )}

        {/* Rating pill */}
        {user?.rating != null && (
          <motion.div
            className="dp-hero__rating"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.28 }}
          >
            <span className="dp-hero__rating-star"><StarIcon /></span>
            <span className="dp-hero__rating-val">
              {Number(user.rating).toFixed(1)}
            </span>
            <span className="dp-hero__rating-label">Rating</span>
          </motion.div>
        )}
      </div>

      {/* ── Right column: info ── */}
      <div className="dp-hero__right">

        {/* Name + verified */}
        <motion.div
          className="dp-hero__name-row"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          transition={{ ...spring, delay: 0.12 }}
        >
          <h1 className="dp-hero__name">{user?.name || "User"}</h1>
          {user?.verified && (
            <motion.span
              className="dp-hero__verified"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.28 }}
              title="Verified account"
            >
              <CheckIcon />
            </motion.span>
          )}
        </motion.div>

        {/* Store */}
        <p className="dp-hero__store">{user?.store_name || "Loemart Member"}</p>

        {/* Meta row */}
        <div className="dp-hero__meta">
          {joinedLabel && (
            <span className="dp-hero__meta-item">
              <CalIcon /> Joined {joinedLabel}
            </span>
          )}
          {user?.location_state && (
            <span className="dp-hero__meta-item">
              <MapPinIcon /> {user.location_state}
              {user.location_city && `, ${user.location_city}`}
            </span>
          )}
        </div>

        {/* Badges */}
        <motion.div
          className="dp-hero__badges"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          {user?.verified && (
            <motion.span variants={popIn} className="dp-chip dp-chip--verified">
              ✓ Verified
            </motion.span>
          )}
          {user?.is_seller && (
            <motion.span variants={popIn} className="dp-chip dp-chip--seller">
              Seller
            </motion.span>
          )}
          {user?.is_top_seller && (
            <motion.span variants={popIn} className="dp-chip dp-chip--top">
              ⭐ Top Seller
            </motion.span>
          )}
          {sub && (
            <motion.span
              variants={popIn}
              className="dp-chip dp-chip--sub"
              style={{ background: sub.gradient }}
            >
              <CrownIcon /> {sub.label}
            </motion.span>
          )}
        </motion.div>

        {/* Referral pill */}
        {user?.referral_code && (
          <motion.button
            className={`dp-hero__referral${copied ? " dp-hero__referral--copied" : ""}`}
            onClick={() => copy(user.referral_code!)}
            aria-label="Copy referral code"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.32 }}
          >
            <span className="dp-hero__referral-label">Referral Code</span>
            <span className="dp-hero__referral-code">{user.referral_code}</span>
            <AnimatePresence mode="wait">
              <motion.span
                key={copied ? "ok" : "cp"}
                className="dp-hero__referral-icon"
                initial={{ opacity: 0, scale: 0.4, rotate: -90 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.4, rotate: 90 }}
                transition={{ duration: 0.18 }}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        )}

        {/* Edit profile button */}
        <motion.button
          className="dp-hero__edit-btn"
          onClick={onEdit}
          whileHover={{ scale: 1.03, y: -1 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...spring, delay: 0.38 }}
          aria-label="Edit your profile"
        >
          <EditIcon />
          <span>Edit Profile</span>
        </motion.button>
      </div>
    </motion.section>
  );
});
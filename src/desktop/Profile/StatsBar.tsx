/* ═══════════════════════════════════════════════════════════════
   STATS BAR — Animated counters row
═══════════════════════════════════════════════════════════════ */
import { memo } from "react";
import { motion } from "framer-motion";
import type { StatsBarProps } from "./types";
import { useAnimatedCounter } from "./hooks";

const spring    = { type: "spring", stiffness: 300, damping: 26 } as const;
const viewOnce  = { once: true, amount: 0.2 } as const;
const stagger   = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const fadeScale = { hidden: { opacity: 0, scale: 0.86 }, visible: { opacity: 1, scale: 1 } };

/* ── Icons ── */
const StarIcon     = () => <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const PkgIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
const EyeIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const TrendingIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>;

const fmtNum = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "m";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString();
};

/* ── Single stat card ── */
interface StatCardProps {
  icon: React.ReactNode;
  rawValue: number;
  label: string;
  prefix?: string;
  suffix?: string;
  accent?: string;
  delay?: number;
}

const StatCard = memo(function StatCard({
  icon, rawValue, label, prefix = "", suffix = "", accent, delay = 0,
}: StatCardProps) {
  const animated = useAnimatedCounter(rawValue);
  const isFloat  = !Number.isInteger(rawValue);
  const display  = rawValue >= 1000
    ? fmtNum(animated)
    : isFloat
      ? animated.toFixed(1)
      : Math.round(animated).toLocaleString();

  return (
    <motion.div
      className="dp-stat"
      variants={fadeScale}
      transition={{ ...spring, delay }}
      whileHover={{ y: -3, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
      style={accent ? { "--dp-stat-accent": accent } as React.CSSProperties : undefined}
    >
      <span className="dp-stat__icon" aria-hidden="true">{icon}</span>
      <span className="dp-stat__value">
        {prefix}{display}{suffix}
      </span>
      <span className="dp-stat__label">{label}</span>
    </motion.div>
  );
});

export const StatsBar = memo(function StatsBar({ user, listingsCount }: StatsBarProps) {
  if (!user) return null;

  return (
    <motion.div
      className="dp-stats-bar"
      variants={stagger}
      initial="hidden"
      whileInView="visible"
      viewport={viewOnce}
      role="list"
      aria-label="Profile statistics"
    >
      {user.rating != null && (
        <StatCard
          icon={<StarIcon />}
          rawValue={Number(user.rating)}
          label="Rating"
          accent="var(--dp-gold)"
          delay={0}
        />
      )}
      <StatCard
        icon={<PkgIcon />}
        rawValue={listingsCount}
        label="Listings"
        accent="var(--dp-accent)"
        delay={0.06}
      />
      <StatCard
        icon={<EyeIcon />}
        rawValue={Number(user.total_views || 0)}
        label="Profile Views"
        accent="var(--dp-pink)"
        delay={0.12}
      />
      {user.total_sales != null && (
        <StatCard
          icon={<TrendingIcon />}
          rawValue={Number(user.total_sales)}
          label="Total Sales"
          accent="var(--dp-green)"
          delay={0.18}
        />
      )}
    </motion.div>
  );
});
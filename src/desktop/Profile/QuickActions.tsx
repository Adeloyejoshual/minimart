/* ═══════════════════════════════════════════════════════════════
   QUICK ACTIONS BAR
═══════════════════════════════════════════════════════════════ */
import { memo } from "react";
import { motion } from "framer-motion";
import type { QuickActionsProps } from "./types";

const spring = { type: "spring", stiffness: 300, damping: 26 } as const;

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0  },
};

/* ── Icons ── */
const PlusIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const DashIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>;
const MsgIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const BellIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;

export const QuickActions = memo(function QuickActions({
  onPost,
  onDashboard,
  onMessages,
  onNotifications,
  unreadCount,
}: QuickActionsProps) {
  return (
    <motion.div
      className="dp-quick-bar"
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      transition={{ ...spring, delay: 0.12 }}
      role="toolbar"
      aria-label="Quick actions"
    >
      {/* Primary — Post Listing */}
      <motion.button
        className="dp-qa dp-qa--primary"
        onClick={onPost}
        whileHover={{ scale: 1.03, y: -1 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Post a new listing"
      >
        <span className="dp-qa__icon"><PlusIcon /></span>
        <span>Post Listing</span>
        <span className="dp-qa__badge dp-qa__badge--new">NEW</span>
      </motion.button>

      {/* Dashboard */}
      <motion.button
        className="dp-qa dp-qa--outline"
        onClick={onDashboard}
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Open seller dashboard"
      >
        <span className="dp-qa__icon"><DashIcon /></span>
        <span>Dashboard</span>
      </motion.button>

      {/* Messages */}
      <motion.button
        className="dp-qa dp-qa--outline"
        onClick={onMessages}
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Open messages"
      >
        <span className="dp-qa__icon"><MsgIcon /></span>
        <span>Messages</span>
      </motion.button>

      {/* Notifications */}
      <motion.button
        className="dp-qa dp-qa--outline dp-qa--notif"
        onClick={onNotifications}
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.95 }}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      >
        <span className="dp-qa__icon dp-qa__icon--notif">
          <BellIcon />
          {unreadCount > 0 && (
            <motion.span
              className="dp-qa__notif-dot"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.span>
          )}
        </span>
        <span>Notifications</span>
      </motion.button>
    </motion.div>
  );
});
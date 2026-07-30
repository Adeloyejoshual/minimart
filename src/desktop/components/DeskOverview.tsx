// src/desktop/components/DeskOverview.tsx

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Ic, safeIc } from "../../pages/Profile/components/icons";
import { fmtNum, TIPS } from "../../pages/Profile/components/helpers";
import DeskStatCard from "./DeskStatCard";
import DeskScoreSection from "./DeskScoreSection";
import ProductRow from "./ProductRow";

/* ─────────────────────────────────────────────
   insightIcon — only keys that exist in Ic
   ✅ v2: Ic.Celebration doesn't exist → use Ic.ThumbsUp
───────────────────────────────────────────── */
const insightIcon: Record<string, React.ReactNode> = {
  warn: <Ic.AlertTriangle />,
  info: <Ic.Info />,
  good: <Ic.ThumbsUp />,   /* ✅ was Ic.Celebration (undefined → crash) */
};

/* ─────────────────────────────────────────────
   Tier config (parity with mobile Overview)
───────────────────────────────────────────── */
const TIER_CONFIG: Record<string, any> = {
  unverified: {
    badge:      "Trial",
    badgeColor: "#f59e0b",
    upgradeCta: "Verify to unlock 500 free listings",
    upgradeUrl: "/verification",
  },
  verified: {
    badge:      "Verified",
    badgeColor: "#10b981",
    upgradeCta: "Subscribe for unlimited listings",
    upgradeUrl: "/seller/subscription/plans",
  },
  subscriber: {
    badge:      "Pro",
    badgeColor: "#8b5cf6",
    upgradeCta: null,
    upgradeUrl: null,
  },
};

interface DeskOverviewProps {
  stats: any;
  analytics: any;
  products: any[];
  loading: boolean;
  userId?: string;
  deleting: string | null;
  verifying?: string | null;
  tier?: string;
  isSubscriber?: boolean;
  onNavigate: (path: string) => void;
  onSetSection: (s: string) => void;
  onEdit: (p: any) => void;
  onDelete: (p: any) => void;
  onToggle: (p: any) => void;
  onRenew: (p: any) => void;
  onPromote: (p: any) => void;
  onPayNow?: (p: any) => void;
  onVerifyPayment?: (p: any) => void;
}

export default function DeskOverview({
  stats,
  analytics,
  products,
  loading,
  userId,
  deleting,
  verifying,
  tier = "unverified",
  isSubscriber = false,
  onNavigate,
  onSetSection,
  onEdit,
  onDelete,
  onToggle,
  onRenew,
  onPromote,
  onPayNow,
  onVerifyPayment,
}: DeskOverviewProps) {
  const tierConfig = TIER_CONFIG[tier] ?? TIER_CONFIG.unverified;

  /* Tier icon — using safeIc so it never crashes */
  const TierIcon =
    tier === "subscriber" ? Ic.Zap
    : tier === "verified"  ? Ic.CheckCircle
    : Ic.Clock;

  /* Performance metrics */
  const overviewMetrics = useMemo(
    () => [
      { label: "Response Time", val: 60, color: "#6366f1" },
      {
        label: "Engagement",
        val: Math.min(100, (stats?.total_views || 0) / 10),
        color: "#0ea5e9",
      },
      {
        label: "Rating",
        val: ((stats?.rating || 0) / 5) * 100,
        color: "#f59e0b",
      },
      {
        label: "Click-Through",
        val: Math.min(
          100,
          ((stats?.total_clicks || 0) /
            Math.max(1, stats?.total_views || 1)) *
            500
        ),
        color: "#10b981",
      },
    ],
    [stats]
  );

  /* Insights — parity with mobile */
  const insights = useMemo(() => {
    if (!stats) return [];
    const list: any[] = [];
    const active        = stats.active         ?? 0;
    const activeLimited = stats.active_limited ?? 0;
    const draft         = stats.draft          ?? 0;
    const views         = stats.total_views    ?? 0;
    const totalProducts = stats.total_products ?? 0;

    if (tier === "unverified" && totalProducts >= 2) {
      list.push({
        type: "warn",
        msg: `You've used ${totalProducts}/3 free trial listings. Verify your identity to unlock 500 free listings.`,
        action: { label: "Verify Now", url: "/verification" },
      });
    }

    if (tier === "verified" && totalProducts >= 450) {
      list.push({
        type: "warn",
        msg: `You've posted ${totalProducts}/500 listings. Subscribe to Pro for unlimited posting.`,
        action: { label: "View Plans", url: "/seller/subscription/plans" },
      });
    }

    if (activeLimited > 0 && tier !== "subscriber") {
      list.push({
        type: "info",
        msg: `${activeLimited} trial listing${activeLimited > 1 ? "s" : ""} will expire soon. ${
          tier === "unverified"
            ? "Verify to make them permanent."
            : "Tap 'Activate' to convert them."
        }`,
        action:
          tier === "unverified"
            ? { label: "Verify", url: "/verification" }
            : null,
      });
    }

    if (active === 0 && activeLimited === 0) {
      list.push({
        type: "warn",
        msg: "No active listings — create or activate one to start getting views.",
      });
    }

    if (draft > 0) {
      list.push({
        type: "info",
        msg: `${draft} draft${draft > 1 ? "s" : ""} waiting to be published.`,
      });
    }

    if (active >= 5) {
      list.push({
        type: "good",
        msg: `${active} active listings — you're doing great!`,
      });
    }

    if (views > 100) {
      list.push({
        type: "good",
        msg: `${fmtNum(views)} total views — consider promoting your top listings!`,
      });
    }

    if (isSubscriber && active >= 20) {
      list.push({
        type: "good",
        msg: `${active} active listings with Pro perks — 90-day windows & priority placement!`,
      });
    }

    return list;
  }, [stats, tier, isSubscriber]);

  /* Filter out pending / deleted products from recent listings */
  const visibleProducts = useMemo(
    () =>
      (products ?? []).filter(
        (p: any) => p?.status !== "pending_payment" && !p?.is_deleted
      ),
    [products]
  );

  return (
    <div className="dkd-overview">
      {/* ── Tier Banner ── */}
      {!loading && (
        <div className={`dkd-tier-banner dkd-tier-banner--${tier}`}>
          <div className="dkd-tier-info">
            <span
              className="dkd-tier-badge"
              style={{ background: tierConfig.badgeColor }}
            >
              <TierIcon />
              {tierConfig.badge}
            </span>

            <div className="dkd-tier-text">
              <strong>
                {tier === "unverified" && "Trial Account"}
                {tier === "verified"   && "Verified Seller"}
                {tier === "subscriber" && "Pro Subscriber"}
              </strong>
              <span>
                {tier === "unverified" &&
                  `${stats?.total_products ?? 0}/3 trial listings used`}
                {tier === "verified" &&
                  `${stats?.total_products ?? 0}/500 lifetime listings used`}
                {tier === "subscriber" &&
                  "Unlimited listings · 90-day windows"}
              </span>
            </div>
          </div>

          {tierConfig.upgradeCta && (
            <Link to={tierConfig.upgradeUrl} className="dkd-tier-upgrade">
              {tierConfig.upgradeCta} <Ic.ChevronRight />
            </Link>
          )}
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div className="dkd-quick-actions">
        <button
          className="dkd-qa dkd-qa--primary"
          onClick={() => onNavigate("/minimart/add")}
        >
          <Ic.Plus />
          <span>New Listing</span>
        </button>
        <button className="dkd-qa" onClick={() => onSetSection("products")}>
          <Ic.Package />
          <span>Listings</span>
        </button>
        <button className="dkd-qa" onClick={() => onSetSection("analytics")}>
          <Ic.Chart />
          <span>Analytics</span>
        </button>
        <Link className="dkd-qa" to={`/seller/${userId || ""}`}>
          <Ic.Store />
          <span>My Store</span>
        </Link>
      </div>

      {/* ── Stats — no revenue ── */}
      {loading ? (
        <div className="dkd-stats-grid">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="dkd-stat dkd-skeleton"
              style={{ minHeight: 88 }}
            />
          ))}
        </div>
      ) : stats ? (
        <div className="dkd-stats-grid">
          <DeskStatCard
            icon={<Ic.Package />}
            label="Total Listings"
            value={fmtNum(stats.total_products ?? 0)}
            sub={`${stats.active ?? 0} active · ${stats.draft ?? 0} drafts`}
            color="#6366f1"
          />
          <DeskStatCard
            icon={<Ic.Eye />}
            label="Total Views"
            value={fmtNum(stats.total_views ?? 0)}
            sub={`${fmtNum(stats.total_clicks ?? 0)} clicks`}
            color="#0ea5e9"
          />
          <DeskStatCard
            icon={<Ic.Heart />}
            label="Saved by Buyers"
            value={fmtNum(stats.total_favorites ?? 0)}
            sub="total saves"
            color="#ec4899"
          />
        </div>
      ) : null}

      {/* ── Two-column: Performance + Insights/Tips ── */}
      <div className="dkd-overview-grid">
        <DeskScoreSection
          score={analytics?.seller_score || 0}
          metrics={overviewMetrics}
          title="Performance Score"
          subtitle="Based on engagement, response time and reviews"
        />

        <div className="dkd-overview-right">
          {insights.length > 0 && (
            <div className="dkd-card">
              <h2 className="dkd-card-title-inline">Insights</h2>
              <div className="dkd-insights">
                {insights.map((ins: any, i: number) => (
                  <div
                    key={i}
                    className={`dkd-insight dkd-insight--${ins.type}`}
                  >
                    <span className="dkd-insight-icon">
                      {insightIcon[ins.type] ?? <Ic.Info />}
                    </span>
                    <div className="dkd-insight-content">
                      <p>{ins.msg}</p>
                      {ins.action && (
                        <Link
                          to={ins.action.url}
                          className="dkd-insight-action"
                        >
                          {ins.action.label} <Ic.ChevronRight />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="dkd-card dkd-card--tips">
            <div className="dkd-card-header">
              <h2>Seller Tips</h2>
              <span className="dkd-tips-badge">
                <Ic.Zap /> Pro
              </span>
            </div>
            <div className="dkd-tips-grid">
              {TIPS.map(({ iconKey, title, desc }: any, i: number) => {
                /* ✅ safeIc always returns a valid component */
                const TipIcon = safeIc(iconKey);
                return (
                  <div key={i} className="dkd-tip">
                    <span className="dkd-tip-icon">
                      <TipIcon />
                    </span>
                    <div>
                      <p className="dkd-tip-title">{title}</p>
                      <p className="dkd-tip-desc">{desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Listings Table ── */}
      {!loading && visibleProducts.length > 0 && (
        <div className="dkd-card">
          <div className="dkd-card-header">
            <h2>Recent Listings</h2>
            <button
              className="dkd-card-link"
              onClick={() => onSetSection("products")}
            >
              View all <Ic.ChevronRight />
            </button>
          </div>
          <div className="dkd-table-wrap">
            <table className="dkd-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Views</th>
                  <th>Saves</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.slice(0, 5).map((p: any) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    tier={tier}
                    isSubscriber={isSubscriber}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggle={onToggle}
                    onRenew={onRenew}
                    onPromote={onPromote}
                    onPayNow={onPayNow}
                    onVerifyPayment={onVerifyPayment}
                    isDeleting={deleting === p.id}
                    isVerifying={verifying === p.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && visibleProducts.length === 0 && (
        <div className="dkd-card">
          <div className="dkd-empty">
            <div className="dkd-empty-icon">
              <Ic.Package />
            </div>
            <h3>No listings yet</h3>
            <p>
              Create your first listing to start selling on the marketplace.
            </p>
            <button
              className="dkd-btn dkd-btn--primary"
              onClick={() => onNavigate("/minimart/add")}
            >
              Create Listing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
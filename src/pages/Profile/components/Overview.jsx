// src/pages/Profile/components/Overview.jsx
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Ic } from "./icons";
import { fmtNum, TIPS } from "./helpers";
import StatCard from "./StatCard";
import ScoreSection from "./ScoreSection";
import ProductCard from "./ProductCard";
import EmptyState from "./EmptyState";
import { StatsSkeleton } from "./Skeletons";
import "./Overview.css";

const insightIcon = {
  warn: <Ic.AlertTriangle />,
  info: <Ic.Info />,
  good: <Ic.Celebration />,
};

/* Tier-specific config for upsell hints */
const TIER_CONFIG = {
  unverified: {
    badge     : "Trial",
    badgeColor: "#f59e0b",
    upgradeCta: "Verify to unlock 500 free listings",
    upgradeUrl: "/verification",
  },
  verified: {
    badge     : "Verified",
    badgeColor: "#10b981",
    upgradeCta: "Subscribe for unlimited listings",
    upgradeUrl: "/seller/subscription/plans",
  },
  subscriber: {
    badge     : "Pro",
    badgeColor: "#8b5cf6",
    upgradeCta: null,
    upgradeUrl: null,
  },
};

export default function Overview({
  stats,
  analytics,
  products,
  loading,
  userId,
  deleting,
  tier          = "unverified",
  isSubscriber  = false,
  onNavigate,
  onSetSection,
  onEdit,
  onDelete,
  onToggle,
  onRenew,
  onPromote,
}) {
  const tierConfig = TIER_CONFIG[tier] ?? TIER_CONFIG.unverified;

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

  const insights = useMemo(() => {
    if (!stats) return [];

    const list = [];
    const active         = stats.active         ?? 0;
    const activeLimited  = stats.active_limited ?? 0;
    const draft          = stats.draft          ?? 0;
    const views          = stats.total_views    ?? 0;
    const totalProducts  = stats.total_products ?? 0;

    /* ── Tier-specific insights ── */
    if (tier === "unverified" && totalProducts >= 2) {
      list.push({
        type: "warn",
        msg : `You've used ${totalProducts}/3 free trial listings. Verify your identity to unlock 500 free listings.`,
        action: { label: "Verify Now", url: "/verification" },
      });
    }

    if (tier === "verified" && totalProducts >= 450) {
      list.push({
        type: "warn",
        msg : `You've posted ${totalProducts}/500 listings. Subscribe to Pro for unlimited posting.`,
        action: { label: "View Plans", url: "/seller/subscription/plans" },
      });
    }

    if (activeLimited > 0 && tier !== "subscriber") {
      list.push({
        type: "info",
        msg : `${activeLimited} trial listing${activeLimited > 1 ? "s" : ""} will expire soon. Verify to make ${activeLimited > 1 ? "them" : "it"} permanent.`,
        action: tier === "unverified"
          ? { label: "Verify", url: "/verification" }
          : null,
      });
    }

    if (active === 0 && activeLimited === 0) {
      list.push({
        type: "warn",
        msg : "No active listings — create or activate one to start getting views.",
      });
    }

    if (draft > 0) {
      list.push({
        type: "info",
        msg : `${draft} draft${draft > 1 ? "s" : ""} waiting to be published.`,
      });
    }

    if (active >= 5) {
      list.push({
        type: "good",
        msg : `${active} active listings — you're doing great!`,
      });
    }

    if (views > 100) {
      list.push({
        type: "good",
        msg : `${fmtNum(views)} total views — consider promoting your top listings!`,
      });
    }

    if (isSubscriber && active >= 20) {
      list.push({
        type: "good",
        msg : `${active} active listings with Pro perks — 90-day windows & priority placement working for you!`,
      });
    }

    return list;
  }, [stats, tier, isSubscriber]);

  return (
    <div className="overview">
      {/* ── Tier Badge Banner ── */}
      {!loading && (
        <div className={`overview__tier-banner overview__tier-banner--${tier}`}>
          <div className="overview__tier-info">
            <span
              className="overview__tier-badge"
              style={{ background: tierConfig.badgeColor }}
            >
              {tier === "subscriber" ? <Ic.Zap /> : tier === "verified" ? <Ic.CheckCircle /> : <Ic.Clock />}
              {tierConfig.badge}
            </span>

            <div className="overview__tier-text">
              <strong>
                {tier === "unverified" && "Trial Account"}
                {tier === "verified"   && "Verified Seller"}
                {tier === "subscriber" && "Pro Subscriber"}
              </strong>
              <span>
                {tier === "unverified" && `${stats?.total_products ?? 0}/3 trial listings used`}
                {tier === "verified"   && `${stats?.total_products ?? 0}/500 lifetime listings used`}
                {tier === "subscriber" && "Unlimited listings · 90-day windows"}
              </span>
            </div>
          </div>

          {tierConfig.upgradeCta && (
            <Link
              to={tierConfig.upgradeUrl}
              className="overview__tier-upgrade"
            >
              {tierConfig.upgradeCta} <Ic.ChevronRight />
            </Link>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="overview__quick-actions">
        <button
          className="quick-action quick-action--primary"
          onClick={() => onNavigate("/minimart/add")}
        >
          <span className="quick-action__icon">
            <Ic.Plus />
          </span>
          <span>New Listing</span>
        </button>

        <button
          className="quick-action"
          onClick={() => onSetSection("products")}
        >
          <span className="quick-action__icon">
            <Ic.Package />
          </span>
          <span>Listings</span>
        </button>

        <button
          className="quick-action"
          onClick={() => onSetSection("analytics")}
        >
          <span className="quick-action__icon">
            <Ic.Chart />
          </span>
          <span>Analytics</span>
        </button>

        <Link className="quick-action" to={`/seller/${userId || ""}`}>
          <span className="quick-action__icon">
            <Ic.Store />
          </span>
          <span>My Store</span>
        </Link>
      </div>

      {/* Stats */}
      {loading ? (
        <StatsSkeleton />
      ) : stats ? (
        <div className="overview__stats-grid">
          <StatCard
            icon={<Ic.Package />}
            label="Total Listings"
            value={fmtNum(stats.total_products)}
            sub={`${stats.active} active · ${stats.draft} drafts`}
            color="#6366f1"
          />

          <StatCard
            icon={<Ic.Eye />}
            label="Total Views"
            value={fmtNum(stats.total_views)}
            sub={`${fmtNum(stats.total_clicks)} clicks`}
            color="#0ea5e9"
          />

          <StatCard
            icon={<Ic.Heart />}
            label="Saved by Buyers"
            value={fmtNum(stats.total_favorites)}
            sub="total saves"
            color="#ec4899"
          />
        </div>
      ) : null}

      {/* Performance Score */}
      <ScoreSection
        score={analytics?.seller_score || 0}
        metrics={overviewMetrics}
        title="Performance Score"
        subtitle="Based on engagement, response time and reviews"
      />

      {/* Insights */}
      {insights.length > 0 && (
        <div className="overview__card">
          <h2 className="overview__card-title">Insights</h2>

          <div className="overview__insights">
            {insights.map((ins, i) => (
              <div key={i} className={`insight insight--${ins.type}`}>
                <span className="insight__icon">
                  {insightIcon[ins.type]}
                </span>
                <div className="insight__content">
                  <p>{ins.msg}</p>
                  {ins.action && (
                    <Link to={ins.action.url} className="insight__action">
                      {ins.action.label} <Ic.ChevronRight />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Listings */}
      {!loading && products.length > 0 && (
        <div className="overview__card">
          <div className="overview__card-header">
            <h2 className="overview__card-title">Recent Listings</h2>

            <button
              className="overview__card-link"
              onClick={() => onSetSection("products")}
            >
              View all <Ic.ChevronRight />
            </button>
          </div>

          <div className="overview__products-list">
            {products.slice(0, 3).map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                tier={tier}
                isSubscriber={isSubscriber}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggle={onToggle}
                onRenew={onRenew}
                onPromote={onPromote}
                isDeleting={deleting === p.id}
              />
            ))}
          </div>
        </div>
      )}

      {!loading && products.length === 0 && (
        <div className="overview__card">
          <EmptyState
            icon={<Ic.Package />}
            title="No listings yet"
            description="Create your first listing to start selling on the marketplace."
            action="Create Listing"
            onAction={() => onNavigate("/minimart/add")}
          />
        </div>
      )}

      {/* Seller Tips */}
      <div className="overview__card overview__tips">
        <div className="overview__card-header">
          <h2 className="overview__card-title">Seller Tips</h2>

          <span className="overview__tips-badge">
            <Ic.Zap /> Pro
          </span>
        </div>

        <div className="overview__tips-grid">
          {TIPS.map(({ iconKey, title, desc }, i) => {
            const Icon = Ic[iconKey];

            return (
              <div key={i} className="tip">
                <span className="tip__icon">
                  <Icon />
                </span>

                <div>
                  <p className="tip__title">{title}</p>
                  <p className="tip__desc">{desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
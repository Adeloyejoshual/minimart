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

export default function Overview({
  stats,
  analytics,
  products,
  loading,
  userId,
  deleting,
  onNavigate,
  onSetSection,
  onEdit,
  onDelete,
  onToggle,
  onRenew,
  onPromote,
}) {
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
    const active = stats.active ?? 0;
    const draft = stats.draft ?? 0;
    const views = stats.total_views ?? 0;

    if (active === 0) {
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
        msg: `${fmtNum(
          views
        )} total views — consider promoting your top listings!`,
      });
    }

    return list;
  }, [stats]);

  return (
    <div className="overview">
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
                <p>{ins.msg}</p>
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
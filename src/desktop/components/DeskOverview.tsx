// src/desktop/components/DeskOverview.tsx

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Ic } from "../../pages/Profile/components/icons";
import { fmtNum, TIPS } from "../../pages/Profile/components/helpers";
import DeskStatCard from "./DeskStatCard";
import DeskScoreSection from "./DeskScoreSection";
import ProductRow from "./ProductRow";

const insightIcon: Record<string, React.ReactNode> = {
  warn: <Ic.AlertTriangle />,
  info: <Ic.Info />,
  good: <Ic.Celebration />,
};

interface DeskOverviewProps {
  stats: any;
  analytics: any;
  products: any[];
  loading: boolean;
  userId?: string;
  deleting: string | null;
  onNavigate: (path: string) => void;
  onSetSection: (s: string) => void;
  onEdit: (p: any) => void;
  onDelete: (p: any) => void;
  onToggle: (p: any) => void;
  onRenew: (p: any) => void;
  onPromote: (p: any) => void;
}

export default function DeskOverview({
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
}: DeskOverviewProps) {
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
    const list: any[] = [];
    const active = stats.active ?? 0;
    const draft = stats.draft ?? 0;
    const views = stats.total_views ?? 0;

    if (active === 0)
      list.push({
        type: "warn",
        msg: "No active listings — create or activate one to start getting views.",
      });
    if (draft > 0)
      list.push({
        type: "info",
        msg: `${draft} draft${draft > 1 ? "s" : ""} waiting to be published.`,
      });
    if (active >= 5)
      list.push({
        type: "good",
        msg: `${active} active listings — you're doing great!`,
      });
    if (views > 100)
      list.push({
        type: "good",
        msg: `${fmtNum(views)} total views — consider promoting your top listings!`,
      });
    return list;
  }, [stats]);

  return (
    <div className="dkd-overview">
      {/* Quick Actions */}
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

      {/* Stats — NO REVENUE */}
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
            value={fmtNum(stats.total_products)}
            sub={`${stats.active} active · ${stats.draft} drafts`}
            color="#6366f1"
          />
          <DeskStatCard
            icon={<Ic.Eye />}
            label="Total Views"
            value={fmtNum(stats.total_views)}
            sub={`${fmtNum(stats.total_clicks)} clicks`}
            color="#0ea5e9"
          />
          <DeskStatCard
            icon={<Ic.Heart />}
            label="Saved by Buyers"
            value={fmtNum(stats.total_favorites)}
            sub="total saves"
            color="#ec4899"
          />
        </div>
      ) : null}

      {/* Two-column: Performance + Insights/Tips */}
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
                      {insightIcon[ins.type]}
                    </span>
                    <p>{ins.msg}</p>
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
                const TipIcon = (Ic as any)[iconKey];
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

      {/* Recent Listings Table */}
      {!loading && products.length > 0 && (
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
                {products.slice(0, 5).map((p: any) => (
                  <ProductRow
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
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && products.length === 0 && (
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
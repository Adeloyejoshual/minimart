// src/pages/Profile/components/Analytics.jsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Ic } from "./icons";
import { naira, fmtNum, PH, BREAKDOWN_TAB } from "./helpers";
import StatCard from "./StatCard";
import ScoreSection from "./ScoreSection";
import EmptyState from "./EmptyState";
import "./Analytics.css";

/* ── Bar Chart ── */
function BarChart({ data = [] }) {
  if (!data.length)
    return (
      <div className="bar-chart__empty">
        <Ic.Chart />
        <p>No chart data available</p>
      </div>
    );

  const max = Math.max(...data.map((d) => d.views || 0), 1);

  return (
    <div className="bar-chart">
      <div className="bar-chart__bars">
        {data.map((d, i) => {
          const pct = Math.max(4, ((d.views || 0) / max) * 100);
          return (
            <div
              key={i}
              className="bar-chart__col"
              title={`${d.label}: ${fmtNum(d.views)} views`}
            >
              <span className="bar-chart__value">{fmtNum(d.views)}</span>
              <div className="bar-chart__track">
                <div
                  className="bar-chart__bar"
                  style={{
                    height: `${pct}%`,
                    animationDelay: `${i * 60}ms`,
                  }}
                />
              </div>
              <span className="bar-chart__label">
                {d.label?.slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="bar-chart__footer">
        <span className="bar-chart__total">
          Total:{" "}
          <strong>
            {fmtNum(data.reduce((s, d) => s + (d.views || 0), 0))}
          </strong>{" "}
          views
        </span>
      </div>
    </div>
  );
}

export default function Analytics({
  stats,
  analytics,
  loading,
  onSetSection,
  onTabChange,
}) {
  const navigate = useNavigate();

  const analyticsMetrics = useMemo(
    () => [
      {
        label: "Click-Through Rate",
        val: Math.min(
          100,
          ((stats?.total_clicks || 0) /
            Math.max(1, stats?.total_views || 1)) *
            500
        ),
        color: "#10b981",
      },
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
      { label: "Response Time", val: 60, color: "#6366f1" },
    ],
    [stats]
  );

  return (
    <div className="analytics">
      {/* Score */}
      <ScoreSection
        score={analytics?.seller_score || 0}
        metrics={analyticsMetrics}
        title="Performance Score"
        subtitle="4 key metrics"
      />

      {/* Stats */}
      {stats && (
        <div className="analytics__stats-grid">
          <StatCard
            icon={<Ic.Eye />}
            label="Views"
            value={fmtNum(stats.total_views)}
            color="#0ea5e9"
          />
          <StatCard
            icon={<Ic.Chart />}
            label="Clicks"
            value={fmtNum(stats.total_clicks)}
            color="#6366f1"
          />
          <StatCard
            icon={<Ic.Heart />}
            label="Saves"
            value={fmtNum(stats.total_favorites)}
            color="#ec4899"
          />
          <StatCard
            icon={<Ic.Package />}
            label="Active"
            value={fmtNum(stats.active)}
            color="#10b981"
          />
        </div>
      )}

      {/* Chart */}
      <div className="analytics__card">
        <div className="analytics__card-header">
          <h2 className="analytics__card-title">Views — Last 7 Days</h2>
        </div>
        {loading ? (
          <div className="analytics__chart-loading">
            <span className="spinner" /> Loading chart…
          </div>
        ) : (
          <BarChart data={analytics?.daily || []} />
        )}
      </div>

      {/* Top Listings */}
      {analytics?.top_products?.length > 0 && (
        <div className="analytics__card">
          <div className="analytics__card-header">
            <h2 className="analytics__card-title">
              <Ic.Star /> Top Listings
            </h2>
          </div>
          <div className="analytics__top-list">
            {analytics.top_products.map((p, i) => (
              <div
                key={p.id}
                className="analytics__top-item"
                onClick={() =>
                  navigate(`/product/${p.slug || p.id}`)
                }
              >
                <span className="analytics__top-rank">#{i + 1}</span>
                <img
                  src={p.image || PH}
                  alt={p.title}
                  className="analytics__top-img"
                  onError={(e) => {
                    e.currentTarget.src = PH;
                  }}
                />
                <div className="analytics__top-info">
                  <p className="analytics__top-title">{p.title}</p>
                  <div className="analytics__top-stats">
                    <span>
                      <Ic.Eye /> {fmtNum(p.views)}
                    </span>
                    <span>
                      <Ic.Heart /> {fmtNum(p.favorites_count)}
                    </span>
                    {p.ctr > 0 && <span>{p.ctr}% CTR</span>}
                  </div>
                </div>
                <span className="analytics__top-price">
                  {naira(p.price)}
                </span>
                <Ic.ChevronRight />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breakdown */}
      {stats && (
        <div className="analytics__card">
          <h2 className="analytics__card-title">Status Breakdown</h2>
          <div className="analytics__breakdown-grid">
            {[
              {
                label: "Active",
                count: stats.active,
                color: "#10b981",
                icon: <Ic.Play />,
              },
              {
                label: "Drafts",
                count: stats.draft,
                color: "#f59e0b",
                icon: <Ic.Edit />,
              },
              {
                label: "Paused",
                count: stats.paused,
                color: "#6b7280",
                icon: <Ic.Pause />,
              },
              {
                label: "Pending",
                count: stats.pending_payment,
                color: "#3b82f6",
                icon: <Ic.Clock />,
              },
            ].map((b) => (
              <div
                key={b.label}
                className="breakdown-card"
                onClick={() => {
                  onSetSection("products");
                  onTabChange(BREAKDOWN_TAB[b.label] || "all");
                }}
              >
                <div
                  className="breakdown-card__icon"
                  style={{ color: b.color }}
                >
                  {b.icon}
                </div>
                <p
                  className="breakdown-card__count"
                  style={{ color: b.color }}
                >
                  {b.count ?? 0}
                </p>
                <p className="breakdown-card__label">{b.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!analytics && !loading && (
        <div className="analytics__card">
          <EmptyState
            icon={<Ic.Chart />}
            title="No analytics yet"
            description="Analytics will appear once your listings get some traffic."
          />
        </div>
      )}
    </div>
  );
}
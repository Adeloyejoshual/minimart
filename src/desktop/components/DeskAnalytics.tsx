// src/desktop/components/DeskAnalytics.tsx

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Ic } from "../../pages/Profile/components/icons";
import { naira, fmtNum, PH, BREAKDOWN_TAB } from "../../pages/Profile/components/helpers";
import DeskStatCard from "./DeskStatCard";
import DeskScoreSection from "./DeskScoreSection";

/* ── BarChart ── */
function BarChart({ data = [] }: { data?: any[] }) {
  if (!data.length)
    return (
      <div className="dkd-chart-empty">
        <Ic.Chart />
        <p>No chart data available</p>
      </div>
    );

  const max = Math.max(...data.map((d: any) => d.views || 0), 1);

  return (
    <div className="dkd-chart">
      <div className="dkd-chart-bars">
        {data.map((d: any, i: number) => {
          const pct = Math.max(4, ((d.views || 0) / max) * 100);
          return (
            <div
              key={i}
              className="dkd-bar-col"
              title={`${d.label}: ${fmtNum(d.views)} views`}
            >
              <span className="dkd-bar-value">{fmtNum(d.views)}</span>
              <div className="dkd-bar-track">
                <div
                  className="dkd-bar"
                  style={{
                    height: `${pct}%`,
                    animationDelay: `${i * 60}ms`,
                  }}
                />
              </div>
              <span className="dkd-bar-label">{d.label?.slice(0, 3)}</span>
            </div>
          );
        })}
      </div>
      <div className="dkd-chart-footer">
        <span>
          Total:{" "}
          <strong>
            {fmtNum(data.reduce((s: number, d: any) => s + (d.views || 0), 0))}
          </strong>{" "}
          views
        </span>
      </div>
    </div>
  );
}

interface DeskAnalyticsProps {
  stats: any;
  analytics: any;
  loading: boolean;
  onSetSection: (s: string) => void;
  onTabChange: (t: string) => void;
}

export default function DeskAnalytics({
  stats,
  analytics,
  loading,
  onSetSection,
  onTabChange,
}: DeskAnalyticsProps) {
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
    <div className="dkd-analytics">
      {/* Score + stats side by side */}
      <div className="dkd-analytics-top">
        <DeskScoreSection
          score={analytics?.seller_score || 0}
          metrics={analyticsMetrics}
          title="Performance Score"
          subtitle="4 key metrics"
        />

        {stats && (
          <div className="dkd-analytics-stats">
            <DeskStatCard
              icon={<Ic.Eye />}
              label="Views"
              value={fmtNum(stats.total_views)}
              color="#0ea5e9"
            />
            <DeskStatCard
              icon={<Ic.Chart />}
              label="Clicks"
              value={fmtNum(stats.total_clicks)}
              color="#6366f1"
            />
            <DeskStatCard
              icon={<Ic.Heart />}
              label="Saves"
              value={fmtNum(stats.total_favorites)}
              color="#ec4899"
            />
            <DeskStatCard
              icon={<Ic.Package />}
              label="Active"
              value={fmtNum(stats.active)}
              color="#10b981"
            />
          </div>
        )}
      </div>

      {/* Chart + top listings */}
      <div className="dkd-analytics-mid">
        <div className="dkd-card dkd-analytics-chart">
          <div className="dkd-card-header">
            <h2>Views — Last 7 Days</h2>
          </div>
          {loading ? (
            <div className="dkd-chart-empty">
              <span className="dkd-spinner" /> Loading chart…
            </div>
          ) : (
            <BarChart data={analytics?.daily || []} />
          )}
        </div>

        {analytics?.top_products?.length > 0 && (
          <div className="dkd-card dkd-analytics-top-list">
            <div className="dkd-card-header">
              <h2>
                <Ic.Star /> Top Listings
              </h2>
            </div>
            <div className="dkd-top-list">
              {analytics.top_products.map((p: any, i: number) => (
                <div
                  key={p.id}
                  className="dkd-top-item"
                  onClick={() => navigate(`/product/${p.slug || p.id}`)}
                >
                  <span className="dkd-top-rank">#{i + 1}</span>
                  <img
                    src={p.image || PH}
                    alt={p.title}
                    className="dkd-top-img"
                    onError={(e: any) => {
                      e.currentTarget.src = PH;
                    }}
                  />
                  <div className="dkd-top-info">
                    <p className="dkd-top-title">{p.title}</p>
                    <div className="dkd-top-stats">
                      <span>
                        <Ic.Eye /> {fmtNum(p.views)}
                      </span>
                      <span>
                        <Ic.Heart /> {fmtNum(p.favorites_count)}
                      </span>
                      {p.ctr > 0 && <span>{p.ctr}% CTR</span>}
                    </div>
                  </div>
                  <span className="dkd-top-price">{naira(p.price)}</span>
                  <Ic.ChevronRight />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Breakdown */}
      {stats && (
        <div className="dkd-card">
          <h2 className="dkd-card-title-inline">Status Breakdown</h2>
          <div className="dkd-breakdown-grid">
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
                className="dkd-breakdown-card"
                onClick={() => {
                  onSetSection("products");
                  onTabChange(
                    BREAKDOWN_TAB[b.label as keyof typeof BREAKDOWN_TAB] ||
                      "all"
                  );
                }}
              >
                <div
                  className="dkd-breakdown-icon"
                  style={{ color: b.color }}
                >
                  {b.icon}
                </div>
                <p
                  className="dkd-breakdown-count"
                  style={{ color: b.color }}
                >
                  {b.count ?? 0}
                </p>
                <p className="dkd-breakdown-label">{b.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!analytics && !loading && (
        <div className="dkd-card">
          <div className="dkd-empty">
            <div className="dkd-empty-icon">
              <Ic.Chart />
            </div>
            <h3>No analytics yet</h3>
            <p>
              Analytics will appear once your listings get some traffic.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
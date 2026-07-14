import { useState, useMemo } from "react";
import {
  C, naira, PLAN_SLUGS, PLAN_BADGE, PLAN_LABELS,
  Btn, BarChart,
} from "./SubscriptionUI.jsx";

/* ─── StatCard ───────────────────────────────────────────────────────────── */
export function StatCard({ label, value, sub, accent, onClick, trend }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
        padding: "15px 17px", cursor: onClick ? "pointer" : "default",
        transition: "box-shadow .15s",
      }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "")}
    >
      <div style={{ fontSize: ".68rem", color: C.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: ".04em" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: "1.4rem", fontWeight: 700, color: accent ?? C.text, lineHeight: 1.1 }}>
          {value ?? "—"}
        </div>
        {trend !== undefined && (
          <span style={{ fontSize: ".65rem", fontWeight: 700, color: trend >= 0 ? C.green : C.red }}>
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%
          </span>
        )}
      </div>
      {sub && (
        <div style={{ fontSize: ".67rem", color: C.muted, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

/* ─── KPIRow ─────────────────────────────────────────────────────────────── */
export function KPIRow({ stats }) {
  const kpis = [
    { label: "MRR",             value: stats.mrr             ? naira(stats.mrr)             : "—", accent: C.orange, sub: "monthly recurring"    },
    { label: "ARR",             value: stats.arr             ? naira(stats.arr)             : "—", accent: C.orange, sub: "annual recurring"      },
    { label: "ARPU",            value: stats.arpu            ? naira(stats.arpu)            : "—", accent: C.blue,   sub: "avg revenue / user"    },
    { label: "LTV",             value: stats.ltv             ? naira(stats.ltv)             : "—", accent: C.purple, sub: "lifetime value"         },
    { label: "Renewal Rate",    value: stats.renewalRate     ? `${stats.renewalRate}%`      : "—", accent: C.green,  sub: "of active subs"        },
    { label: "Churn Rate",      value: stats.churnRate       ? `${stats.churnRate}%`        : "—", accent: C.red,    sub: "monthly churn"         },
    { label: "Trial → Paid",    value: stats.trialConversion ? `${stats.trialConversion}%`  : "—", accent: C.blue,   sub: "trial conversion"      },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
      {kpis.map((k) => <StatCard key={k.label} {...k} />)}
    </div>
  );
}

/* ─── MainStatCards ──────────────────────────────────────────────────────── */
export function MainStatCards({ stats, onFilterStatus }) {
  const cards = [
    { label: "Active",            value: stats.active    ?? "—", accent: C.green,  sub: "paying subscribers", status: "active"    },
    { label: "Total",             value: stats.total     ?? "—", accent: C.text,   sub: "all time"                                },
    { label: "Expired",           value: stats.expired   ?? "—", accent: C.muted,  sub: "lapsed",             status: "expired"   },
    { label: "Cancelled",         value: stats.cancelled ?? "—", accent: C.red,    sub: "user-cancelled",     status: "cancelled" },
    { label: "Suspended",         value: stats.suspended ?? "—", accent: "#c2410c",sub: "admin-suspended",    status: "suspended" },
    { label: "New Today",         value: stats.today     ?? "—", accent: C.blue,   sub: "subscriptions today"                     },
    { label: "Revenue Today",     value: stats.revenueToday     ? naira(stats.revenueToday)     : "—", accent: C.orange },
    { label: "Revenue This Month",value: stats.revenueThisMonth ? naira(stats.revenueThisMonth) : "—", accent: C.orange },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 14 }}>
      {cards.map((c) => (
        <StatCard
          key={c.label}
          {...c}
          onClick={c.status ? () => onFilterStatus?.(c.status) : undefined}
        />
      ))}
    </div>
  );
}

/* ─── PlanDistribution ───────────────────────────────────────────────────── */
export function PlanDistribution({ byPlan }) {
  const total = Object.values(byPlan).reduce((a, b) => a + b, 0) || 1;
  const planColors = {
    premium: "#eab308", pro: C.orange, business: "#9333ea",
    elite: C.blue, diamond: "#06b6d4",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {PLAN_SLUGS.map((slug) => {
        const count = byPlan[slug] ?? 0;
        const pct   = Math.round((count / total) * 100);
        return (
          <div key={slug} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 72, fontSize: ".72rem", fontWeight: 600, color: C.text }}>
              {PLAN_BADGE[slug]} {PLAN_LABELS[slug]}
            </span>
            <div style={{ flex: 1, background: C.border, borderRadius: 100, height: 8, overflow: "hidden" }}>
              <div style={{
                width: `${pct}%`, height: "100%", borderRadius: 100,
                background: planColors[slug], transition: "width .4s",
              }} />
            </div>
            <span style={{ width: 28, textAlign: "right", fontSize: ".72rem", color: C.muted }}>{count}</span>
            <span style={{ width: 34, fontSize: ".68rem", color: C.muted }}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── ExpiringWidget ─────────────────────────────────────────────────────── */
export function ExpiringWidget({ expiring = [], onFilter }) {
  const now  = Date.now();
  const today  = expiring.filter((s) => new Date(s.expires_at) <= new Date(now + 86400000)).length;
  const in3    = expiring.filter((s) => { const d = new Date(s.expires_at); return d > new Date(now + 86400000) && d <= new Date(now + 3 * 86400000); }).length;
  const inWeek = expiring.filter((s) => { const d = new Date(s.expires_at); return d > new Date(now + 3 * 86400000) && d <= new Date(now + 7 * 86400000); }).length;

  const rows = [
    { label: "Expires Today",     count: today,  color: C.red     },
    { label: "Expires in 3 Days", count: in3,    color: "#c2410c" },
    { label: "Expires this Week", count: inWeek, color: "#854d0e" },
  ];

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px" }}>
      <div style={{ fontSize: ".78rem", fontWeight: 700, marginBottom: 10 }}>⏰ Expiring Soon</div>
      {rows.map((r) => (
        <div key={r.label} onClick={() => onFilter?.()} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "5px 0", cursor: "pointer",
        }}>
          <span style={{ fontSize: ".75rem", color: C.muted }}>{r.label}</span>
          <span style={{
            background: r.count > 0 ? "#fef2f2" : C.bg,
            color: r.count > 0 ? r.color : C.muted,
            borderRadius: 100, padding: "1px 10px", fontWeight: 700, fontSize: ".75rem",
          }}>
            {r.count}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── ChurnWidget ────────────────────────────────────────────────────────── */
export function ChurnWidget({ churn = {} }) {
  const rows = [
    { label: "Cancelled Today", value: churn.cancelledToday ?? 0, color: C.red    },
    { label: "Cancelled Week",  value: churn.cancelledWeek  ?? 0, color: "#c2410c"},
    { label: "Expired",         value: churn.expired        ?? 0, color: C.muted  },
    { label: "Reactivated",     value: churn.reactivated    ?? 0, color: C.green  },
    { label: "Renewed",         value: churn.renewed        ?? 0, color: C.blue   },
  ];
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px" }}>
      <div style={{ fontSize: ".78rem", fontWeight: 700, marginBottom: 10 }}>📉 Churn Analytics</div>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
          <span style={{ fontSize: ".75rem", color: C.muted }}>{r.label}</span>
          <span style={{ fontWeight: 700, fontSize: ".78rem", color: r.color }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── RenewalForecast ────────────────────────────────────────────────────── */
export function RenewalForecast({ forecast = {} }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px" }}>
      <div style={{ fontSize: ".78rem", fontWeight: 700, marginBottom: 10 }}>🔮 Renewal Forecast</div>
      {[
        { label: "Next 7 Days",  count: forecast.next7Days  ?? "—", revenue: forecast.revenue7  },
        { label: "Next 30 Days", count: forecast.next30Days ?? "—", revenue: forecast.revenue30 },
      ].map((r) => (
        <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: ".75rem", fontWeight: 600 }}>{r.label}</div>
            <div style={{ fontSize: ".68rem", color: C.muted }}>{r.count} renewals</div>
          </div>
          {r.revenue && (
            <div style={{ fontSize: ".82rem", fontWeight: 700, color: C.orange }}>
              {naira(r.revenue)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── TopSubscribers ─────────────────────────────────────────────────────── */
export function TopSubscribers({ topSubs = [] }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px" }}>
      <div style={{ fontSize: ".78rem", fontWeight: 700, marginBottom: 10 }}>🏆 Top Subscribers</div>
      {!topSubs.length ? (
        <p style={{ fontSize: ".75rem", color: C.muted }}>No data available.</p>
      ) : (
        topSubs.slice(0, 5).map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{
              width: 22, height: 22, borderRadius: "50%",
              background: i === 0 ? "#fef9c3" : C.bg,
              color: i === 0 ? "#854d0e" : C.muted,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: ".68rem", fontWeight: 700, flexShrink: 0,
            }}>
              {i + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: ".75rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.user_name ?? "—"}
              </div>
              <div style={{ fontSize: ".65rem", color: C.muted }}>
                {PLAN_BADGE[s.plan_slug]} {s.plan_slug}
              </div>
            </div>
            <div style={{ fontSize: ".75rem", fontWeight: 700, color: C.orange, flexShrink: 0 }}>
              {s.total_spend ? naira(s.total_spend) : "—"}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ─── RevenueChartPanel ──────────────────────────────────────────────────── */
export function RevenueChartPanel({ revenueData }) {
  const [range, setRange] = useState("daily");

  const chartData = useMemo(() => {
    return (revenueData[range] ?? []).map((d) => ({
      label : d.label ?? d.date ?? "—",
      value : d.amount ?? 0,
    }));
  }, [revenueData, range]);

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontWeight: 700, fontSize: ".82rem" }}>📈 Revenue</span>
        <div style={{ display: "flex", gap: 4 }}>
          {["daily", "weekly", "monthly"].map((r) => (
            <Btn key={r} variant={range === r ? "primary" : "ghost"} onClick={() => setRange(r)}
              style={{ fontSize: ".65rem", padding: "3px 8px" }}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </Btn>
          ))}
        </div>
      </div>
      <BarChart data={chartData} height={110} />
    </div>
  );
}

/* ─── AnalyticsGrid ──────────────────────────────────────────────────────── */
export function AnalyticsGrid({ stats, revenueData, expiring, churn, forecast, topSubs, onFilterStatus }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>

      <MainStatCards stats={stats} onFilterStatus={onFilterStatus} />

      <KPIRow stats={stats} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 220px 220px", gap: 12 }}>
        <RevenueChartPanel revenueData={revenueData} />
        <ExpiringWidget expiring={expiring} onFilter={() => onFilterStatus?.("active")} />
        <ChurnWidget churn={churn} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 220px 220px", gap: 12 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: ".78rem", fontWeight: 700, marginBottom: 12 }}>📊 Plan Distribution</div>
          <PlanDistribution byPlan={stats.byPlan ?? {}} />
        </div>
        <RenewalForecast forecast={forecast} />
        <TopSubscribers topSubs={topSubs} />
      </div>
    </div>
  );
}
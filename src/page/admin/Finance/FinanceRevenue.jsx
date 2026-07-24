// src/pages/admin/Finance/FinanceRevenue.jsx

import { useMemo } from "react";
import { fmtN } from "../adminlayout/helpers";
import { Card } from "../adminlayout/atoms";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts";

export default function FinanceRevenue({
  stats, payments, subscriptionStats,
}) {
  const salesData = useMemo(() =>
    (stats.dailySales ?? []).map((d) => ({
      date: d.date?.slice(5),
      revenue: Number(d.amount),
    })),
    [stats.dailySales],
  );

  const methodBreakdown = useMemo(() => {
    const map = {};
    payments.forEach((p) => {
      const method = p.method || "unknown";
      map[method] = (map[method] || 0) + Number(p.amount || 0);
    });
    return Object.entries(map).map(([method, amount]) => ({
      method, amount,
    }));
  }, [payments]);

  const planBreakdown = useMemo(() => {
    const byPlan = subscriptionStats?.byPlan ?? {};
    return Object.entries(byPlan).map(([plan, count]) => ({
      plan, count,
    }));
  }, [subscriptionStats]);

  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>📈 Revenue Analytics</h1>
          <p style={{ color: "var(--muted)", fontSize: ".78rem", marginTop: 4 }}>
            Detailed breakdown of platform revenue and trends
          </p>
        </div>
      </div>

      {/* Big numbers */}
      <div style={{
        display             : "grid",
        gridTemplateColumns : "repeat(auto-fit, minmax(200px, 1fr))",
        gap                 : 12,
        marginBottom        : 16,
      }}>
        <RevenueCard
          label="Total Revenue"
          value={fmtN(stats.revenue)}
          color="#22c55e"
        />
        <RevenueCard
          label="Today's Revenue"
          value={fmtN(stats.todayRevenue)}
          color="#3b82f6"
        />
        <RevenueCard
          label="Monthly Recurring"
          value={fmtN(subscriptionStats?.mrr ?? 0)}
          color="#a855f7"
        />
        <RevenueCard
          label="Annual Recurring"
          value={fmtN(subscriptionStats?.arr ?? 0)}
          color="#f59e42"
        />
      </div>

      {/* 30-day chart */}
      <Card title="Revenue — Last 30 Days">
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#aaa" style={{ fontSize: 11 }} />
              <YAxis stroke="#aaa" style={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "#0f1320",
                  border: "1px solid #222c44",
                  borderRadius: 8,
                }}
                formatter={(v) => fmtN(v)}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#22c55e"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Payment methods */}
      {methodBreakdown.length > 0 && (
        <Card title="Revenue by Payment Method">
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={methodBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="method" stroke="#aaa" style={{ fontSize: 11 }} />
                <YAxis stroke="#aaa" style={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "#0f1320",
                    border: "1px solid #222c44",
                    borderRadius: 8,
                  }}
                  formatter={(v) => fmtN(v)}
                />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Subscription plan breakdown */}
      {planBreakdown.length > 0 && (
        <Card title="Active Subscriptions by Plan">
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={planBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="plan" stroke="#aaa" style={{ fontSize: 11 }} />
                <YAxis stroke="#aaa" style={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "#0f1320",
                    border: "1px solid #222c44",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </>
  );
}

function RevenueCard({ label, value, color }) {
  return (
    <div style={{
      background   : "var(--card)",
      border       : "1px solid var(--border)",
      borderRadius : 12,
      padding      : "18px 20px",
    }}>
      <div style={{
        fontSize      : ".7rem",
        color         : "var(--muted)",
        textTransform : "uppercase",
        letterSpacing : ".5px",
        fontWeight    : 700,
      }}>
        {label}
      </div>
      <div style={{
        fontSize   : "1.8rem",
        fontWeight : 800,
        color,
        marginTop  : 6,
      }}>
        {value}
      </div>
    </div>
  );
}
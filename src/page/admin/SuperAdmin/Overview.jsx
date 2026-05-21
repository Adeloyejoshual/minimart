import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { fmt, fmtN, fmtDateS } from "../adminlayout/helpers";
import { StatCard, Card, LogItem, Pill } from "../adminlayout/atoms";
import { TT, PIE_COLORS } from "../adminlayout/helpers";

export default function Overview({
  stats, userStats, salesData, prodStatusData,
  logs, products, pending, lastProducts, goTo,
}) {
  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>Overview</h1>
          <div className="ph-sub">
            {new Date().toLocaleDateString("en-NG", { dateStyle: "full" })}
          </div>
        </div>
      </div>

      <div className="sg">
        <StatCard label="Total Users"    value={fmt(userStats.total)}                         color="c-blue"   delta="All time" />
        <StatCard label="Active Users"   value={fmt(userStats.active)}                        color="c-green"  />
        <StatCard label="Banned Users"   value={fmt(userStats.banned)}                        color="c-red"    />
        <StatCard label="All Products"   value={fmt(stats.totalProducts || products.length)}  color="c-blue"   delta="All time" />
        <StatCard label="Pending Review" value={fmt(stats.pendingProducts || pending.length)} color="c-amber"  />
        <StatCard label="Total Orders"   value={fmt(stats.orders)}                            color="c-purple" />
        <StatCard label="Total Revenue"  value={fmtN(stats.revenue)}                         color="c-green"  delta="All time" />
      </div>

      <Card title="Today at a Glance">
        <div className="today-grid">
          {[
            { label: "New Users",    val: fmt(stats.todayUsers   ?? 0), color: "c-blue"   },
            { label: "New Products", val: fmt(stats.todayProducts ?? 0), color: "c-green"  },
            { label: "Orders",       val: fmt(stats.todayOrders  ?? 0), color: "c-purple" },
            { label: "Revenue",      val: fmtN(stats.todayRevenue ?? 0), color: "c-amber"  },
          ].map(({ label, val, color }) => (
            <div key={label} className="today-cell">
              <div className="today-cell-label">{label}</div>
              <div className={`today-cell-val ${color}`}>{val}</div>
            </div>
          ))}
        </div>
      </Card>

      {salesData.length > 0 && (
        <Card title="Daily Sales (Last 30 days)">
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222c44" />
                <XAxis dataKey="date" tick={{ fill: "#5e6e94", fontSize: 11 }} />
                <YAxis tick={{ fill: "#5e6e94", fontSize: 11 }} />
                <Tooltip contentStyle={TT} formatter={(v) => [fmtN(v), "Sales"]} />
                <Line type="monotone" dataKey="sales" stroke="#4f8cff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title="Product Status">
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={prodStatusData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222c44" />
                <XAxis dataKey="status" tick={{ fill: "#5e6e94", fontSize: 11 }} />
                <YAxis tick={{ fill: "#5e6e94", fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={TT} />
                <Bar dataKey="count" fill="#1dd6a0" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="User Split">
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Active", value: userStats.active },
                    { name: "Banned", value: userStats.banned },
                  ]}
                  cx="50%" cy="50%" innerRadius={48} outerRadius={72}
                  paddingAngle={3} dataKey="value"
                >
                  {["#4f8cff", "#f43f5e"].map((c, i) => (
                    <Cell key={i} fill={c} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TT} />
                <Legend
                  iconType="circle"
                  formatter={(v) => (
                    <span style={{ color: "var(--text)", fontSize: ".72rem" }}>{v}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card
        title="Latest Products"
        actions={[
          <button key="v" className="btn b-blue" onClick={() => goTo("products")}>
            View all
          </button>,
        ]}
      >
        <div className="last-products-list">
          {lastProducts.map((p) => (
            <div key={p.id} className="lp-row">
              {p.thumbnail_url ? (
                <img className="lp-thumb" src={p.thumbnail_url} alt="" />
              ) : (
                <div className="lp-thumb-ph">img</div>
              )}
              <div className="lp-info">
                <div className="lp-title">{p.name || p.title || "Untitled"}</div>
                <div className="lp-meta">
                  {p.seller_name || "Unknown seller"}
                  {p.category_name ? ` · ${p.category_name}` : ""}
                  {p.location_city ? ` · ${p.location_city}` : ""}
                </div>
              </div>
              <div className="lp-right">
                <div className="lp-price">{fmtN(p.price)}</div>
                <div className="lp-date">{fmtDateS(p.created_at)}</div>
                <Pill s={p.status} />
              </div>
            </div>
          ))}
          {!lastProducts.length && <div className="empty">No products yet</div>}
        </div>
      </Card>

      <Card
        title="Recent Activity"
        actions={[
          <span key="l" style={{ fontSize: ".68rem", color: "var(--muted)" }}>
            {logs.length} events
          </span>,
          <button key="a" className="btn b-blue" onClick={() => goTo("logs")}>
            See all
          </button>,
        ]}
      >
        <div className="log-list">
          {logs.slice(0, 7).map((l) => <LogItem key={l.id} log={l} />)}
          {!logs.length && <div className="empty">No activity yet</div>}
        </div>
      </Card>
    </>
  );
}
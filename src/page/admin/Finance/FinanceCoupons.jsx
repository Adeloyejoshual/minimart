// src/page/admin/Finance/FinanceCoupons.jsx

import { useEffect, useState, useMemo } from "react";
import { fmt, fmtN, fmtDate } from "../adminlayout/helpers";
import { Pill, Card, Rfr } from "../adminlayout/atoms";
import toast from "react-hot-toast";

export default function FinanceCoupons({ api, confirm }) {
  const [coupons,      setCoupons]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [busy,         setBusy]         = useState(null);
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showForm,     setShowForm]     = useState(false);

  const [form, setForm] = useState({
    code             : "",
    discount_type    : "percent",
    discount_value   : 10,
    max_uses         : 100,
    expires_at       : "",
    min_purchase     : 0,
    applies_to       : "all",
    is_active        : true,
  });

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/coupons");
      setCoupons(data?.coupons || data || []);
    } catch (err) {
      console.warn("[finance] coupons fetch:", err.message);
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const stats = useMemo(() => {
    const active   = coupons.filter((c) => c.is_active).length;
    const inactive = coupons.filter((c) => !c.is_active).length;
    const totalUsed = coupons.reduce(
      (s, c) => s + Number(c.uses_count || 0), 0,
    );
    return {
      total: coupons.length,
      active,
      inactive,
      totalUsed,
    };
  }, [coupons]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return coupons.filter((c) => {
      const matchSearch = (c.code ?? "").toLowerCase().includes(q);
      const matchStatus =
        filterStatus === "all" ||
        (filterStatus === "active"   &&  c.is_active) ||
        (filterStatus === "inactive" && !c.is_active);
      return matchSearch && matchStatus;
    });
  }, [coupons, search, filterStatus]);

  const create = async () => {
    if (!form.code.trim()) return toast.error("Code is required");
    if (!form.discount_value) return toast.error("Discount value required");

    setBusy("create");
    try {
      await api.post("/coupons", {
        ...form,
        code: form.code.trim().toUpperCase(),
        discount_value: Number(form.discount_value),
        max_uses: Number(form.max_uses),
        min_purchase: Number(form.min_purchase),
        expires_at: form.expires_at || null,
      });
      toast.success(`Coupon "${form.code}" created`);
      setForm({
        code             : "",
        discount_type    : "percent",
        discount_value   : 10,
        max_uses         : 100,
        expires_at       : "",
        min_purchase     : 0,
        applies_to       : "all",
        is_active        : true,
      });
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Create failed");
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (c) => {
    setBusy(`t-${c.id}`);
    try {
      await api.patch(`/coupons/${c.id}`, {
        is_active: !c.is_active,
      });
      toast.success(c.is_active ? "Deactivated" : "Activated");
      await load();
    } catch (err) {
      toast.error(err.message || "Toggle failed");
    } finally {
      setBusy(null);
    }
  };

  const remove = (c) => {
    confirm({
      title:   "Delete Coupon?",
      body:    `Permanently delete "${c.code}"? This cannot be undone.`,
      danger:  true,
      confirm: "Yes, Delete",
      action:  async () => {
        setBusy(`d-${c.id}`);
        try {
          await api.del(`/coupons/${c.id}`);
          toast.success("Coupon deleted");
          await load();
        } catch (err) {
          toast.error(err.message || "Delete failed");
        } finally {
          setBusy(null);
        }
      },
    });
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success(`Copied ${code}`);
  };

  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>
            🎟️ Coupons{" "}
            <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "1rem" }}>
              ({fmt(filtered.length)})
            </span>
          </h1>
          <p style={{ color: "var(--muted)", fontSize: ".78rem", marginTop: 4 }}>
            Create and manage discount coupons for the platform
          </p>
        </div>
        <div className="ph-right">
          <Rfr onClick={load} />
          <button className="btn b-solid" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "✕ Close" : "+ New Coupon"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display             : "grid",
        gridTemplateColumns : "repeat(auto-fit, minmax(140px, 1fr))",
        gap                 : 10,
        marginBottom        : 12,
      }}>
        <StatBox label="Total"    value={fmt(stats.total)}    color="#3b82f6" />
        <StatBox label="Active"   value={fmt(stats.active)}   color="#22c55e" />
        <StatBox label="Inactive" value={fmt(stats.inactive)} color="#ef4444" />
        <StatBox label="Used"     value={fmt(stats.totalUsed)} color="#a855f7" />
      </div>

      {/* Create Form */}
      {showForm && (
        <Card title="Create New Coupon">
          <div className="form-grid">
            <div className="form-group">
              <label>Code *</label>
              <input
                className="input"
                value={form.code}
                onChange={set("code")}
                placeholder="SAVE20"
                style={{ textTransform: "uppercase" }}
              />
            </div>
            <div className="form-group">
              <label>Discount Type</label>
              <select
                className="input"
                value={form.discount_type}
                onChange={set("discount_type")}
              >
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₦)</option>
              </select>
            </div>
            <div className="form-group">
              <label>
                Discount Value {form.discount_type === "percent" ? "(%)" : "(₦)"}
              </label>
              <input
                className="input"
                type="number"
                value={form.discount_value}
                onChange={set("discount_value")}
              />
            </div>
            <div className="form-group">
              <label>Max Uses</label>
              <input
                className="input"
                type="number"
                value={form.max_uses}
                onChange={set("max_uses")}
              />
            </div>
            <div className="form-group">
              <label>Min Purchase (₦)</label>
              <input
                className="input"
                type="number"
                value={form.min_purchase}
                onChange={set("min_purchase")}
              />
            </div>
            <div className="form-group">
              <label>Expires (optional)</label>
              <input
                className="input"
                type="date"
                value={form.expires_at}
                onChange={set("expires_at")}
              />
            </div>
            <div className="form-group">
              <label>Applies To</label>
              <select
                className="input"
                value={form.applies_to}
                onChange={set("applies_to")}
              >
                <option value="all">All Purchases</option>
                <option value="subscription">Subscriptions Only</option>
                <option value="products">Products Only</option>
              </select>
            </div>
            <div className="form-full" style={{
              display: "flex", justifyContent: "flex-end", gap: 8,
            }}>
              <button className="btn b-ghost" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button
                className="btn b-solid"
                disabled={busy === "create"}
                onClick={create}
              >
                {busy === "create" ? "Creating…" : "Create Coupon"}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Search + Filter */}
      <Card>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="🔍 Search by code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input"
            style={{ minWidth: 140 }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Used / Max</th>
                <th>Min Purchase</th>
                <th>Applies To</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="empty">Loading coupons…</td>
                </tr>
              ) : filtered.map((c) => (
                <tr key={c.id} style={!c.is_active ? { opacity: 0.55 } : {}}>
                  <td
                    className="mono"
                    style={{ fontWeight: 700, cursor: "pointer" }}
                    onClick={() => copyCode(c.code)}
                    title="Click to copy"
                  >
                    {c.code}
                  </td>
                  <td style={{ color: "var(--green)", fontWeight: 700 }}>
                    {c.discount_type === "percent"
                      ? `${c.discount_value}%`
                      : fmtN(c.discount_value)}
                  </td>
                  <td className="mono" style={{ fontSize: ".75rem" }}>
                    {fmt(c.uses_count || 0)} / {fmt(c.max_uses || "∞")}
                  </td>
                  <td className="mono" style={{ fontSize: ".72rem" }}>
                    {c.min_purchase ? fmtN(c.min_purchase) : "—"}
                  </td>
                  <td className="dim" style={{ fontSize: ".72rem" }}>
                    {c.applies_to || "all"}
                  </td>
                  <td className="mono dim" style={{ fontSize: ".68rem" }}>
                    {c.expires_at ? fmtDate(c.expires_at) : "Never"}
                  </td>
                  <td><Pill s={c.is_active ? "active" : "inactive"} /></td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className={`btn ${c.is_active ? "b-red" : "b-solid"}`}
                        style={{ fontSize: ".7rem", padding: "2px 8px" }}
                        disabled={busy === `t-${c.id}`}
                        onClick={() => toggle(c)}
                      >
                        {busy === `t-${c.id}`
                          ? "…"
                          : c.is_active ? "Off" : "On"}
                      </button>
                      <button
                        className="btn b-ghost"
                        style={{ fontSize: ".7rem", padding: "2px 8px" }}
                        disabled={busy === `d-${c.id}`}
                        onClick={() => remove(c)}
                      >
                        {busy === `d-${c.id}` ? "…" : "🗑"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !filtered.length && (
                <tr>
                  <td colSpan={8} className="empty">
                    No coupons found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{
      background   : "var(--card)",
      border       : "1px solid var(--border)",
      borderRadius : 10,
      padding      : "12px 14px",
    }}>
      <div style={{
        fontSize      : ".65rem",
        color         : "var(--muted)",
        textTransform : "uppercase",
        fontWeight    : 700,
      }}>
        {label}
      </div>
      <div style={{
        fontSize   : "1.3rem",
        fontWeight : 800,
        color,
        marginTop  : 4,
      }}>
        {value}
      </div>
    </div>
  );
}
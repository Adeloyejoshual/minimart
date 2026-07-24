// src/page/admin/Finance/FinancePlans.jsx

import { useState, useMemo } from "react";
import { fmtN } from "../adminlayout/helpers";
import { Card, Rfr } from "../adminlayout/atoms";
import toast from "react-hot-toast";

export default function FinancePlans({
  plans, savePlan, togglePlan, busy, reloadPlans,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editForm,  setEditForm]  = useState({});

  const stats = useMemo(() => {
    const active   = plans.filter((p) => p.is_active).length;
    const inactive = plans.filter((p) => !p.is_active).length;
    const avgPrice = plans.length
      ? plans.reduce((s, p) => s + Number(p.price || 0), 0) / plans.length
      : 0;
    return { total: plans.length, active, inactive, avgPrice };
  }, [plans]);

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditForm({
      name             : p.name || "",
      price            : p.price || 0,
      discount_percent : p.discount_percent || 0,
      duration_days    : p.duration_days || 30,
      duration         : p.duration || "",
      priority         : p.priority || 0,
      sort_order       : p.sort_order || 0,
      is_active        : !!p.is_active,
      features         : Array.isArray(p.features) ? p.features.join("\n") : "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveChanges = async (p) => {
    try {
      await savePlan({
        ...p,
        ...editForm,
        features: editForm.features
          .split("\n")
          .map((f) => f.trim())
          .filter(Boolean),
      });
      toast.success(`"${editForm.name}" saved`);
      setEditingId(null);
      await reloadPlans();
    } catch (err) {
      toast.error(err.message || "Save failed");
    }
  };

  const handleToggle = async (p) => {
    try {
      await togglePlan(p);
      toast.success(`Plan ${p.is_active ? "deactivated" : "activated"}`);
    } catch (err) {
      toast.error(err.message || "Toggle failed");
    }
  };

  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>💎 Subscription Plans</h1>
          <p style={{ color: "var(--muted)", fontSize: ".78rem", marginTop: 4 }}>
            Manage pricing tiers, features and promotional discounts
          </p>
        </div>
        <div className="ph-right">
          <Rfr onClick={reloadPlans} />
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display             : "grid",
        gridTemplateColumns : "repeat(auto-fit, minmax(160px, 1fr))",
        gap                 : 10,
        marginBottom        : 12,
      }}>
        <StatBox label="Total Plans"  value={stats.total}          color="#3b82f6" />
        <StatBox label="Active"       value={stats.active}         color="#22c55e" />
        <StatBox label="Inactive"     value={stats.inactive}       color="#ef4444" />
        <StatBox label="Avg Price"    value={fmtN(stats.avgPrice)} color="#a855f7" />
      </div>

      {/* Plans Grid */}
      <div style={{
        display             : "grid",
        gridTemplateColumns : "repeat(auto-fit, minmax(320px, 1fr))",
        gap                 : 12,
      }}>
        {plans.map((p) => {
          const isEditing = editingId === p.id;

          return (
            <Card key={p.id}>
              {isEditing ? (
                /* ─── EDIT MODE ─── */
                <div className="form-grid">
                  <div className="form-group">
                    <label>Plan Name</label>
                    <input
                      className="input"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Price (₦)</label>
                    <input
                      className="input"
                      type="number"
                      value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Discount %</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="100"
                      value={editForm.discount_percent}
                      onChange={(e) => setEditForm({ ...editForm, discount_percent: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Duration (days)</label>
                    <input
                      className="input"
                      type="number"
                      value={editForm.duration_days}
                      onChange={(e) => setEditForm({ ...editForm, duration_days: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Duration Label</label>
                    <input
                      className="input"
                      placeholder="e.g. Monthly"
                      value={editForm.duration}
                      onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Sort Order</label>
                    <input
                      className="input"
                      type="number"
                      value={editForm.sort_order}
                      onChange={(e) => setEditForm({ ...editForm, sort_order: e.target.value })}
                    />
                  </div>
                  <div className="form-full">
                    <label>Features (one per line)</label>
                    <textarea
                      className="input"
                      rows={5}
                      style={{ resize: "vertical", fontFamily: "inherit" }}
                      value={editForm.features}
                      onChange={(e) => setEditForm({ ...editForm, features: e.target.value })}
                      placeholder="Unlimited products&#10;Priority support&#10;Custom branding"
                    />
                  </div>
                  <div className="form-full">
                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={editForm.is_active}
                        onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                      />
                      Active (visible to users)
                    </label>
                  </div>
                  <div className="form-full" style={{
                    display: "flex", justifyContent: "flex-end", gap: 8,
                  }}>
                    <button className="btn b-ghost" onClick={cancelEdit}>
                      Cancel
                    </button>
                    <button
                      className="btn b-solid"
                      disabled={busy === `plan-${p.id}`}
                      onClick={() => saveChanges(p)}
                    >
                      {busy === `plan-${p.id}` ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                </div>
              ) : (
                /* ─── VIEW MODE ─── */
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: ".72rem", color: "var(--muted)" }}>
                        {p.duration || `${p.duration_days} days`}
                      </div>
                    </div>
                    <div>
                      {p.is_active ? (
                        <span style={{
                          padding: "2px 8px",
                          background: "#22c55e1a",
                          color: "#22c55e",
                          borderRadius: 999,
                          fontSize: ".68rem",
                          fontWeight: 700,
                        }}>
                          ACTIVE
                        </span>
                      ) : (
                        <span style={{
                          padding: "2px 8px",
                          background: "#ef44441a",
                          color: "#ef4444",
                          borderRadius: 999,
                          fontSize: ".68rem",
                          fontWeight: 700,
                        }}>
                          INACTIVE
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ margin: "12px 0" }}>
                    <div style={{
                      fontSize: "1.8rem",
                      fontWeight: 900,
                      color: "var(--green)",
                    }}>
                      {fmtN(p.price)}
                    </div>
                    {p.discount_percent > 0 && (
                      <div style={{
                        fontSize: ".7rem",
                        color: "#f59e42",
                        fontWeight: 700,
                      }}>
                        {p.discount_percent}% OFF
                      </div>
                    )}
                  </div>

                  {Array.isArray(p.features) && p.features.length > 0 && (
                    <ul style={{
                      listStyle: "none",
                      padding: 0,
                      margin: "8px 0",
                      fontSize: ".78rem",
                    }}>
                      {p.features.map((f, i) => (
                        <li key={i} style={{
                          padding: "3px 0",
                          color: "var(--muted)",
                        }}>
                          ✓ {f}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div style={{
                    display: "flex", gap: 8, marginTop: 12,
                  }}>
                    <button
                      className="btn b-ghost"
                      style={{ flex: 1, fontSize: ".75rem" }}
                      onClick={() => startEdit(p)}
                    >
                      Edit
                    </button>
                    <button
                      className={`btn ${p.is_active ? "b-red" : "b-solid"}`}
                      style={{ flex: 1, fontSize: ".75rem" }}
                      disabled={busy === `pt-${p.id}`}
                      onClick={() => handleToggle(p)}
                    >
                      {busy === `pt-${p.id}` ? "…" : p.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </>
              )}
            </Card>
          );
        })}

        {!plans.length && (
          <Card>
            <div className="empty" style={{ padding: 40, textAlign: "center" }}>
              No plans configured yet.
            </div>
          </Card>
        )}
      </div>
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
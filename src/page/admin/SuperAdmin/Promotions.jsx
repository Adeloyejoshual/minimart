import { useState } from "react";
import { fmtN } from "../adminlayout/helpers";
import { safeFeatures } from "../adminlayout/helpers";
import { StatCard, Card, Pill, Rfr } from "../adminlayout/atoms";
import PlanEditModal from "./PlanEditModal";

export default function Promotions({
  plans, savePlan, togglePlan, busy, reloadPlans,
}) {
  const [editingPlan, setEditingPlan] = useState(null);

  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>Promotion Plans</h1>
          <div className="ph-sub">Manage the plans sellers choose when listing</div>
        </div>
        <div className="ph-right">
          <Rfr onClick={reloadPlans} />
        </div>
      </div>

      <div className="sg">
        <StatCard label="Total Plans"  value={plans.length}                                          color="c-blue"   />
        <StatCard label="Active Plans" value={plans.filter((p) => p.is_active).length}              color="c-green"  />
        <StatCard label="Discounted"   value={plans.filter((p) => Number(p.discount_percent) > 0).length} color="c-amber"  />
        <StatCard label="Free Plans"   value={plans.filter((p) => Number(p.price) === 0).length}    color="c-purple" />
      </div>

      <Card
        title={`${plans.length} Plans`}
        actions={[
          <span key="h" style={{ fontSize: ".72rem", color: "var(--muted)" }}>
            Click Edit to modify a plan
          </span>,
        ]}
      >
        {plans.length === 0 && <div className="empty">No plans found</div>}
        <div className="plan-admin-grid">
          {plans.map((plan) => {
            const price     = Number(plan.price ?? 0);
            const discount  = Number(plan.discount_percent ?? 0);
            const effective = Number(plan.effective_price ?? price * (1 - discount / 100));
            const features  = safeFeatures(plan.features);
            return (
              <div key={plan.id} className={`plan-admin-card${plan.is_active ? "" : " inactive"}`}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div className="plan-admin-name">{plan.name}</div>
                  <Pill s={plan.is_active ? "active" : "draft"} />
                </div>

                <div className="plan-admin-price">
                  {price === 0 ? (
                    <span style={{ color: "var(--green)" }}>Free</span>
                  ) : discount > 0 ? (
                    <>
                      <span className="original">&#8358;{price.toLocaleString()}</span>
                      &#8358;{effective.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                      <span className="discount-badge">-{discount}%</span>
                    </>
                  ) : (
                    <>&#8358;{price.toLocaleString()}</>
                  )}
                </div>

                <div className="plan-admin-meta">
                  <span>{plan.duration || `${plan.duration_days ?? 30} days`}</span>
                  <span>Priority {plan.priority ?? 0}</span>
                  <span>Sort {plan.sort_order ?? 0}</span>
                </div>

                {features.length > 0 ? (
                  <ul className="plan-admin-features">
                    {features.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                ) : (
                  <div style={{ fontSize: ".72rem", color: "var(--muted)" }}>No features set</div>
                )}

                <div className="plan-admin-actions">
                  <button
                    className="btn b-blue"
                    style={{ flex: 1 }}
                    onClick={() => setEditingPlan(plan)}
                  >
                    Edit
                  </button>
                  <button
                    className={`btn ${plan.is_active ? "b-amber" : "b-green"}`}
                    disabled={busy === `pt-${plan.id}`}
                    onClick={() => togglePlan(plan)}
                  >
                    {busy === `pt-${plan.id}` ? "…" : plan.is_active ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Plan Comparison Table">
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Price</th><th>Discount</th><th>Effective</th>
                <th>Duration</th><th>Priority</th><th>Features</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const price     = Number(plan.price ?? 0);
                const discount  = Number(plan.discount_percent ?? 0);
                const effective = Number(plan.effective_price ?? price * (1 - discount / 100));
                const features  = safeFeatures(plan.features);
                return (
                  <tr key={plan.id}>
                    <td style={{ fontWeight: 700 }}>{plan.name}</td>
                    <td className="mono">{price === 0 ? "Free" : `₦${price.toLocaleString()}`}</td>
                    <td className="mono" style={{ color: discount > 0 ? "var(--amber)" : "var(--muted)" }}>
                      {discount > 0 ? `-${discount}%` : "—"}
                    </td>
                    <td className="mono" style={{ color: "var(--green)" }}>
                      {price === 0 ? "Free" : `₦${effective.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="dim" style={{ fontSize: ".72rem" }}>
                      {plan.duration || `${plan.duration_days ?? 30} days`}
                    </td>
                    <td className="mono dim">{plan.priority ?? 0}</td>
                    <td style={{ fontSize: ".72rem", color: "var(--muted)" }}>
                      {features.length > 0 ? features.join(", ") : "—"}
                    </td>
                    <td><Pill s={plan.is_active ? "active" : "draft"} /></td>
                  </tr>
                );
              })}
              {!plans.length && (
                <tr><td colSpan={8} className="empty">No plans found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {editingPlan && (
        <PlanEditModal
          plan={editingPlan}
          busy={busy}
          onClose={() => setEditingPlan(null)}
          onSave={async (updated) => {
            await savePlan(updated);
            setEditingPlan(null);
          }}
        />
      )}
    </>
  );
}
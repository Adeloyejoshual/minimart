import { useState } from "react";
import { safeFeatures } from "../adminlayout/helpers";

export default function PlanEditModal({ plan, onClose, onSave, busy }) {
  const [form, setForm] = useState({
    name:             plan.name             ?? "",
    price:            plan.price            ?? 0,
    discount_percent: plan.discount_percent ?? 0,
    duration_days:    plan.duration_days    ?? 30,
    duration:         plan.duration         ?? "",
    priority:         plan.priority         ?? 0,
    sort_order:       plan.sort_order       ?? 0,
    is_active:        plan.is_active        ?? true,
    features:         safeFeatures(plan.features).join("\n"),
  });

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const handleSave = () =>
    onSave({
      ...plan,
      ...form,
      price:            Number(form.price),
      discount_percent: Number(form.discount_percent),
      duration_days:    Number(form.duration_days),
      priority:         Number(form.priority),
      sort_order:       Number(form.sort_order),
      features:         form.features.split("\n").map((s) => s.trim()).filter(Boolean),
    });

  const effectivePrice =
    Number(form.price) * (1 - Number(form.discount_percent) / 100);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Edit Plan — {plan.name}</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group" style={{ gridColumn: "1/-1" }}>
            <label>Plan Name</label>
            <input className="input" value={form.name} onChange={set("name")} />
          </div>

          <div className="form-group">
            <label>Price (&#8358;)</label>
            <input className="input" type="number" min="0" value={form.price} onChange={set("price")} />
          </div>

          <div className="form-group">
            <label>Discount (%)</label>
            <input className="input" type="number" min="0" max="100" value={form.discount_percent} onChange={set("discount_percent")} />
          </div>

          {Number(form.discount_percent) > 0 && (
            <div className="form-group" style={{ gridColumn: "1/-1" }}>
              <label>Effective Price Preview</label>
              <div style={{
                padding: "8px 12px", background: "var(--panel)",
                borderRadius: 8, fontFamily: "var(--mono)", fontSize: ".85rem", color: "var(--green)",
              }}>
                &#8358;{effectivePrice.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                <span style={{ color: "var(--amber)", marginLeft: 8 }}>
                  (-{form.discount_percent}% off)
                </span>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Duration Label</label>
            <input className="input" value={form.duration} onChange={set("duration")} placeholder="e.g. 30 days" />
          </div>

          <div className="form-group">
            <label>Duration (days)</label>
            <input className="input" type="number" min="1" value={form.duration_days} onChange={set("duration_days")} />
          </div>

          <div className="form-group">
            <label>Priority</label>
            <input className="input" type="number" min="0" value={form.priority} onChange={set("priority")} />
          </div>

          <div className="form-group">
            <label>Sort Order</label>
            <input className="input" type="number" min="0" value={form.sort_order} onChange={set("sort_order")} />
          </div>

          <div className="form-group" style={{ gridColumn: "1/-1" }}>
            <label>Features (one per line)</label>
            <textarea
              className="input"
              rows={5}
              value={form.features}
              onChange={set("features")}
              placeholder={"Basic listing\nStandard visibility\nContact via chat"}
            />
          </div>

          <div style={{
            gridColumn: "1/-1", display: "flex", alignItems: "center",
            justifyContent: "space-between", background: "var(--panel)",
            borderRadius: 8, padding: "10px 14px",
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: ".82rem" }}>Plan Active</div>
              <div style={{ fontSize: ".72rem", color: "var(--muted)" }}>
                Inactive plans are hidden from sellers
              </div>
            </div>
            <button
              className={`sw ${form.is_active ? "on" : "off"}`}
              onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
            />
          </div>
        </div>

        <div className="modal-btns">
          <button className="btn b-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn b-solid"
            disabled={busy === `plan-${plan.id}`}
            onClick={handleSave}
          >
            {busy === `plan-${plan.id}` ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
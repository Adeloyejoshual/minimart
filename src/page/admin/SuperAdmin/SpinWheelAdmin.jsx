// FILE: src/pages/admin/SuperAdmin/SpinWheelAdmin.jsx

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

/* ════════════════════════════════════════════════════════════
   STYLES
════════════════════════════════════════════════════════════ */
const css = `
  .sw-wrap { padding: 1.2rem; max-width: 1100px; }
  .sw-header { display:flex; align-items:center; justify-content:space-between;
               flex-wrap:wrap; gap:.8rem; margin-bottom:1.2rem; }
  .sw-header h2 { margin:0; font-size:1.25rem; }
  .sw-tabs { display:flex; gap:.4rem; margin-bottom:1rem; flex-wrap:wrap; }
  .sw-tab { padding:.45rem .9rem; border-radius:8px; border:1px solid var(--border,#e5e7eb);
            background:var(--card,#fff); cursor:pointer; font-size:.82rem;
            transition:all .15s; }
  .sw-tab.active { background:var(--accent,#2563eb); color:#fff; border-color:var(--accent,#2563eb); }
  .sw-card { background:var(--card,#fff); border:1px solid var(--border,#e5e7eb);
             border-radius:12px; padding:1rem; margin-bottom:1rem; }
  .sw-table { width:100%; border-collapse:collapse; font-size:.8rem; }
  .sw-table th { text-align:left; padding:.5rem .4rem; border-bottom:2px solid var(--border,#e5e7eb);
                 font-weight:600; color:var(--muted,#6b7280); white-space:nowrap; }
  .sw-table td { padding:.45rem .4rem; border-bottom:1px solid var(--border,#f3f4f6);
                 vertical-align:middle; }
  .sw-input { width:100%; padding:.3rem .45rem; border:1px solid var(--border,#e5e7eb);
              border-radius:6px; font-size:.78rem; background:var(--bg,#f9fafb); }
  .sw-input:focus { outline:none; border-color:var(--accent,#2563eb); }
  .sw-input-sm { width:60px; }
  .sw-input-md { width:90px; }
  .sw-color { width:32px; height:28px; padding:0; border:1px solid var(--border,#e5e7eb);
              border-radius:4px; cursor:pointer; background:none; }
  .sw-toggle { position:relative; width:36px; height:20px; border-radius:10px;
               border:none; cursor:pointer; transition:background .2s; }
  .sw-toggle.on  { background:#10b981; }
  .sw-toggle.off { background:#d1d5db; }
  .sw-toggle::after { content:''; position:absolute; top:2px; left:2px;
                      width:16px; height:16px; border-radius:50%;
                      background:#fff; transition:transform .2s; }
  .sw-toggle.on::after { transform:translateX(16px); }
  .sw-btn { padding:.45rem .9rem; border-radius:8px; border:none; cursor:pointer;
            font-size:.82rem; font-weight:600; transition:opacity .15s; }
  .sw-btn:disabled { opacity:.5; cursor:not-allowed; }
  .sw-btn-primary { background:var(--accent,#2563eb); color:#fff; }
  .sw-btn-success { background:#10b981; color:#fff; }
  .sw-btn-ghost { background:transparent; border:1px solid var(--border,#e5e7eb);
                  color:var(--text,#111); }
  .sw-prob-bar { height:6px; border-radius:3px; background:#e5e7eb; overflow:hidden;
                 margin-top:.3rem; }
  .sw-prob-fill { height:100%; border-radius:3px; transition:width .3s; }
  .sw-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
              gap:.8rem; margin-bottom:1rem; }
  .sw-stat { background:var(--card,#fff); border:1px solid var(--border,#e5e7eb);
             border-radius:10px; padding:.8rem; text-align:center; }
  .sw-stat-val { font-size:1.4rem; font-weight:700; }
  .sw-stat-lbl { font-size:.72rem; color:var(--muted,#6b7280); margin-top:.2rem; }
  .sw-empty { text-align:center; padding:2rem; color:var(--muted,#6b7280); }
  .sw-row-actions { display:flex; gap:.3rem; }
  @media(max-width:640px){
    .sw-table { font-size:.72rem; }
    .sw-input { font-size:.72rem; }
  }
`;

/* ════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════ */
export default function SpinWheelAdmin({ api, confirm }) {
  const [tab, setTab] = useState("prizes");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ── Prizes ── */
  const [prizes, setPrizes] = useState([]);
  const [seeded, setSeeded] = useState(false);

  /* ── Tasks ── */
  const [tasks, setTasks] = useState([]);

  /* ── Settings ── */
  const [settings, setSettings] = useState({
    max_free_daily: 1,
    max_bonus_stacked: 100,
    coupon_expiry_days: 30,
  });

  /* ── Stats ── */
  const [stats, setStats] = useState(null);

  /* ══════════════════════════════════════════════════════════
     LOAD DATA
  ══════════════════════════════════════════════════════════ */
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, tRes, sRes, stRes] = await Promise.allSettled([
        api.get("/spinwheel/prizes"),
        api.get("/spinwheel/tasks"),
        api.get("/spinwheel/settings"),
        api.get("/spinwheel/stats"),
      ]);

      if (pRes.status === "fulfilled" && pRes.value.data?.prizes?.length > 0) {
        setPrizes(pRes.value.data.prizes.map(normalizePrize));
        setSeeded(true);
      } else {
        setSeeded(false);
      }

      if (tRes.status === "fulfilled" && tRes.value.data?.tasks?.length > 0) {
        setTasks(tRes.value.data.tasks.map(normalizeTask));
      }

      if (sRes.status === "fulfilled" && sRes.value.data?.settings) {
        const s = sRes.value.data.settings;
        setSettings({
          max_free_daily:     s.max_free_daily?.value     ?? 1,
          max_bonus_stacked:  s.max_bonus_stacked?.value  ?? 100,
          coupon_expiry_days: s.coupon_expiry_days?.value ?? 30,
        });
      }

      if (stRes.status === "fulfilled" && stRes.value.data?.stats) {
        setStats(stRes.value.data.stats);
      }
    } catch (err) {
      console.warn("[spinwheel-admin] load:", err.message);
    }
    setLoading(false);
  }, [api]);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ══════════════════════════════════════════════════════════
     SEED
  ══════════════════════════════════════════════════════════ */
  const handleSeed = async () => {
    confirm({
      title: "Seed Spin & Win Data",
      body: "This will copy your current prize and task configuration from spinwheel.config.js into the database. Your live spin wheel will NOT be affected — it still reads from the config file until you switch it over.",
      confirm: "Seed Now",
      action: async () => {
        try {
          await api.post("/spinwheel/seed");
          toast.success("Data seeded from config.");
          await loadAll();
        } catch {
          toast.error("Seed failed. Check server logs.");
        }
      },
    });
  };

  /* ══════════════════════════════════════════════════════════
     SAVE PRIZES
  ══════════════════════════════════════════════════════════ */
  const savePrizes = async () => {
    const active = prizes.filter((p) => p.is_active);
    const total = active.reduce((s, p) => s + Number(p.probability || 0), 0);
    if (Math.abs(total - 100) > 0.01) {
      toast.error(`Active probabilities sum to ${total.toFixed(2)}%, not 100%.`);
      return;
    }
    setSaving(true);
    try {
      await api.put("/spinwheel/prizes", { prizes });
      toast.success("Prizes saved.");
      setSeeded(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed.");
    }
    setSaving(false);
  };

  /* ══════════════════════════════════════════════════════════
     SAVE TASKS
  ══════════════════════════════════════════════════════════ */
  const saveTasks = async () => {
    setSaving(true);
    try {
      await api.put("/spinwheel/tasks", { tasks });
      toast.success("Tasks saved.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed.");
    }
    setSaving(false);
  };

  /* ══════════════════════════════════════════════════════════
     SAVE SETTINGS
  ══════════════════════════════════════════════════════════ */
  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put("/spinwheel/settings", { settings });
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed.");
    }
    setSaving(false);
  };

  /* ══════════════════════════════════════════════════════════
     PRIZE HELPERS
  ══════════════════════════════════════════════════════════ */
  const updatePrize = (idx, field, value) => {
    setPrizes((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const totalProb = prizes
    .filter((p) => p.is_active)
    .reduce((s, p) => s + Number(p.probability || 0), 0);

  const probColor =
    Math.abs(totalProb - 100) < 0.01 ? "#10b981" :
    totalProb > 100 ? "#ef4444" : "#f59e0b";

  /* ══════════════════════════════════════════════════════════
     TASK HELPERS
  ══════════════════════════════════════════════════════════ */
  const updateTask = (idx, field, value) => {
    setTasks((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  if (loading) {
    return (
      <>
        <style>{css}</style>
        <div className="sw-wrap"><div className="sw-empty">Loading Spin & Win…</div></div>
      </>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="sw-wrap">

        {/* ── Header ── */}
        <div className="sw-header">
          <h2>🎡 Spin & Win</h2>
          <div style={{ display: "flex", gap: ".5rem" }}>
            {!seeded && (
              <button className="sw-btn sw-btn-ghost" onClick={handleSeed}>
                📥 Seed from Config
              </button>
            )}
            <button className="sw-btn sw-btn-ghost" onClick={loadAll}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        {stats && (
          <div className="sw-stats">
            <div className="sw-stat">
              <div className="sw-stat-val">{stats.total_spins}</div>
              <div className="sw-stat-lbl">Total Spins</div>
            </div>
            <div className="sw-stat">
              <div className="sw-stat-val">{stats.today_spins}</div>
              <div className="sw-stat-lbl">Today</div>
            </div>
            <div className="sw-stat">
              <div className="sw-stat-val">{stats.total_wins}</div>
              <div className="sw-stat-lbl">Total Wins</div>
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="sw-tabs">
          {["prizes", "tasks", "settings"].map((t) => (
            <button
              key={t}
              className={`sw-tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "prizes" ? "🎁 Prizes" : t === "tasks" ? "📋 Tasks" : "⚙️ Settings"}
            </button>
          ))}
        </div>

        {/* ═══════════ PRIZES TAB ═══════════ */}
        {tab === "prizes" && (
          <div className="sw-card">
            {!seeded && prizes.length === 0 && (
              <div className="sw-empty">
                No prizes in database yet. Click <b>"Seed from Config"</b> above
                to import your current wheel configuration.
              </div>
            )}

            {prizes.length > 0 && (
              <>
                {/* Probability bar */}
                <div style={{ marginBottom: ".8rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".78rem" }}>
                    <span>Active probability total</span>
                    <span style={{ fontWeight: 700, color: probColor }}>
                      {totalProb.toFixed(2)}%
                    </span>
                  </div>
                  <div className="sw-prob-bar">
                    <div
                      className="sw-prob-fill"
                      style={{
                        width: `${Math.min(totalProb, 100)}%`,
                        background: probColor,
                      }}
                    />
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table className="sw-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Label</th>
                        <th>Type</th>
                        <th>Value</th>
                        <th>Prob %</th>
                        <th>Max Wins</th>
                        <th>Color</th>
                        <th>BG</th>
                        <th>Emoji</th>
                        <th>Big</th>
                        <th>Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prizes.map((p, i) => (
                        <tr key={p.segment_key || i} style={{ opacity: p.is_active ? 1 : 0.5 }}>
                          <td style={{ color: "var(--muted)" }}>{i + 1}</td>
                          <td>
                            <input
                              className="sw-input"
                              value={p.label}
                              onChange={(e) => updatePrize(i, "label", e.target.value)}
                            />
                          </td>
                          <td>
                            <select
                              className="sw-input"
                              value={p.reward_type}
                              onChange={(e) => updatePrize(i, "reward_type", e.target.value)}
                            >
                              <option value="airtime">Airtime</option>
                              <option value="fixed">Fixed ₦</option>
                              <option value="percentage">Percent %</option>
                              <option value="free_shipping">Free Ship</option>
                              <option value="none">None</option>
                            </select>
                          </td>
                          <td>
                            <input
                              className="sw-input sw-input-sm"
                              type="number"
                              min="0"
                              step="0.01"
                              value={p.reward_value}
                              onChange={(e) => updatePrize(i, "reward_value", Number(e.target.value))}
                            />
                          </td>
                          <td>
                            <input
                              className="sw-input sw-input-sm"
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={p.probability}
                              onChange={(e) => updatePrize(i, "probability", Number(e.target.value))}
                            />
                          </td>
                          <td>
                            <input
                              className="sw-input sw-input-sm"
                              type="number"
                              min="1"
                              step="1"
                              placeholder="No cap"
                              value={p.max_wins ?? ""}
                              onChange={(e) =>
                                updatePrize(i, "max_wins", e.target.value === "" ? null : Number(e.target.value))
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="sw-color"
                              type="color"
                              value={p.color}
                              onChange={(e) => updatePrize(i, "color", e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              className="sw-color"
                              type="color"
                              value={p.background_color}
                              onChange={(e) => updatePrize(i, "background_color", e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              className="sw-input"
                              style={{ width: 40, textAlign: "center" }}
                              value={p.emoji}
                              onChange={(e) => updatePrize(i, "emoji", e.target.value)}
                            />
                          </td>
                          <td>
                            <button
                              className={`sw-toggle ${p.is_big_win ? "on" : "off"}`}
                              onClick={() => updatePrize(i, "is_big_win", !p.is_big_win)}
                            />
                          </td>
                          <td>
                            <button
                              className={`sw-toggle ${p.is_active ? "on" : "off"}`}
                              onClick={() => updatePrize(i, "is_active", !p.is_active)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: ".8rem", textAlign: "right" }}>
                  <button
                    className="sw-btn sw-btn-primary"
                    disabled={saving}
                    onClick={savePrizes}
                  >
                    {saving ? "Saving…" : "💾 Save Prizes"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════ TASKS TAB ═══════════ */}
        {tab === "tasks" && (
          <div className="sw-card">
            {tasks.length === 0 && (
              <div className="sw-empty">
                No tasks in database yet. Click <b>"Seed from Config"</b> to import.
              </div>
            )}

            {tasks.length > 0 && (
              <>
                <div style={{ overflowX: "auto" }}>
                  <table className="sw-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Platform</th>
                        <th>Label</th>
                        <th>Type</th>
                        <th>Category</th>
                        <th>Spins</th>
                        <th>URL</th>
                        <th>Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((t, i) => (
                        <tr key={t.task_key || i} style={{ opacity: t.is_active ? 1 : 0.5 }}>
                          <td style={{ color: "var(--muted)" }}>{i + 1}</td>
                          <td>
                            <select
                              className="sw-input"
                              value={t.platform}
                              onChange={(e) => updateTask(i, "platform", e.target.value)}
                            >
                              <option value="Instagram">Instagram</option>
                              <option value="TikTok">TikTok</option>
                              <option value="Telegram">Telegram</option>
                              <option value="WhatsApp Channel">WhatsApp Channel</option>
                            </select>
                          </td>
                          <td>
                            <input
                              className="sw-input"
                              value={t.label}
                              onChange={(e) => updateTask(i, "label", e.target.value)}
                            />
                          </td>
                          <td>
                            <select
                              className="sw-input"
                              value={t.task_type}
                              onChange={(e) => updateTask(i, "task_type", e.target.value)}
                            >
                              <option value="follow">Follow</option>
                              <option value="join">Join</option>
                            </select>
                          </td>
                          <td>
                            <select
                              className="sw-input"
                              value={t.category}
                              onChange={(e) => updateTask(i, "category", e.target.value)}
                            >
                              <option value="social">Social</option>
                              <option value="community">Community</option>
                            </select>
                          </td>
                          <td>
                            <input
                              className="sw-input sw-input-sm"
                              type="number"
                              min="1"
                              value={t.spins_reward}
                              onChange={(e) => updateTask(i, "spins_reward", Number(e.target.value))}
                            />
                          </td>
                          <td>
                            <input
                              className="sw-input"
                              style={{ minWidth: 160 }}
                              placeholder="https://…"
                              value={t.destination_url}
                              onChange={(e) => updateTask(i, "destination_url", e.target.value)}
                            />
                          </td>
                          <td>
                            <button
                              className={`sw-toggle ${t.is_active ? "on" : "off"}`}
                              onClick={() => updateTask(i, "is_active", !t.is_active)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: ".8rem", textAlign: "right" }}>
                  <button
                    className="sw-btn sw-btn-primary"
                    disabled={saving}
                    onClick={saveTasks}
                  >
                    {saving ? "Saving…" : "💾 Save Tasks"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════ SETTINGS TAB ═══════════ */}
        {tab === "settings" && (
          <div className="sw-card">
            <div style={{ display: "grid", gap: "1rem", maxWidth: 400 }}>
              <label style={{ fontSize: ".85rem" }}>
                <b>Free Spins Per Day</b>
                <input
                  className="sw-input"
                  type="number"
                  min="0"
                  value={settings.max_free_daily}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, max_free_daily: Number(e.target.value) }))
                  }
                />
              </label>
              <label style={{ fontSize: ".85rem" }}>
                <b>Max Bonus Spins Stacked</b>
                <input
                  className="sw-input"
                  type="number"
                  min="0"
                  value={settings.max_bonus_stacked}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, max_bonus_stacked: Number(e.target.value) }))
                  }
                />
              </label>
              <label style={{ fontSize: ".85rem" }}>
                <b>Coupon Expiry (Days)</b>
                <input
                  className="sw-input"
                  type="number"
                  min="1"
                  value={settings.coupon_expiry_days}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, coupon_expiry_days: Number(e.target.value) }))
                  }
                />
              </label>
            </div>

            <div style={{ marginTop: "1rem" }}>
              <button
                className="sw-btn sw-btn-primary"
                disabled={saving}
                onClick={saveSettings}
              >
                {saving ? "Saving…" : "💾 Save Settings"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   NORMALIZERS
════════════════════════════════════════════════════════════ */
function normalizePrize(p) {
  return {
    id:               p.id ?? null,
    segment_key:      p.segment_key ?? `seg_${p.id}`,
    label:            p.label ?? "",
    reward_type:      p.reward_type ?? p.type ?? "none",
    reward_value:     Number(p.reward_value ?? p.value ?? 0),
    probability:      Number(p.probability ?? 0),
    color:            p.color ?? "#FF5C00",
    background_color: p.background_color ?? p.bg ?? "#FFF3EE",
    emoji:            p.emoji ?? "🎁",
    is_big_win:       !!p.is_big_win,
    is_active:        p.is_active !== false,
    display_order:    p.display_order ?? 0,
    max_wins:         p.max_wins ?? null,
    wins_count:       p.wins_count ?? 0,
  };
}

function normalizeTask(t) {
  return {
    id:                t.id ?? null,
    task_key:          t.task_key ?? t.id ?? "",
    label:             t.label ?? "",
    platform:          t.platform ?? "instagram",
    task_type:         t.task_type ?? t.type ?? "follow",
    category:          t.category ?? "social",
    spins_reward:      Number(t.spins_reward ?? 1),
    verification_type: t.verification_type ?? t.verify_type ?? "honor",
    destination_url:   t.destination_url ?? t.url ?? "",
    is_active:         (t.is_active ?? t.active) !== false,
    display_order:     t.display_order ?? 0,
  };
}
import { useState, useEffect, useCallback, useMemo } from "react";
import adminApi from "../../../../services/adminApi";

const STATUS_META = {
  pending: { label: "Under Review", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  active:  { label: "Live",         color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  rejected:{ label: "Rejected",     color: "#dc2626", bg: "#fff5f5", border: "#fecaca" },
  flagged: { label: "Flagged",      color: "#9333ea", bg: "#fdf4ff", border: "#e9d5ff" },
  paused:  { label: "Paused",       color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
  sold:    { label: "Sold",         color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd" },
  deleted: { label: "Removed",      color: "#dc2626", bg: "#fff5f5", border: "#fecaca" },
};

const TABS = [
  { key: "pending",  label: "Pending Review" },
  { key: "active",   label: "Active"         },
  { key: "rejected", label: "Rejected"       },
  { key: "flagged",  label: "Flagged"        },
  { key: "paused",   label: "Paused"         },
  { key: "sold",     label: "Sold"           },
  { key: "",         label: "All"            },
];

const FLAG_OPTIONS = [
  { key: "is_featured",  label: "Featured",  color: "#d97706" },
  { key: "is_trending",  label: "Trending",  color: "#dc2626" },
  { key: "is_sponsored", label: "Sponsored", color: "#9333ea" },
  { key: "is_hidden",    label: "Hidden",    color: "#6b7280" },
];

const STATUS_OPTIONS = [
  { value: "pending",  label: "Pending Review" },
  { value: "active",   label: "Active (Live)"  },
  { value: "rejected", label: "Rejected"       },
  { value: "flagged",  label: "Flagged"        },
  { value: "paused",   label: "Paused"         },
  { value: "sold",     label: "Sold Out"       },
];

const S = {
  sectionTitle: { fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 },
  label: { display: "block", fontSize: ".78rem", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 },
  input: { width: "100%", padding: "10px 12px", border: "1.5px solid #e8e6e0", borderRadius: 10, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "#fff" },
  textarea: { width: "100%", padding: "10px 12px", border: "1.5px solid #e8e6e0", borderRadius: 10, fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box", background: "#fff" },
  closeBtn: { border: "1.5px solid #e8e6e0", background: "#fafaf8", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#555", display: "flex", alignItems: "center", justifyContent: "center" },
};

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const t = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return debounced;
}

function Section({ title, children }) { return <div style={{ marginBottom: 16 }}><div style={S.sectionTitle}>{title}</div>{children}</div>; }
function StatusPill({ status }) { const meta = STATUS_META[status] ?? STATUS_META.active; return <span style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>{meta.label}</span>; }
function FlagChip({ label, color }) { return <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: `${color}18`, color, border: `1px solid ${color}40`, whiteSpace: "nowrap" }}>{label}</span>; }
function EmptyState({ tab }) { return <div style={{ textAlign: "center", padding: 60, color: "#aaa", background: "#fafaf8", borderRadius: 14, border: "1.5px dashed #e8e6e0" }}><div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>No listings found</div><div style={{ fontSize: 13 }}>{tab === "pending" ? "The review queue is empty." : "Nothing matches your current filter."}</div></div>; }

/* ══════════════════════════════════════════
   ADD PRODUCT MODAL (NEW)
══════════════════════════════════════════ */
function AddProductModal({ onAdd, onClose }) {
  const [form, setForm] = useState({ name: "", price: "", category: "Electronics", stock: "1", description: "" });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!form.name.trim() || !form.price) return;
    setBusy(true);
    await onAdd(form);
    setBusy(false);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, width: "90%" }}>
        <div className="modal-title" style={{ color: "#059669", marginBottom: 16 }}>Add New Listing</div>
        
        <label style={S.label}>Product Name</label>
        <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. iPhone 13 Pro" style={{...S.input, marginBottom: 12}} />
        
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={S.label}>Price (₦)</label>
            <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="e.g. 350000" style={S.input} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={S.label}>Stock / Quantity</label>
            <input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} style={S.input} />
          </div>
        </div>

        <label style={S.label}>Category</label>
        <input value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="e.g. Electronics, Fashion" style={{...S.input, marginBottom: 12}} />

        <label style={S.label}>Description</label>
        <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} style={{...S.textarea, marginBottom: 16}} />

        <div className="modal-btns">
          <button className="btn b-ghost" onClick={onClose}>Cancel</button>
          <button className="btn b-solid" style={{ background: "#059669", color: "#fff", border: "none" }} disabled={busy || !form.name || !form.price} onClick={submit}>
            {busy ? "Creating..." : "Create Product"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   DRAWER (EDIT EXPANDED)
══════════════════════════════════════════ */
function ProductDrawer({ product, onClose, onApprove, onRejectOpen, onRemoveOpen, onPause, onFlag, onStatusChange, onSaveEdit, onPermanentDelete, busy, confirm }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!product) return;
    // Load all editable fields into form state
    setForm({
      name: product.name ?? "",
      price: product.price ?? "",
      original_price: product.original_price ?? "",
      stock: product.stock ?? 1,
      category: product.category ?? "",
      description: product.description ?? "",
      admin_notes: product.admin_notes ?? "",
      campaign_tag: product.campaign_tag ?? "",
      badge: product.badge ?? "",
    });
    setEditing(false);
  }, [product?.id]);

  if (!product) return null;
  const images = product.images ?? [];
  const isPending = product.status === "pending" || product.status === "flagged";

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSavingEdit(true);
    // Send updated fields
    await onSaveEdit(product.id, {
      name: form.name.trim(),
      price: Number(form.price),
      original_price: form.original_price ? Number(form.original_price) : null,
      stock: Number(form.stock),
      category: form.category.trim(),
      description: form.description.trim(),
      admin_notes: form.admin_notes.trim(),
      campaign_tag: form.campaign_tag.trim() || null,
      badge: form.badge.trim() || null,
    });
    setSavingEdit(false);
    setEditing(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, display: "flex" }}>
      <div style={{ flex: 1, background: "rgba(0,0,0,.45)", cursor: "pointer" }} onClick={onClose} />
      <div style={{ width: "min(560px, 100%)", background: "#fff", overflowY: "auto", display: "flex", flexDirection: "column", boxShadow: "-8px 0 32px rgba(0,0,0,.15)" }}>
        
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0eeea", display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
          <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{product.name}</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{product.seller_name} · {product.seller_email}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn b-ghost" onClick={() => setEditing((v) => !v)} style={{ fontSize: 12, padding: "4px 10px", height: 28 }}>
              {editing ? "Cancel Edit" : "Edit Full Info"}
            </button>
            <button onClick={onClose} style={S.closeBtn}>x</button>
          </div>
        </div>

        <div style={{ padding: 20, flex: 1 }}>
          
          {/* Expanded Edit Panel */}
          {editing && (
            <div style={{ border: "1.5px solid #ff5722", borderRadius: 14, padding: 16, marginBottom: 16, background: "#fffbf5" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#ff5722", marginBottom: 12 }}>Edit Product Details</div>

              <label style={S.label}>Product Title</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={{...S.input, marginBottom: 12}} />

              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Price (₦)</label>
                  <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} style={S.input} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Old/Slashed Price</label>
                  <input type="number" value={form.original_price} onChange={e => setForm({...form, original_price: e.target.value})} style={S.input} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Category</label>
                  <input value={form.category} onChange={e => setForm({...form, category: e.target.value})} style={S.input} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Stock Count</label>
                  <input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} style={S.input} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Campaign Tag</label>
                  <input value={form.campaign_tag} onChange={e => setForm({...form, campaign_tag: e.target.value})} placeholder="e.g. Black Friday" style={S.input} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Custom Badge</label>
                  <input value={form.badge} onChange={e => setForm({...form, badge: e.target.value})} placeholder="e.g. 50% Off" style={S.input} />
                </div>
              </div>

              <label style={S.label}>Description</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} style={{...S.textarea, marginBottom: 12}} />

              <label style={S.label}>Admin Notes (Internal)</label>
              <textarea value={form.admin_notes} onChange={e => setForm({...form, admin_notes: e.target.value})} rows={2} style={S.textarea} />

              <button className="btn b-solid" disabled={savingEdit || !form.name.trim()} onClick={handleSave} style={{ width: "100%", height: 40, marginTop: 14, fontSize: 13 }}>
                {savingEdit ? "Saving..." : "Save All Changes"}
              </button>
            </div>
          )}

          {/* View Mode */}
          {!editing && (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                <StatusPill status={product.status} />
                {product.campaign_tag && <FlagChip label={`Campaign: ${product.campaign_tag}`} color="#059669" />}
                {product.badge && <FlagChip label={`Badge: ${product.badge}`} color="#0284c7" />}
              </div>
              <div style={{ background: "#fafaf8", border: "1.5px solid #f0eeea", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: "#ff5722" }}>₦{Number(product.price ?? 0).toLocaleString()}</span>
                  {product.original_price && <span style={{ fontSize: 13, color: "#bbb", textDecoration: "line-through" }}>₦{Number(product.original_price).toLocaleString()}</span>}
                </div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                  Category: <strong>{product.category}</strong> · Stock: <strong>{product.stock}</strong>
                </div>
              </div>
            </>
          )}

          <Section title="Product Flags">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {FLAG_OPTIONS.map((f) => (
                <button key={f.key} className={`btn ${product[f.key] ? "b-solid" : "b-ghost"}`} onClick={() => onFlag(product.id, f.key, !product[f.key])} style={{ fontSize: 12, padding: "5px 12px", height: 30, ...(product[f.key] && { background: f.color, borderColor: f.color, color: "#fff" }) }}>
                  {f.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
            {isPending && <button className="btn b-solid" onClick={() => onApprove(product.id)} style={{ height: 44 }}>Approve Listing</button>}
            <button className="btn b-ghost" onClick={() => confirm({ title: "Delete permanently?", body: "This cannot be undone.", confirm: "Delete", danger: true, action: () => onPermanentDelete(product.id) })} style={{ height: 36, color: "#991b1b", borderColor: "#fca5a5", background: "#fff5f5" }}>
              Permanent Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
export default function MarketProducts({ confirm }) {
  const [tab, setTab] = useState("pending");
  const [products, setProducts] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [drawer, setDrawer] = useState(null);
  
  // NEW: Add Modal State
  const [addModal, setAddModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get(`/market-products${tab ? `?status=${tab}` : ""}`);
      setProducts(data.products ?? []);
      if (data.counts) setCounts(data.counts);
    } catch (err) {} finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const updateLocal = (id, patch) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    setDrawer(d => d?.id === id ? { ...d, ...patch } : d);
  };

  const handleAdd = async (formData) => {
    try {
      await adminApi.post("/market-products", formData);
      setAddModal(false);
      load(); // refresh list
    } catch (err) { console.error(err); }
  };

  const handleApprove = async (id) => { try { await adminApi.post(`/market-products/${id}/approve`); load(); setDrawer(null); } catch (err) {} };
  const handleFlag = async (id, flag, value) => { try { await adminApi.post(`/market-products/${id}/flag`, { flag, value }); updateLocal(id, { [flag]: value }); } catch (err) {} };
  const handleSaveEdit = async (id, fields) => { try { await adminApi.patch(`/market-products/${id}`, fields); updateLocal(id, fields); } catch (err) {} };
  const handlePermanentDelete = async (id) => { try { await adminApi.delete(`/market-products/${id}/permanent`); setProducts(p => p.filter(x => x.id !== id)); setDrawer(null); } catch (err) {} };

  const displayed = useMemo(() => {
    const lq = debouncedQ.toLowerCase();
    if (!lq) return products;
    return products.filter(p => (p.name??"").toLowerCase().includes(lq) || (p.category??"").toLowerCase().includes(lq));
  }, [products, debouncedQ]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Market Products</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>Manage listings and marketing campaigns</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn b-ghost" onClick={load} disabled={loading} style={{ fontSize: 13 }}>Refresh</button>
          <button className="btn b-solid" style={{ background: "#059669", color: "#fff", border: "none" }} onClick={() => setAddModal(true)}>
            + Add New Listing
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {TABS.map(t => {
          const count = t.key ? (counts[t.key] ?? 0) : (counts.total ?? products.length);
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: "7px 14px", borderRadius: 999, border: active ? "none" : "1.5px solid #e8e6e0", background: active ? "#ff5722" : "#fafaf8", color: active ? "#fff" : "#555", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              {t.label} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." style={{ width: "100%", maxWidth: 420, padding: "9px 14px", border: "1.5px solid #e8e6e0", borderRadius: 10, fontSize: 13, marginBottom: 16 }} />

      {loading ? ( <div style={{ textAlign: "center", padding: 60 }}>Loading...</div> ) : displayed.length === 0 ? ( <EmptyState tab={tab} /> ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 920 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f0eeea" }}>
                {["Product", "Price", "Status", "Campaign", "Actions"].map(h => (
                  <th key={h} style={{ padding: "10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(p => (
                <tr key={p.id} style={{ borderBottom: "1px solid #f5f4f0", cursor: "pointer" }} onClick={() => setDrawer(p)}>
                  <td style={{ padding: "8px 10px" }}>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{p.category} · Stock: {p.stock}</div>
                  </td>
                  <td style={{ padding: "8px 10px", fontWeight: 800, color: "#ff5722" }}>₦{Number(p.price??0).toLocaleString()}</td>
                  <td style={{ padding: "8px 10px" }}><StatusPill status={p.status} /></td>
                  <td style={{ padding: "8px 10px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {p.campaign_tag && <FlagChip label={p.campaign_tag} color="#059669" />}
                      {p.badge && <FlagChip label={p.badge} color="#0284c7" />}
                    </div>
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <button className="btn b-ghost" onClick={() => setDrawer(p)} style={{ fontSize: 11, padding: "4px 10px", height: 28 }}>Edit / View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addModal && <AddProductModal onAdd={handleAdd} onClose={() => setAddModal(false)} />}
      {drawer && <ProductDrawer product={drawer} onClose={() => setDrawer(null)} onApprove={handleApprove} onFlag={handleFlag} onSaveEdit={handleSaveEdit} onPermanentDelete={handlePermanentDelete} confirm={confirm} />}
    </div>
  );
}
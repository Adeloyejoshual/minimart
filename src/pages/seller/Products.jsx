// pages/seller/Products.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { sellerApi, useDashboard } from "./SellerDashboard";

/* ─── Helpers ─── */
const fmt = (v) =>
  `₦${Number(v ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const isMobile = () => window.innerWidth < 640;

/* ─── Spinner ─── */
const Spin = ({ size = 24, color = "#6366f1" }) => (
  <div style={{
    width:        size,
    height:       size,
    border:       `${Math.max(2, Math.ceil(size / 10))}px solid #e5e7eb`,
    borderTop:    `${Math.max(2, Math.ceil(size / 10))}px solid ${color}`,
    borderRadius: "50%",
    animation:    "spin 0.7s linear infinite",
    flexShrink:   0,
  }} />
);

/* ─── Stock badge ─── */
const StockBadge = ({ stock }) => {
  const n = Number(stock ?? 0);
  const cfg =
    n <= 0  ? { bg:"#fef2f2", color:"#991b1b", dot:"#ef4444", text:"Out of stock"     } :
    n <= 5  ? { bg:"#fffbeb", color:"#92400e", dot:"#f59e0b", text:`Low — ${n} left`  } :
    n <= 20 ? { bg:"#fff7ed", color:"#c2410c", dot:"#f97316", text:`${n} in stock`    } :
              { bg:"#ecfdf5", color:"#065f46", dot:"#10b981", text:`${n} in stock`    };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:"0.3rem",
      padding:"0.22rem 0.6rem", borderRadius:"100px", fontSize:"0.68rem",
      fontWeight:700, background:cfg.bg, color:cfg.color }}>
      <span style={{ width:6, height:6, borderRadius:"50%",
        background:cfg.dot, flexShrink:0 }} />
      {cfg.text}
    </span>
  );
};

/* ─── Status chip ─── */
const StatusChip = ({ status }) => {
  const cfg = {
    active:       { bg:"#ecfdf5", color:"#065f46", label:"Active"       },
    inactive:     { bg:"#f9fafb", color:"#6b7280", label:"Inactive"     },
    out_of_stock: { bg:"#fef2f2", color:"#991b1b", label:"Out of Stock" },
  }[status] ?? { bg:"#f3f4f6", color:"#6b7280", label: status ?? "—" };

  return (
    <span style={{ padding:"0.18rem 0.55rem", borderRadius:"100px",
      fontSize:"0.65rem", fontWeight:700,
      background:cfg.bg, color:cfg.color }}>
      {cfg.label}
    </span>
  );
};

/* ─── Skeleton ─── */
const SkeletonCard = () => (
  <div style={{ background:"white", borderRadius:"16px",
    border:"1px solid #f3f4f6", overflow:"hidden" }}>
    <div style={{ height:160, background:
      "linear-gradient(90deg,#f3f4f6 25%,#e9eaf0 50%,#f3f4f6 75%)",
      backgroundSize:"400px 100%", animation:"sdShimmer 1.4s infinite" }} />
    <div style={{ padding:"0.9rem", display:"flex",
      flexDirection:"column", gap:"0.5rem" }}>
      {[75, 50, 90].map((w, i) => (
        <div key={i} style={{ height:11, width:`${w}%`, borderRadius:"100px",
          background:"linear-gradient(90deg,#f3f4f6 25%,#e9eaf0 50%,#f3f4f6 75%)",
          backgroundSize:"400px 100%", animation:"sdShimmer 1.4s infinite" }} />
      ))}
    </div>
  </div>
);

const SkeletonRow = () => (
  <div style={{ display:"flex", alignItems:"center", gap:"0.875rem",
    padding:"0.875rem 1rem", borderBottom:"1px solid #f3f4f6" }}>
    <div style={{ width:48, height:48, borderRadius:10, flexShrink:0,
      background:"linear-gradient(90deg,#f3f4f6 25%,#e9eaf0 50%,#f3f4f6 75%)",
      backgroundSize:"400px 100%", animation:"sdShimmer 1.4s infinite" }} />
    <div style={{ flex:1, display:"flex", flexDirection:"column", gap:"0.4rem" }}>
      {[60, 40].map((w, i) => (
        <div key={i} style={{ height:11, width:`${w}%`, borderRadius:"100px",
          background:"linear-gradient(90deg,#f3f4f6 25%,#e9eaf0 50%,#f3f4f6 75%)",
          backgroundSize:"400px 100%", animation:"sdShimmer 1.4s infinite" }} />
      ))}
    </div>
    <div style={{ width:70, height:22, borderRadius:8,
      background:"linear-gradient(90deg,#f3f4f6 25%,#e9eaf0 50%,#f3f4f6 75%)",
      backgroundSize:"400px 100%", animation:"sdShimmer 1.4s infinite" }} />
  </div>
);

/* ─── Field ─── */
const Field = ({ label, error, hint, children }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:"0.3rem" }}>
    <label style={{ fontSize:"0.8rem", fontWeight:600,
      color:"#374151" }}>{label}</label>
    {children}
    {hint  && <p style={{ color:"#9ca3af", fontSize:"0.72rem", margin:0 }}>{hint}</p>}
    {error && <p style={{ color:"#ef4444", fontSize:"0.72rem", margin:0 }}>{error}</p>}
  </div>
);

const inputStyle = (err) => ({
  width:"100%", padding:"0.72rem 0.9rem",
  border:`1.5px solid ${err ? "#ef4444" : "#e5e7eb"}`,
  borderRadius:"10px", fontSize:"0.875rem", color:"#374151",
  boxSizing:"border-box", background:"white", fontFamily:"inherit",
  outline:"none", transition:"border-color 0.15s",
});

/* ─── Delete Modal ─── */
const DeleteModal = ({ product, onClose, onDeleted }) => {
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState(null);

  const handleDelete = async () => {
    setDeleting(true); setError(null);
    try {
      const { data } = await sellerApi.delete(
        `/api/seller/products/${product.id}`
      );
      if (data.success) { onDeleted?.(); onClose(); }
      else setError(data.message ?? "Delete failed");
    } catch (err) {
      setError(err.response?.data?.message ?? "Delete failed");
    } finally { setDeleting(false); }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth:380 }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ padding:"2rem 1.75rem", display:"flex",
          flexDirection:"column", gap:"1.1rem" }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:"3rem", lineHeight:1 }}>🗑️</div>
            <h3 style={{ fontWeight:800, color:"#1f2937",
              margin:"0.75rem 0 0.4rem", fontSize:"1.1rem" }}>
              Delete Product?
            </h3>
            <p style={{ color:"#6b7280", fontSize:"0.875rem", margin:0, lineHeight:1.5 }}>
              <strong>"{product.name ?? product.title}"</strong> will be
              permanently removed. This cannot be undone.
            </p>
          </div>

          {error && (
            <div style={{ background:"#fef2f2", border:"1px solid #fecaca",
              borderRadius:"10px", padding:"0.75rem 1rem",
              color:"#991b1b", fontSize:"0.85rem" }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display:"flex", gap:"0.75rem" }}>
            <button onClick={onClose} style={S.cancelBtn}>Keep It</button>
            <button onClick={handleDelete} disabled={deleting}
              style={{ ...S.dangerBtn, opacity: deleting ? 0.7 : 1 }}>
              {deleting
                ? <span style={{ display:"flex", alignItems:"center",
                    gap:"0.4rem", justifyContent:"center" }}>
                    <Spin size={16} color="white" /> Deleting…
                  </span>
                : "Yes, Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Edit Modal ─── */
const EditModal = ({ product, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name:        product?.name        ?? product?.title ?? "",
    description: product?.description ?? "",
    price:       product?.price       ?? "",
    stock:       product?.stock       ?? product?.quantity ?? "",
    category:    product?.category    ?? "",
    sku:         product?.sku         ?? "",
    status:      product?.status      ?? "active",
  });
  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState(null);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: "" }));
    setMsg(null);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())  e.name  = "Product name is required";
    if (!form.price || isNaN(form.price) || Number(form.price) <= 0)
      e.price = "Enter a valid price";
    if (form.stock === "" || isNaN(form.stock) || Number(form.stock) < 0)
      e.stock = "Enter valid stock quantity";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true); setMsg(null);
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price),
        stock: parseInt(form.stock),
      };
      const res = await sellerApi.put(
        `/api/seller/products/${product.id}`, payload
      );
      if (res.data.success) {
        setMsg({ type:"success", text:"Product updated!" });
        setTimeout(() => { onSaved?.(); onClose(); }, 1000);
      } else {
        setMsg({ type:"error", text: res.data.message });
      }
    } catch (err) {
      setMsg({ type:"error",
        text: err.response?.data?.message ?? "Save failed" });
    } finally { setSaving(false); }
  };

  const CATEGORIES = [
    "Fashion","Electronics","Food & Beverages","Health & Beauty",
    "Home & Living","Sports","Books & Media","Agriculture","Services","Other",
  ];

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={S.modalHeader}>
          <h2 style={{ fontWeight:800, color:"#1f2937",
            margin:0, fontSize:"1.05rem" }}>
            ✏️ Edit Product
          </h2>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>

        {/* Body */}
        <div style={S.modalBody}>

          <Field label="Product Name *" error={errors.name}>
            <input value={form.name} onChange={set("name")}
              placeholder="e.g. Premium Cotton T-Shirt"
              style={inputStyle(errors.name)} />
          </Field>

          <Field label="Description"
            hint="Help buyers understand your product">
            <textarea value={form.description} onChange={set("description")}
              placeholder="Describe your product…" rows={3}
              style={{ ...inputStyle(false), resize:"vertical",
                minHeight:"80px" }} />
          </Field>

          <div style={{ display:"grid",
            gridTemplateColumns:"1fr 1fr", gap:"0.875rem" }}>
            <Field label="Price (₦) *" error={errors.price}>
              <input type="number" value={form.price} onChange={set("price")}
                placeholder="0.00" min="0" step="0.01"
                style={inputStyle(errors.price)} />
            </Field>
            <Field label="Stock Qty *" error={errors.stock}>
              <input type="number" value={form.stock} onChange={set("stock")}
                placeholder="0" min="0"
                style={inputStyle(errors.stock)} />
            </Field>
          </div>

          <div style={{ display:"grid",
            gridTemplateColumns:"1fr 1fr", gap:"0.875rem" }}>
            <Field label="Category">
              <select value={form.category} onChange={set("category")}
                style={{ ...inputStyle(false), cursor:"pointer" }}>
                <option value="">Select…</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="SKU" hint="Internal code">
              <input value={form.sku} onChange={set("sku")}
                placeholder="SKU-001"
                style={inputStyle(false)} />
            </Field>
          </div>

          <Field label="Status">
            <select value={form.status} onChange={set("status")}
              style={{ ...inputStyle(false), cursor:"pointer" }}>
              <option value="active">Active — visible to buyers</option>
              <option value="inactive">Inactive — hidden</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </Field>

          {msg && (
            <div style={{
              padding:"0.75rem 1rem", borderRadius:"10px",
              background: msg.type === "success" ? "#ecfdf5" : "#fef2f2",
              color:      msg.type === "success" ? "#065f46" : "#991b1b",
              border:`1px solid ${msg.type === "success" ? "#a7f3d0" : "#fecaca"}`,
              fontSize:"0.875rem", fontWeight:500,
            }}>
              {msg.type === "success" ? "✅" : "⚠️"} {msg.text}
            </div>
          )}

          <div style={{ display:"flex", gap:"0.75rem" }}>
            <button onClick={onClose} style={S.cancelBtn}>Cancel</button>
            <button onClick={handleSave} disabled={saving}
              style={{ ...S.primaryBtn, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN PRODUCTS PAGE
═══════════════════════════════════════════════════════════ */
export default function Products() {
  const navigate = useNavigate();
  const { vendor } = useDashboard();

  const [products,     setProducts]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter,       setFilter]       = useState("");
  const [page,         setPage]         = useState(1);
  const [pagination,   setPagination]   = useState(null);
  const [viewMode,     setViewMode]     = useState("grid"); // "grid" | "list"
  const [editProduct,  setEditProduct]  = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [refreshing,   setRefreshing]   = useState(false);
  const [screenW,      setScreenW]      = useState(window.innerWidth);

  const searchRef = useRef();
  const LIMIT = 12;

  /* ── Responsive listener ── */
  useEffect(() => {
    const fn = () => setScreenW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const mobile = screenW < 640;
  const tablet = screenW < 1024;

  /* ── Debounce search ── */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  /* ── Fetch products ── */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (filter)          params.status = filter;
      if (debouncedSearch) params.search = debouncedSearch;
      const { data } = await sellerApi.get("/api/seller/products", params);
      if (data.success) {
        setProducts(data.products ?? []);
        setPagination(data.pagination ?? null);
      }
    } catch (err) {
      console.error("[Products]", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, filter, debouncedSearch]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filter, debouncedSearch]);

  const refresh = () => { setRefreshing(true); load(true); };

  const FILTERS = [
    { key:"",             label:"All"          },
    { key:"active",       label:"✅ Active"     },
    { key:"inactive",     label:"🔕 Inactive"   },
    { key:"out_of_stock", label:"📭 Out of Stock"},
  ];

  /* ── Summary stats ── */
  const totalStock = products.reduce((s, p) =>
    s + Number(p.stock ?? p.quantity ?? 0), 0);
  const lowStock = products.filter((p) =>
    Number(p.stock ?? p.quantity ?? 0) <= 5).length;
  const activeCount = products.filter((p) =>
    p.status === "active").length;

  /* ─────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────── */
  return (
    <>
      {/* ── Global keyframes ── */}
      <style>{`
        @keyframes spin       { to { transform: rotate(360deg); } }
        @keyframes sdShimmer  {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        @keyframes fadeSlideUp {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0);   }
        }
        .prod-card {
          background:white; border-radius:16px;
          border:1px solid #f3f4f6; overflow:hidden;
          box-shadow:0 1px 4px rgba(0,0,0,0.04);
          transition:box-shadow 0.2s, transform 0.2s;
          animation: fadeSlideUp 0.25s ease;
          cursor:default;
        }
        .prod-card:hover {
          box-shadow:0 8px 24px rgba(99,102,241,0.12);
          transform:translateY(-2px);
        }
        .prod-row {
          display:flex; align-items:center; gap:0.875rem;
          padding:0.875rem 1rem; border-bottom:1px solid #f9fafb;
          background:white; transition:background 0.15s;
          animation: fadeSlideUp 0.2s ease;
        }
        .prod-row:last-child { border-bottom:none; }
        .prod-row:hover { background:#fafafa; }
        .icon-btn:hover { background:#f3f4f6 !important; }
        .view-btn:hover { opacity:0.85; }
        .filter-pill:hover { border-color:#6366f1 !important;
          color:#6366f1 !important; }
        .page-btn:hover:not(:disabled) { border-color:#6366f1;
          color:#6366f1; }
        input:focus, select:focus, textarea:focus {
          border-color:#6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.08);
        }
      `}</style>

      <div style={{ display:"flex", flexDirection:"column",
        gap:"1.25rem" }}>

        {/* ══ HEADER ══════════════════════════════════════ */}
        <div style={{ display:"flex", justifyContent:"space-between",
          alignItems:"flex-start", flexWrap:"wrap", gap:"0.75rem" }}>

          <div>
            <h2 style={{ fontWeight:800, fontSize:"1.35rem",
              color:"#1f2937", margin:0 }}>
              🏷️ My Products
            </h2>
            <p style={{ color:"#9ca3af", fontSize:"0.85rem",
              margin:"0.2rem 0 0" }}>
              {pagination?.total ?? products.length} products in your store
            </p>
          </div>

          <div style={{ display:"flex", gap:"0.5rem",
            alignItems:"center", flexWrap:"wrap" }}>
            {/* Refresh */}
            <button onClick={refresh} disabled={refreshing}
              className="icon-btn"
              style={{ background:"white", border:"1px solid #e5e7eb",
                borderRadius:"10px", padding:"0.6rem 0.875rem",
                cursor:"pointer", fontSize:"1rem", color:"#6b7280",
                display:"flex", alignItems:"center", gap:"0.35rem",
                transition:"background 0.15s" }}>
              <span style={{ display:"inline-block",
                animation: refreshing ? "spin 0.7s linear infinite" : "none",
                lineHeight:1 }}>
                ↻
              </span>
              {!mobile && <span style={{ fontSize:"0.8rem" }}>Refresh</span>}
            </button>

            {/* View toggle — hidden on mobile */}
            {!mobile && (
              <div style={{ display:"flex", background:"white",
                border:"1px solid #e5e7eb", borderRadius:"10px",
                padding:"3px", gap:"2px" }}>
                {[
                  { mode:"grid", icon:"⊞" },
                  { mode:"list", icon:"☰" },
                ].map(({ mode, icon }) => (
                  <button key={mode}
                    className="view-btn"
                    onClick={() => setViewMode(mode)}
                    style={{
                      padding:      "0.35rem 0.65rem",
                      borderRadius: "7px",
                      border:       "none",
                      cursor:       "pointer",
                      fontSize:     "1rem",
                      background:   viewMode === mode ? "#6366f1" : "transparent",
                      color:        viewMode === mode ? "white"   : "#9ca3af",
                      transition:   "all 0.15s",
                      lineHeight:   1,
                    }}>
                    {icon}
                  </button>
                ))}
              </div>
            )}

            {/* Post product → PostAds */}
            <button
              onClick={() => navigate("/minimart/post-ad")}
              style={{
                padding:      "0.68rem 1.25rem",
                background:   "linear-gradient(135deg,#ff5722,#ff8a00)",
                color:        "white",
                border:       "none",
                borderRadius: "11px",
                fontWeight:   700,
                cursor:       "pointer",
                fontSize:     "0.875rem",
                whiteSpace:   "nowrap",
                fontFamily:   "inherit",
                display:      "flex",
                alignItems:   "center",
                gap:          "0.35rem",
                boxShadow:    "0 2px 8px rgba(255,87,34,0.3)",
                transition:   "opacity 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <span>＋</span>
              {mobile ? "Post Ad" : "Post New Product"}
            </button>
          </div>
        </div>

        {/* ══ SUMMARY STRIP ═══════════════════════════════ */}
        {!loading && products.length > 0 && (
          <div style={{ display:"grid",
            gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3,1fr)",
            gap:"0.75rem" }}>
            {[
              { label:"Active Listings", value:activeCount,
                icon:"✅", color:"#10b981", bg:"#ecfdf5" },
              { label:"Total Stock",     value:totalStock,
                icon:"📦", color:"#6366f1", bg:"#eff6ff" },
              { label:"Low Stock Items", value:lowStock,
                icon:"⚠️", color:"#f59e0b", bg:"#fffbeb" },
            ].map((s) => (
              <div key={s.label} style={{ background:"white",
                borderRadius:"14px", padding:"0.875rem 1rem",
                border:"1px solid #f3f4f6",
                display:"flex", alignItems:"center",
                gap:"0.75rem" }}>
                <div style={{ width:38, height:38, borderRadius:"10px",
                  background:s.bg, display:"flex", alignItems:"center",
                  justifyContent:"center", fontSize:"1.1rem",
                  flexShrink:0 }}>
                  {s.icon}
                </div>
                <div>
                  <p style={{ fontWeight:800, color:s.color,
                    margin:0, fontSize:"1.15rem", lineHeight:1 }}>
                    {s.value.toLocaleString()}
                  </p>
                  <p style={{ color:"#9ca3af", fontSize:"0.72rem",
                    margin:"0.2rem 0 0", lineHeight:1 }}>
                    {s.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ SEARCH + FILTERS ════════════════════════════ */}
        <div style={{ display:"flex", flexDirection:"column",
          gap:"0.6rem" }}>
          {/* Search */}
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:"0.9rem",
              top:"50%", transform:"translateY(-50%)",
              fontSize:"0.9rem", color:"#9ca3af",
              pointerEvents:"none" }}>
              🔍
            </span>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search by name, SKU, category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width:        "100%",
                padding:      "0.75rem 2.5rem 0.75rem 2.4rem",
                border:       "1.5px solid #e5e7eb",
                borderRadius: "12px",
                fontSize:     "0.875rem",
                background:   "white",
                color:        "#374151",
                boxSizing:    "border-box",
                fontFamily:   "inherit",
                outline:      "none",
                transition:   "border-color 0.15s",
              }}
            />
            {search && (
              <button onClick={() => { setSearch(""); searchRef.current?.focus(); }}
                style={{ position:"absolute", right:"0.8rem",
                  top:"50%", transform:"translateY(-50%)",
                  background:"#f3f4f6", border:"none", cursor:"pointer",
                  color:"#6b7280", fontSize:"0.75rem",
                  width:22, height:22, borderRadius:"50%",
                  display:"flex", alignItems:"center",
                  justifyContent:"center", lineHeight:1 }}>
                ✕
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
            {FILTERS.map(({ key, label }) => (
              <button key={key}
                className="filter-pill"
                onClick={() => setFilter(key)}
                style={{
                  padding:      "0.38rem 0.875rem",
                  borderRadius: "100px",
                  border:       `1.5px solid ${filter === key ? "#6366f1" : "#e5e7eb"}`,
                  cursor:       "pointer",
                  fontSize:     "0.78rem",
                  whiteSpace:   "nowrap",
                  fontFamily:   "inherit",
                  fontWeight:   filter === key ? 700 : 500,
                  background:   filter === key ? "#6366f1" : "white",
                  color:        filter === key ? "white"   : "#6b7280",
                  transition:   "all 0.15s",
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ══ PRODUCT LIST ════════════════════════════════ */}

        {/* Loading */}
        {loading ? (
          viewMode === "grid" || mobile ? (
            <div style={{ display:"grid", gap:"1rem",
              gridTemplateColumns: mobile
                ? "repeat(2,1fr)"
                : tablet
                  ? "repeat(3,1fr)"
                  : "repeat(4,1fr)" }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (
            <div style={{ background:"white", borderRadius:"16px",
              border:"1px solid #f3f4f6", overflow:"hidden" }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          )

        /* Empty */
        ) : products.length === 0 ? (
          <div style={{ background:"white", borderRadius:"20px",
            border:"1px solid #f3f4f6",
            padding: mobile ? "3rem 1.5rem" : "5rem 2rem",
            textAlign:"center", display:"flex",
            flexDirection:"column", alignItems:"center", gap:"0.75rem" }}>
            <span style={{ fontSize:"3.5rem", lineHeight:1 }}>
              {search || filter ? "🔍" : "🏷️"}
            </span>
            <h3 style={{ fontWeight:700, color:"#374151",
              margin:0, fontSize:"1.1rem" }}>
              {search || filter ? "No products found" : "No products yet"}
            </h3>
            <p style={{ color:"#9ca3af", fontSize:"0.875rem",
              margin:0, maxWidth:280, lineHeight:1.5 }}>
              {search || filter
                ? "Try a different search term or clear the filter"
                : "Start by posting your first product to the marketplace"}
            </p>
            {!search && !filter && (
              <button
                onClick={() => navigate("/minimart/post-ad")}
                style={{ marginTop:"0.5rem", padding:"0.75rem 1.5rem",
                  background:"linear-gradient(135deg,#ff5722,#ff8a00)",
                  color:"white", border:"none", borderRadius:"12px",
                  fontWeight:700, cursor:"pointer", fontSize:"0.9rem",
                  fontFamily:"inherit",
                  boxShadow:"0 2px 8px rgba(255,87,34,0.3)" }}>
                ＋ Post Your First Product
              </button>
            )}
            {(search || filter) && (
              <button
                onClick={() => { setSearch(""); setFilter(""); }}
                style={{ marginTop:"0.5rem", padding:"0.6rem 1.25rem",
                  background:"white", color:"#6366f1",
                  border:"1.5px solid #6366f1", borderRadius:"10px",
                  fontWeight:600, cursor:"pointer", fontSize:"0.875rem",
                  fontFamily:"inherit" }}>
                Clear filters
              </button>
            )}
          </div>

        /* Grid view */
        ) : viewMode === "grid" || mobile ? (
          <div style={{ display:"grid", gap:"1rem",
            gridTemplateColumns: mobile
              ? "repeat(2,1fr)"
              : tablet
                ? "repeat(3,1fr)"
                : "repeat(4,1fr)" }}>
            {products.map((p) => (
              <div key={p.id} className="prod-card">

                {/* Image */}
                <div style={{ height: mobile ? 130 : 155,
                  background:"#f8fafc", position:"relative",
                  overflow:"hidden", display:"flex",
                  alignItems:"center", justifyContent:"center" }}>
                  {p.image_url || p.images?.[0] ? (
                    <img
                      src={p.image_url ?? p.images[0]}
                      alt={p.name ?? p.title}
                      style={{ width:"100%", height:"100%",
                        objectFit:"cover", display:"block" }}
                      onError={(e) => {
                        e.target.style.display = "none";
                        e.target.nextSibling.style.display = "flex";
                      }}
                    />
                  ) : null}
                  <span style={{ fontSize:"2.2rem",
                    display: p.image_url || p.images?.[0]
                      ? "none" : "flex" }}>
                    📦
                  </span>
                  {/* Status overlay */}
                  <div style={{ position:"absolute",
                    top:8, left:8 }}>
                    <StatusChip status={p.status} />
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: mobile ? "0.7rem" : "0.875rem",
                  display:"flex", flexDirection:"column", gap:"0.35rem" }}>
                  <p style={{ fontWeight:700, color:"#1f2937",
                    margin:0, fontSize: mobile ? "0.8rem" : "0.875rem",
                    overflow:"hidden", textOverflow:"ellipsis",
                    whiteSpace:"nowrap" }}
                    title={p.name ?? p.title}>
                    {p.name ?? p.title}
                  </p>

                  {p.category && (
                    <p style={{ color:"#9ca3af", fontSize:"0.68rem",
                      margin:0 }}>
                      {p.category}
                    </p>
                  )}

                  <div style={{ display:"flex",
                    justifyContent:"space-between",
                    alignItems:"center", marginTop:"0.15rem",
                    flexWrap:"wrap", gap:"0.25rem" }}>
                    <span style={{ fontWeight:800, color:"#1f2937",
                      fontSize: mobile ? "0.95rem" : "1rem" }}>
                      {fmt(p.price)}
                    </span>
                    <StockBadge stock={p.stock ?? p.quantity ?? 0} />
                  </div>

                  {p.sku && !mobile && (
                    <p style={{ color:"#d1d5db", fontSize:"0.65rem",
                      margin:0, fontFamily:"monospace" }}>
                      {p.sku}
                    </p>
                  )}

                  {/* Actions */}
                  <div style={{ display:"flex", gap:"0.4rem",
                    marginTop:"0.5rem" }}>
                    <button
                      onClick={() => setEditProduct(p)}
                      style={{ flex:1, padding:"0.5rem 0.25rem",
                        background:"#eff6ff", border:"1px solid #bfdbfe",
                        borderRadius:"8px", color:"#1e40af",
                        cursor:"pointer", fontWeight:600,
                        fontSize: mobile ? "0.72rem" : "0.78rem",
                        fontFamily:"inherit", transition:"opacity 0.15s" }}>
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(p)}
                      style={{ padding:"0.5rem 0.6rem",
                        background:"#fef2f2", border:"1px solid #fecaca",
                        borderRadius:"8px", color:"#ef4444",
                        cursor:"pointer", fontSize:"0.875rem",
                        fontFamily:"inherit", transition:"opacity 0.15s" }}>
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

        /* List view (desktop only) */
        ) : (
          <div style={{ background:"white", borderRadius:"16px",
            border:"1px solid #f3f4f6", overflow:"hidden" }}>

            {/* Table header */}
            <div style={{ display:"grid",
              gridTemplateColumns:"2.5fr 1fr 1fr 1fr auto",
              gap:"0.5rem", padding:"0.75rem 1.25rem",
              background:"#f9fafb", borderBottom:"1px solid #f3f4f6" }}>
              {["Product","Price","Stock","Status","Actions"].map((h) => (
                <span key={h} style={{ fontSize:"0.72rem", fontWeight:700,
                  color:"#9ca3af", textTransform:"uppercase",
                  letterSpacing:"0.05em" }}>
                  {h}
                </span>
              ))}
            </div>

            {products.map((p) => (
              <div key={p.id} className="prod-row"
                style={{ display:"grid",
                  gridTemplateColumns:"2.5fr 1fr 1fr 1fr auto",
                  gap:"0.5rem", alignItems:"center",
                  padding:"0.875rem 1.25rem",
                  borderBottom:"1px solid #f9fafb" }}>

                {/* Product info */}
                <div style={{ display:"flex", alignItems:"center",
                  gap:"0.75rem", minWidth:0 }}>
                  <div style={{ width:48, height:48,
                    borderRadius:10, background:"#f8fafc",
                    flexShrink:0, overflow:"hidden",
                    display:"flex", alignItems:"center",
                    justifyContent:"center" }}>
                    {p.image_url || p.images?.[0] ? (
                      <img src={p.image_url ?? p.images[0]}
                        alt="" style={{ width:"100%", height:"100%",
                          objectFit:"cover" }}
                        onError={(e) => {
                          e.target.style.display = "none";
                        }} />
                    ) : (
                      <span style={{ fontSize:"1.4rem" }}>📦</span>
                    )}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <p style={{ fontWeight:600, color:"#1f2937",
                      margin:0, fontSize:"0.875rem",
                      overflow:"hidden", textOverflow:"ellipsis",
                      whiteSpace:"nowrap" }}>
                      {p.name ?? p.title}
                    </p>
                    {p.sku && (
                      <p style={{ color:"#d1d5db", fontSize:"0.68rem",
                        margin:"0.15rem 0 0", fontFamily:"monospace" }}>
                        {p.sku}
                      </p>
                    )}
                    {p.category && (
                      <p style={{ color:"#9ca3af", fontSize:"0.7rem",
                        margin:"0.1rem 0 0" }}>
                        {p.category}
                      </p>
                    )}
                  </div>
                </div>

                {/* Price */}
                <span style={{ fontWeight:700, color:"#1f2937",
                  fontSize:"0.9rem" }}>
                  {fmt(p.price)}
                </span>

                {/* Stock */}
                <StockBadge stock={p.stock ?? p.quantity ?? 0} />

                {/* Status */}
                <StatusChip status={p.status} />

                {/* Actions */}
                <div style={{ display:"flex", gap:"0.4rem" }}>
                  <button onClick={() => setEditProduct(p)}
                    style={{ padding:"0.45rem 0.75rem",
                      background:"#eff6ff", border:"1px solid #bfdbfe",
                      borderRadius:"8px", color:"#1e40af",
                      cursor:"pointer", fontWeight:600,
                      fontSize:"0.78rem", fontFamily:"inherit",
                      whiteSpace:"nowrap" }}>
                    ✏️ Edit
                  </button>
                  <button onClick={() => setDeleteTarget(p)}
                    style={{ padding:"0.45rem 0.6rem",
                      background:"#fef2f2", border:"1px solid #fecaca",
                      borderRadius:"8px", color:"#ef4444",
                      cursor:"pointer", fontSize:"0.875rem",
                      fontFamily:"inherit" }}>
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ PAGINATION ══════════════════════════════════ */}
        {pagination?.total_pages > 1 && (
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", flexWrap:"wrap", gap:"0.75rem",
            background:"white", borderRadius:"14px",
            padding:"0.875rem 1.25rem", border:"1px solid #f3f4f6" }}>
            <p style={{ fontSize:"0.78rem", color:"#9ca3af", margin:0 }}>
              Page {pagination.page} of {pagination.total_pages} ·{" "}
              {pagination.total} products
            </p>
            <div style={{ display:"flex", gap:"0.35rem", flexWrap:"wrap" }}>
              <button
                className="page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding:"0.4rem 0.75rem",
                  border:"1px solid #e5e7eb", borderRadius:"8px",
                  background:"white", cursor: page === 1 ? "default" : "pointer",
                  fontSize:"0.78rem", color:"#374151", fontWeight:500,
                  opacity: page === 1 ? 0.4 : 1,
                  transition:"all 0.15s", fontFamily:"inherit" }}>
                ← Prev
              </button>

              {Array.from(
                { length: Math.min(pagination.total_pages, 5) },
                (_, i) => {
                  const tp = pagination.total_pages;
                  let p2;
                  if (tp <= 5)        p2 = i + 1;
                  else if (page <= 3) p2 = i + 1;
                  else if (page >= tp - 2) p2 = tp - 4 + i;
                  else p2 = page - 2 + i;
                  const active = page === p2;
                  return (
                    <button key={p2} onClick={() => setPage(p2)}
                      style={{ padding:"0.4rem 0",
                        minWidth:36, border:"1px solid",
                        borderRadius:"8px", cursor:"pointer",
                        fontSize:"0.78rem", fontWeight: active ? 700 : 500,
                        background:   active ? "#6366f1" : "white",
                        color:        active ? "white"   : "#374151",
                        borderColor:  active ? "#6366f1" : "#e5e7eb",
                        transition:   "all 0.15s",
                        fontFamily:   "inherit" }}>
                      {p2}
                    </button>
                  );
                }
              )}

              <button
                className="page-btn"
                onClick={() => setPage((p) =>
                  Math.min(pagination.total_pages, p + 1))}
                disabled={page === pagination.total_pages}
                style={{ padding:"0.4rem 0.75rem",
                  border:"1px solid #e5e7eb", borderRadius:"8px",
                  background:"white",
                  cursor: page === pagination.total_pages ? "default" : "pointer",
                  fontSize:"0.78rem", color:"#374151", fontWeight:500,
                  opacity: page === pagination.total_pages ? 0.4 : 1,
                  transition:"all 0.15s", fontFamily:"inherit" }}>
                Next →
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ══ MODALS ══════════════════════════════════════ */}
      {editProduct && (
        <EditModal
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSaved={() => load()}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          product={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => load()}
        />
      )}
    </>
  );
}

/* ─── Shared modal styles ─── */
const S = {
  overlay: {
    position:"fixed", inset:0,
    background:"rgba(0,0,0,0.45)",
    display:"flex", alignItems:"center", justifyContent:"center",
    zIndex:1000, padding:"1rem",
    backdropFilter:"blur(4px)",
  },
  modal: {
    background:"white", borderRadius:"20px",
    width:"100%", maxWidth:520,
    maxHeight:"92vh", overflowY:"auto",
    boxShadow:"0 24px 64px rgba(0,0,0,0.18)",
  },
  modalHeader: {
    display:"flex", justifyContent:"space-between",
    alignItems:"center", padding:"1.25rem 1.5rem",
    borderBottom:"1px solid #f3f4f6",
    position:"sticky", top:0,
    background:"white", zIndex:1,
    borderRadius:"20px 20px 0 0",
  },
  modalBody: {
    padding:"1.5rem",
    display:"flex", flexDirection:"column", gap:"1.1rem",
  },
  closeBtn: {
    background:"none", border:"none", cursor:"pointer",
    fontSize:"1.1rem", color:"#9ca3af",
    padding:"0.25rem", lineHeight:1,
  },
  cancelBtn: {
    flex:1, padding:"0.8rem",
    background:"white", border:"1px solid #e5e7eb",
    borderRadius:"12px", fontWeight:600,
    cursor:"pointer", color:"#374151",
    fontSize:"0.9rem", fontFamily:"inherit",
  },
  primaryBtn: {
    flex:2, padding:"0.8rem",
    background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
    color:"white", border:"none",
    borderRadius:"12px", fontWeight:700,
    cursor:"pointer", fontSize:"0.9rem",
    fontFamily:"inherit", transition:"opacity 0.15s",
  },
  dangerBtn: {
    flex:1, padding:"0.8rem",
    background:"#ef4444", color:"white",
    border:"none", borderRadius:"12px",
    fontWeight:700, cursor:"pointer",
    fontSize:"0.9rem", fontFamily:"inherit",
  },
};
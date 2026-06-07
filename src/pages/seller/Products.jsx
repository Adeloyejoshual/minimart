// pages/seller/Products.jsx
import React, { useState, useEffect, useCallback } from "react";
import { sellerApi } from "./SellerDashboard";
import { useDashboard } from "./SellerDashboard";

const fmt = (v) =>
  `₦${Number(v ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ── Spinner ────────────────────────────────────────────────────
const Spin = ({ size = 24 }) => (
  <div style={{
    width:        size,
    height:       size,
    border:       `${Math.ceil(size / 10)}px solid #e5e7eb`,
    borderTop:    `${Math.ceil(size / 10)}px solid #6366f1`,
    borderRadius: "50%",
    animation:    "spin 0.7s linear infinite",
    flexShrink:   0,
  }} />
);

// ── Field wrapper ──────────────────────────────────────────────
const Field = ({ label, error, hint, children }) => (
  <div>
    <label style={fm.label}>{label}</label>
    {children}
    {hint && (
      <p style={{ color:"#9ca3af", fontSize:"0.72rem",
        margin:"0.25rem 0 0" }}>
        {hint}
      </p>
    )}
    {error && (
      <p style={{ color:"#ef4444", fontSize:"0.72rem",
        margin:"0.25rem 0 0" }}>
        {error}
      </p>
    )}
  </div>
);

// ── Add / Edit Product Modal ───────────────────────────────────
const ProductModal = ({ product, onClose, onSaved }) => {
  const isEdit = !!product;

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
    if (!form.name.trim())
      e.name = "Product name is required";
    if (!form.price || isNaN(form.price) || Number(form.price) <= 0)
      e.price = "Enter a valid price";
    if (form.stock === "" || isNaN(form.stock) || Number(form.stock) < 0)
      e.stock = "Enter valid stock quantity";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price),
        stock: parseInt(form.stock),
      };
      let res;
      if (isEdit) {
        res = await sellerApi.put(
          `/api/seller/products/${product.id}`, payload
        );
      } else {
        res = await sellerApi.post(
          "/api/seller/products", payload
        );
      }
      if (res.data.success) {
        setMsg({ type: "success",
          text: isEdit ? "Product updated!" : "Product added!" });
        setTimeout(() => { onSaved?.(); onClose(); }, 1200);
      } else {
        setMsg({ type: "error", text: res.data.message });
      }
    } catch (err) {
      setMsg({
        type: "error",
        text: err.response?.data?.message ?? "Save failed",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={pm.overlay} onClick={onClose}>
      <div style={pm.modal} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={pm.header}>
          <h2 style={pm.title}>
            {isEdit ? "✏️ Edit Product" : "➕ Add Product"}
          </h2>
          <button style={pm.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={pm.body}>

          <Field label="Product Name *" error={errors.name}>
            <input
              value={form.name}
              onChange={set("name")}
              placeholder="e.g. Premium Cotton T-Shirt"
              style={{
                ...fm.input,
                borderColor: errors.name ? "#ef4444" : "#e5e7eb",
              }}
            />
          </Field>

          <Field label="Description"
            hint="Help buyers understand your product">
            <textarea
              value={form.description}
              onChange={set("description")}
              placeholder="Describe your product..."
              rows={4}
              style={{ ...fm.input, resize:"vertical",
                minHeight:"90px" }}
            />
          </Field>

          <div style={pm.twoCol}>
            <Field label="Price (₦) *" error={errors.price}>
              <input
                type="number"
                value={form.price}
                onChange={set("price")}
                placeholder="0.00"
                min="0"
                step="0.01"
                style={{
                  ...fm.input,
                  borderColor: errors.price ? "#ef4444" : "#e5e7eb",
                }}
              />
            </Field>
            <Field label="Stock Qty *" error={errors.stock}>
              <input
                type="number"
                value={form.stock}
                onChange={set("stock")}
                placeholder="0"
                min="0"
                style={{
                  ...fm.input,
                  borderColor: errors.stock ? "#ef4444" : "#e5e7eb",
                }}
              />
            </Field>
          </div>

          <div style={pm.twoCol}>
            <Field label="Category">
              <select
                value={form.category}
                onChange={set("category")}
                style={{ ...fm.input, cursor:"pointer" }}
              >
                <option value="">Select category</option>
                {[
                  "Fashion","Electronics","Food & Beverages",
                  "Health & Beauty","Home & Living","Sports",
                  "Books & Media","Agriculture","Services","Other",
                ].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="SKU"
              hint="Your internal product code">
              <input
                value={form.sku}
                onChange={set("sku")}
                placeholder="e.g. SKU-001"
                style={fm.input}
              />
            </Field>
          </div>

          <Field label="Status">
            <select
              value={form.status}
              onChange={set("status")}
              style={{ ...fm.input, cursor:"pointer" }}
            >
              <option value="active">Active — visible to buyers</option>
              <option value="inactive">Inactive — hidden</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </Field>

          {msg && (
            <div style={{
              padding:      "0.75rem 1rem",
              borderRadius: "10px",
              background:   msg.type === "success"
                ? "#ecfdf5" : "#fef2f2",
              color:        msg.type === "success"
                ? "#065f46" : "#991b1b",
              border:       `1px solid ${
                msg.type === "success" ? "#a7f3d0" : "#fecaca"
              }`,
              fontSize:     "0.875rem",
              fontWeight:   500,
            }}>
              {msg.type === "success" ? "✅" : "⚠️"} {msg.text}
            </div>
          )}

          <div style={{ display:"flex", gap:"0.75rem",
            marginTop:"0.25rem" }}>
            <button onClick={onClose} style={pm.cancelBtn}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ ...pm.saveBtn,
                opacity: saving ? 0.7 : 1 }}
            >
              {saving
                ? "Saving…"
                : isEdit ? "Save Changes" : "Add Product"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

// ── Delete confirm modal ───────────────────────────────────────
const DeleteModal = ({ product, onClose, onDeleted }) => {
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const { data } = await sellerApi.delete(
        `/api/seller/products/${product.id}`
      );
      if (data.success) {
        onDeleted?.();
        onClose();
      } else {
        setError(data.message ?? "Delete failed");
      }
    } catch (err) {
      setError(err.response?.data?.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={pm.overlay} onClick={onClose}>
      <div
        style={{ ...pm.modal, maxWidth:"380px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={pm.body}>
          <div style={{ textAlign:"center", padding:"0.5rem 0 1rem" }}>
            <span style={{ fontSize:"3rem" }}>🗑️</span>
            <h3 style={{ fontWeight:800, color:"#1f2937",
              margin:"0.75rem 0 0.4rem" }}>
              Delete Product?
            </h3>
            <p style={{ color:"#6b7280", fontSize:"0.875rem",
              margin:0 }}>
              "<strong>{product.name ?? product.title}</strong>"
              will be permanently removed. This cannot be undone.
            </p>
          </div>

          {error && (
            <div style={{ background:"#fef2f2",
              border:"1px solid #fecaca", borderRadius:"10px",
              padding:"0.75rem 1rem", color:"#991b1b",
              fontSize:"0.85rem" }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display:"flex", gap:"0.75rem" }}>
            <button onClick={onClose} style={pm.cancelBtn}>
              Keep Product
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                ...pm.saveBtn,
                background: "#ef4444",
                opacity:    deleting ? 0.7 : 1,
                flex:       1,
              }}
            >
              {deleting
                ? <span style={{ display:"flex",
                    alignItems:"center", gap:"0.5rem",
                    justifyContent:"center" }}>
                    <Spin size={16} /> Deleting…
                  </span>
                : "Yes, Delete"
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Skeleton card ──────────────────────────────────────────────
const SkeletonCard = () => (
  <div style={{
    background:   "white",
    borderRadius: "16px",
    border:       "1px solid #f3f4f6",
    overflow:     "hidden",
  }}>
    <div style={{
      height:           "160px",
      background:       "linear-gradient(90deg,#f3f4f6 25%,#e9eaf0 50%,#f3f4f6 75%)",
      backgroundSize:   "400px 100%",
      animation:        "sdShimmer 1.4s infinite",
    }} />
    <div style={{ padding:"0.875rem" }}>
      {[80, 55, 100].map((w, i) => (
        <div key={i} style={{
          height:         "12px",
          width:          `${w}%`,
          background:     "linear-gradient(90deg,#f3f4f6 25%,#e9eaf0 50%,#f3f4f6 75%)",
          backgroundSize: "400px 100%",
          animation:      "sdShimmer 1.4s infinite",
          borderRadius:   "100px",
          marginBottom:   i < 2 ? "8px" : 0,
        }} />
      ))}
    </div>
  </div>
);

// ── Stock badge ────────────────────────────────────────────────
const StockBadge = ({ stock }) => {
  const n = Number(stock ?? 0);
  const cfg = n <= 0
    ? { bg:"#fef2f2", color:"#991b1b", text:"Out of stock" }
    : n <= 5
      ? { bg:"#fffbeb", color:"#92400e", text:`Low — ${n} left` }
      : n <= 20
        ? { bg:"#fff7ed", color:"#c2410c", text:`${n} in stock` }
        : { bg:"#ecfdf5", color:"#065f46", text:`${n} in stock` };

  return (
    <span style={{
      padding:      "0.2rem 0.55rem",
      borderRadius: "100px",
      fontSize:     "0.68rem",
      fontWeight:   700,
      background:   cfg.bg,
      color:        cfg.color,
    }}>
      {cfg.text}
    </span>
  );
};

// ── Status chip ────────────────────────────────────────────────
const StatusChip = ({ status }) => {
  const cfg = {
    active:       { bg:"#ecfdf5", color:"#065f46", label:"Active"       },
    inactive:     { bg:"#f9fafb", color:"#6b7280", label:"Inactive"     },
    out_of_stock: { bg:"#fef2f2", color:"#991b1b", label:"Out of Stock" },
  }[status] ?? { bg:"#f3f4f6", color:"#6b7280", label: status };

  return (
    <span style={{
      padding:      "0.15rem 0.5rem",
      borderRadius: "100px",
      fontSize:     "0.65rem",
      fontWeight:   700,
      background:   cfg.bg,
      color:        cfg.color,
    }}>
      {cfg.label}
    </span>
  );
};

// ═════════════════════════════════════════════════════════════
// MAIN PRODUCTS PAGE
// ═════════════════════════════════════════════════════════════
export default function Products() {
  const { vendor } = useDashboard();

  const [products,    setProducts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [filter,      setFilter]      = useState("");
  const [page,        setPage]        = useState(1);
  const [pagination,  setPagination]  = useState(null);
  const [showAdd,     setShowAdd]     = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [deleteTarget,setDeleteTarget]= useState(null);
  const [refreshing,  setRefreshing]  = useState(false);

  const LIMIT = 12;

  // GET /api/seller/products
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (filter) params.status = filter;
      if (search) params.search = search;
      const { data } = await sellerApi.get(
        "/api/seller/products", params
      );
      if (data.success) {
        setProducts(data.products ?? []);
        setPagination(data.pagination ?? null);
      }
    } catch (err) {
      console.error("[Products load]", err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filter, search]);

  useEffect(() => { load(); }, [load]);

  // Reset page on filter/search change
  useEffect(() => { setPage(1); }, [filter, search]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const FILTERS = [
    { key: "",            label: "All"         },
    { key: "active",      label: "Active"      },
    { key: "inactive",    label: "Inactive"    },
    { key: "out_of_stock",label: "Out of Stock"},
  ];

  return (
    <div style={pg.root}>

      {/* ── Header ─────────────────────────────────────── */}
      <div style={pg.header}>
        <div>
          <h2 style={pg.pageTitle}>🏷️ Products</h2>
          <p style={pg.pageSub}>
            {pagination?.total ?? products.length} products in your store
          </p>
        </div>
        <div style={{ display:"flex", gap:"0.6rem" }}>
          <button
            onClick={refresh}
            disabled={refreshing}
            style={pg.iconBtn}
            title="Refresh"
          >
            <span style={{ display:"inline-block",
              animation: refreshing
                ? "spin 0.7s linear infinite" : "none" }}>
              ↻
            </span>
          </button>
          <button
            onClick={() => { setEditProduct(null); setShowAdd(true); }}
            style={pg.addBtn}
          >
            ➕ Add Product
          </button>
        </div>
      </div>

      {/* ── Search + filter bar ─────────────────────────── */}
      <div style={pg.filterBar}>
        <div style={{ position:"relative", flex:1,
          minWidth:"180px" }}>
          <span style={pg.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={pg.searchInput}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={pg.clearSearch}
            >
              ✕
            </button>
          )}
        </div>
        <div style={{ display:"flex", gap:"0.35rem",
          flexWrap:"wrap" }}>
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                ...pg.filterTab,
                background:  filter === key ? "#6366f1" : "white",
                color:       filter === key ? "white"   : "#6b7280",
                borderColor: filter === key ? "#6366f1" : "#e5e7eb",
                fontWeight:  filter === key ? 700 : 500,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Product grid ───────────────────────────────── */}
      {loading ? (
        <div style={pg.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div style={pg.emptyWrap}>
          <span style={{ fontSize:"3rem" }}>🏷️</span>
          <h3 style={{ fontWeight:700, color:"#374151",
            margin:"0.75rem 0 0" }}>
            {search || filter ? "No products found" : "No products yet"}
          </h3>
          <p style={{ color:"#9ca3af", fontSize:"0.875rem",
            margin:"0.3rem 0 1.25rem" }}>
            {search || filter
              ? "Try different search or filter"
              : "Add your first product to start selling"}
          </p>
          {!search && !filter && (
            <button
              onClick={() => setShowAdd(true)}
              style={pg.addBtn}
            >
              ➕ Add Your First Product
            </button>
          )}
        </div>
      ) : (
        <div style={pg.grid}>
          {products.map((p) => (
            <div key={p.id} style={pg.productCard}>

              {/* Product image */}
              <div style={pg.imgWrap}>
                {p.image_url || p.images?.[0] ? (
                  <img
                    src={p.image_url ?? p.images[0]}
                    alt={p.name ?? p.title}
                    style={{ width:"100%", height:"100%",
                      objectFit:"cover" }}
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                ) : (
                  <span style={{ fontSize:"2.5rem" }}>📦</span>
                )}

                {/* Status chip overlay */}
                <div style={{ position:"absolute",
                  top:"8px", right:"8px" }}>
                  <StatusChip status={p.status} />
                </div>
              </div>

              {/* Product info */}
              <div style={pg.cardBody}>
                <p style={pg.productName} title={p.name ?? p.title}>
                  {p.name ?? p.title}
                </p>
                {p.category && (
                  <p style={pg.productCat}>{p.category}</p>
                )}
                <div style={{ display:"flex",
                  justifyContent:"space-between",
                  alignItems:"center",
                  marginTop:"0.5rem" }}>
                  <span style={{ fontWeight:800,
                    color:"#1f2937", fontSize:"1.05rem" }}>
                    {fmt(p.price)}
                  </span>
                  <StockBadge
                    stock={p.stock ?? p.quantity ?? 0}
                  />
                </div>

                {/* SKU */}
                {p.sku && (
                  <p style={{ color:"#9ca3af", fontSize:"0.68rem",
                    margin:"0.35rem 0 0",
                    fontFamily:"monospace" }}>
                    SKU: {p.sku}
                  </p>
                )}

                {/* Actions */}
                <div style={pg.cardActions}>
                  <button
                    onClick={() => {
                      setEditProduct(p);
                      setShowAdd(true);
                    }}
                    style={pg.editBtn}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(p)}
                    style={pg.deleteBtn}
                  >
                    🗑️
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────── */}
      {pagination?.total_pages > 1 && (
        <div style={pg.pagBar}>
          <p style={{ fontSize:"0.78rem", color:"#9ca3af",
            margin:0 }}>
            Page {pagination.page} of {pagination.total_pages} ·{" "}
            {pagination.total} products
          </p>
          <div style={{ display:"flex", gap:"0.4rem",
            flexWrap:"wrap" }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ ...pg.pageBtn,
                opacity: page === 1 ? 0.4 : 1 }}
            >
              ← Prev
            </button>
            {Array.from(
              { length: Math.min(pagination.total_pages, 5) },
              (_, i) => {
                const tp = pagination.total_pages;
                let p2;
                if (tp <= 5) p2 = i + 1;
                else if (page <= 3) p2 = i + 1;
                else if (page >= tp - 2) p2 = tp - 4 + i;
                else p2 = page - 2 + i;
                return (
                  <button
                    key={p2}
                    onClick={() => setPage(p2)}
                    style={{
                      ...pg.pageBtn,
                      background:  page === p2 ? "#6366f1" : "white",
                      color:       page === p2 ? "white"   : "#374151",
                      borderColor: page === p2 ? "#6366f1" : "#e5e7eb",
                      fontWeight:  page === p2 ? 700 : 500,
                      minWidth:    "36px",
                    }}
                  >
                    {p2}
                  </button>
                );
              }
            )}
            <button
              onClick={() =>
                setPage((p) =>
                  Math.min(pagination.total_pages, p + 1)
                )
              }
              disabled={page === pagination.total_pages}
              style={{
                ...pg.pageBtn,
                opacity: page === pagination.total_pages ? 0.4 : 1,
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────── */}
      {showAdd && (
        <ProductModal
          product={editProduct}
          onClose={() => { setShowAdd(false); setEditProduct(null); }}
          onSaved={load}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          product={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={load}
        />
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const fm = {
  label: {
    display:      "block",
    fontSize:     "0.8rem",
    fontWeight:   600,
    color:        "#374151",
    marginBottom: "0.35rem",
  },
  input: {
    width:        "100%",
    padding:      "0.7rem 0.875rem",
    border:       "1px solid #e5e7eb",
    borderRadius: "10px",
    fontSize:     "0.875rem",
    color:        "#374151",
    boxSizing:    "border-box",
    background:   "white",
    fontFamily:   "inherit",
    transition:   "border-color 0.15s",
  },
};

const pm = {
  overlay: {
    position:       "fixed",
    inset:          0,
    background:     "rgba(0,0,0,0.5)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    zIndex:         1000,
    padding:        "1rem",
    backdropFilter: "blur(4px)",
  },
  modal: {
    background:   "white",
    borderRadius: "20px",
    width:        "100%",
    maxWidth:     "520px",
    maxHeight:    "92vh",
    overflowY:    "auto",
    boxShadow:    "0 20px 60px rgba(0,0,0,0.18)",
  },
  header: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "1.25rem 1.5rem",
    borderBottom:   "1px solid #f3f4f6",
    position:       "sticky",
    top:            0,
    background:     "white",
    zIndex:         1,
    borderRadius:   "20px 20px 0 0",
  },
  title:    { fontWeight:800, color:"#1f2937", margin:0,
    fontSize:"1.05rem" },
  closeBtn: { background:"none", border:"none",
    cursor:"pointer", fontSize:"1.1rem",
    color:"#9ca3af", padding:"0.25rem",
    lineHeight:1 },
  body: {
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.1rem",
  },
  twoCol: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 "1rem",
  },
  cancelBtn: {
    flex:         1,
    padding:      "0.8rem",
    background:   "white",
    border:       "1px solid #e5e7eb",
    borderRadius: "12px",
    fontWeight:   600,
    cursor:       "pointer",
    color:        "#374151",
    fontSize:     "0.9rem",
    fontFamily:   "inherit",
  },
  saveBtn: {
    flex:         2,
    padding:      "0.8rem",
    background:   "linear-gradient(135deg,#6366f1,#8b5cf6)",
    color:        "white",
    border:       "none",
    borderRadius: "12px",
    fontWeight:   700,
    cursor:       "pointer",
    fontSize:     "0.9rem",
    fontFamily:   "inherit",
    transition:   "opacity 0.15s",
  },
};

const pg = {
  root: {
    display:       "flex",
    flexDirection: "column",
    gap:           "1.25rem",
  },
  header: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "flex-start",
    flexWrap:       "wrap",
    gap:            "0.75rem",
  },
  pageTitle: {
    fontWeight: 800,
    fontSize:   "1.35rem",
    color:      "#1f2937",
    margin:     0,
  },
  pageSub: {
    color:    "#9ca3af",
    fontSize: "0.85rem",
    margin:   "0.2rem 0 0",
  },
  iconBtn: {
    background:   "white",
    border:       "1px solid #e5e7eb",
    borderRadius: "10px",
    padding:      "0.6rem 0.875rem",
    cursor:       "pointer",
    fontSize:     "1rem",
    color:        "#6b7280",
  },
  addBtn: {
    padding:      "0.7rem 1.4rem",
    background:   "linear-gradient(135deg,#6366f1,#8b5cf6)",
    color:        "white",
    border:       "none",
    borderRadius: "12px",
    fontWeight:   700,
    cursor:       "pointer",
    fontSize:     "0.9rem",
    whiteSpace:   "nowrap",
    fontFamily:   "inherit",
  },
  filterBar: {
    display:   "flex",
    gap:       "0.75rem",
    flexWrap:  "wrap",
    alignItems:"center",
  },
  searchIcon: {
    position:  "absolute",
    left:      "0.875rem",
    top:       "50%",
    transform: "translateY(-50%)",
    fontSize:  "0.9rem",
    color:     "#9ca3af",
    pointerEvents:"none",
  },
  searchInput: {
    width:        "100%",
    padding:      "0.65rem 2.25rem 0.65rem 2.25rem",
    border:       "1px solid #e5e7eb",
    borderRadius: "10px",
    fontSize:     "0.875rem",
    background:   "white",
    color:        "#374151",
    boxSizing:    "border-box",
    fontFamily:   "inherit",
  },
  clearSearch: {
    position:   "absolute",
    right:      "0.75rem",
    top:        "50%",
    transform:  "translateY(-50%)",
    background: "none",
    border:     "none",
    cursor:     "pointer",
    color:      "#9ca3af",
    fontSize:   "0.85rem",
    padding:    "0.2rem",
    lineHeight: 1,
  },
  filterTab: {
    padding:      "0.38rem 0.875rem",
    borderRadius: "100px",
    border:       "1px solid",
    cursor:       "pointer",
    fontSize:     "0.78rem",
    whiteSpace:   "nowrap",
    transition:   "all 0.15s",
    fontFamily:   "inherit",
  },
  grid: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))",
    gap:                 "1rem",
  },
  emptyWrap: {
    background:    "white",
    borderRadius:  "16px",
    border:        "1px solid #f3f4f6",
    padding:       "4rem 2rem",
    textAlign:     "center",
    display:       "flex",
    flexDirection: "column",
    alignItems:    "center",
  },
  productCard: {
    background:   "white",
    borderRadius: "16px",
    border:       "1px solid #f3f4f6",
    overflow:     "hidden",
    boxShadow:    "0 1px 4px rgba(0,0,0,0.04)",
    transition:   "box-shadow 0.2s, transform 0.2s",
  },
  imgWrap: {
    height:         "160px",
    background:     "#f8fafc",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    position:       "relative",
    overflow:       "hidden",
  },
  cardBody:    { padding:"0.875rem" },
  productName: {
    fontWeight:   700,
    color:        "#1f2937",
    margin:       0,
    fontSize:     "0.875rem",
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
  },
  productCat: {
    color:    "#9ca3af",
    fontSize: "0.72rem",
    margin:   "0.2rem 0 0",
  },
  cardActions: {
    display:   "flex",
    gap:       "0.5rem",
    marginTop: "0.875rem",
  },
  editBtn: {
    flex:         1,
    padding:      "0.5rem",
    background:   "#eff6ff",
    border:       "1px solid #bfdbfe",
    borderRadius: "8px",
    color:        "#1e40af",
    cursor:       "pointer",
    fontWeight:   600,
    fontSize:     "0.78rem",
    fontFamily:   "inherit",
  },
  deleteBtn: {
    padding:      "0.5rem 0.65rem",
    background:   "#fef2f2",
    border:       "1px solid #fecaca",
    borderRadius: "8px",
    color:        "#ef4444",
    cursor:       "pointer",
    fontWeight:   600,
    fontSize:     "0.875rem",
    fontFamily:   "inherit",
  },
  pagBar: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    flexWrap:       "wrap",
    gap:            "0.75rem",
    background:     "white",
    borderRadius:   "12px",
    padding:        "0.875rem 1.25rem",
    border:         "1px solid #f3f4f6",
  },
  pageBtn: {
    padding:      "0.4rem 0.75rem",
    border:       "1px solid #e5e7eb",
    borderRadius: "8px",
    background:   "white",
    cursor:       "pointer",
    fontSize:     "0.78rem",
    color:        "#374151",
    fontWeight:   500,
    transition:   "all 0.15s",
    fontFamily:   "inherit",
  },
};
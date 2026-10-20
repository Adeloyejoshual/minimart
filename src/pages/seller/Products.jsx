import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useNavigate } from "react-router-dom";
import { sellerApi } from "./SellerDashboard";

const API = "/api/seller/products";

const FILTERS = [
  ["", "All"],
  ["pending", "Pending"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["paused", "Paused"],
];

function money(v) {
  return "₦" + Number(v || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function cover(p) {
  if (p.images?.length) {
    const m = p.images.find((i) => i.is_primary) || p.images[0];
    return m?.url || m?.image_url || "";
  }
  return p.image_url || "";
}

function stock(p) {
  if (p.variants?.length)
    return p.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  return Number(p.stock || p.quantity || 0);
}

function statusText(p) {
  if (p.is_paused) return "Paused";
  return (p.status || "—").replace(/^\w/, (c) => c.toUpperCase());
}

function stockText(n) {
  if (n <= 0) return "Out of stock";
  if (n <= 5) return n + " left";
  return n + " in stock";
}

function pages(cur, total) {
  const count = Math.min(total, 5);
  let s = total <= 5 ? 1 : cur <= 3 ? 1 : cur >= total - 2 ? total - 4 : cur - 2;
  if (s < 1) s = 1;
  return Array.from({ length: count }, (_, i) => s + i);
}

function Img({ src, alt, w, h }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <div style={{ width: w, height: h, background: "#eee" }} />;
  return <img src={src} alt={alt} width={w} height={h} loading="lazy" decoding="async" onError={() => setBad(true)} style={{ objectFit: "cover" }} />;
}

const Card = memo(function Card({ p, onEdit, onDel, onPause }) {
  const n = stock(p);
  const canPause = p.status === "approved" || p.status === "active";
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 6, overflow: "hidden", background: "#fff" }}>
      <Img src={cover(p)} alt={p.name} w="100%" h={140} />
      <div style={{ padding: 8 }}>
        <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 500 }}>{p.name}</p>
        {p.category && <p style={{ margin: "0 0 4px", fontSize: 11, color: "#999" }}>{p.category}</p>}
        <p style={{ margin: "0 0 4px", fontSize: 13 }}>
          <strong>{money(p.price)}</strong> — {stockText(n)}
        </p>
        <p style={{ margin: "0 0 8px", fontSize: 11, color: "#888" }}>{statusText(p)}</p>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => onEdit(p)}>Edit</button>
          {canPause && <button onClick={() => onPause(p)}>{p.is_paused ? "Resume" : "Pause"}</button>}
          <button onClick={() => onDel(p)}>Delete</button>
        </div>
      </div>
    </div>
  );
});

const Row = memo(function Row({ p, onEdit, onDel, onPause }) {
  const n = stock(p);
  const canPause = p.status === "approved" || p.status === "active";
  return (
    <tr>
      <td style={{ display: "flex", alignItems: "center", gap: 8, padding: 6 }}>
        <Img src={cover(p)} alt={p.name} w={36} h={36} />
        <span style={{ fontSize: 13 }}>{p.name}</span>
      </td>
      <td style={{ fontSize: 13 }}>{money(p.price)}</td>
      <td style={{ fontSize: 12 }}>{stockText(n)}</td>
      <td style={{ fontSize: 12 }}>{statusText(p)}</td>
      <td>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => onEdit(p)}>Edit</button>
          {canPause && <button onClick={() => onPause(p)}>{p.is_paused ? "▶" : "⏸"}</button>}
          <button onClick={() => onDel(p)}>✕</button>
        </div>
      </td>
    </tr>
  );
});

export default function Products() {
  const nav = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [qReal, setQReal] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pag, setPag] = useState(null);
  const [view, setView] = useState("grid");
  const [delItem, setDelItem] = useState(null);
  const [pauseItem, setPauseItem] = useState(null);
  const [err, setErr] = useState("");

  const [mobile, setMobile] = useState(false);
  const abort = useRef(null);

  useEffect(() => {
    const c = () => setMobile(window.innerWidth < 640);
    c();
    window.addEventListener("resize", c, { passive: true });
    return () => window.removeEventListener("resize", c);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setQReal(q.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setLoading(true);
    setErr("");
    try {
      const { data } = await sellerApi.get(API, {
        params: {
          page, limit: 12,
          ...(filter && { status: filter }),
          ...(qReal && { search: qReal }),
        },
        signal: ctrl.signal,
      });
      if (data.success) {
        setItems(data.products || data.data?.products || []);
        setPag(data.pagination || data.data?.pagination || null);
      } else {
        setErr(data.message || "Failed");
      }
    } catch (e) {
      if (e.name === "CanceledError" || e.code === "ERR_CANCELED") return;
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, filter, qReal]);

  useEffect(() => { load(); return () => abort.current?.abort(); }, [load]);

  const onEdit = (p) => nav("/minimart/edit-ad/" + p.id);

  const doDelete = async () => {
    if (!delItem) return;
    try {
      const { data } = await sellerApi.delete(API + "/" + delItem.id);
      if (data.success) { setDelItem(null); load(); }
    } catch { /* */ }
  };

  const doPause = async () => {
    if (!pauseItem) return;
    try {
      const { data } = await sellerApi.patch(API + "/" + pauseItem.id + "/pause");
      if (data.success) { setPauseItem(null); load(); }
    } catch { /* */ }
  };

  const tp = pag?.totalPages || 0;
  const grid = mobile || view === "grid";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Listings</h2>
          <small style={{ color: "#888" }}>{pag?.total || items.length} products</small>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
          {!mobile && (
            <>
              <button onClick={() => setView("grid")} disabled={view === "grid"}>Grid</button>
              <button onClick={() => setView("list")} disabled={view === "list"}>List</button>
            </>
          )}
          <button onClick={() => nav("/minimart/post-ad")}>+ New</button>
        </div>
      </div>

      {err && <p style={{ color: "red", fontSize: 13 }}>{err} <button onClick={load}>Retry</button></p>}

      <input
        placeholder="Search…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ width: "100%", padding: 8, marginBottom: 8, fontSize: 13, boxSizing: "border-box" }}
      />

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => { setFilter(k); setPage(1); }}
            style={{ fontWeight: filter === k ? 700 : 400 }}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, border: "1px solid #ddd", borderRadius: 6 }}>
          <p>{q || filter ? "No products found." : "No listings yet."}</p>
          <button onClick={() => nav("/minimart/post-ad")}>+ Post product</button>
        </div>
      ) : grid ? (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: mobile ? "repeat(2,1fr)" : "repeat(4,1fr)" }}>
          {items.map((p) => (
            <Card key={p.id} p={p} onEdit={onEdit} onDel={setDelItem} onPause={setPauseItem} />
          ))}
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
              <th>Product</th><th>Price</th><th>Stock</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <Row key={p.id} p={p} onEdit={onEdit} onDel={setDelItem} onPause={setPauseItem} />
            ))}
          </tbody>
        </table>
      )}

      {tp > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 12 }}>
          <span>Page {pag.page} of {tp}</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</button>
            {pages(page, tp).map((n) => (
              <button key={n} onClick={() => setPage(n)} style={{ fontWeight: page === n ? 700 : 400 }}>{n}</button>
            ))}
            <button disabled={page === tp} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}

      {delItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setDelItem(null)}>
          <div style={{ background: "#fff", padding: 20, borderRadius: 8, maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 8px" }}>Delete "{delItem.name}"?</h3>
            <p style={{ fontSize: 13, color: "#555" }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDelItem(null)}>Cancel</button>
              <button onClick={doDelete} style={{ color: "red" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {pauseItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setPauseItem(null)}>
          <div style={{ background: "#fff", padding: 20, borderRadius: 8, maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 8px" }}>{pauseItem.is_paused ? "Resume" : "Pause"} "{pauseItem.name}"?</h3>
            <p style={{ fontSize: 13, color: "#555" }}>{pauseItem.is_paused ? "Show to buyers again?" : "Hide from buyers?"}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setPauseItem(null)}>Cancel</button>
              <button onClick={doPause}>{pauseItem.is_paused ? "Resume" : "Pause"}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
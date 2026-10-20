import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useNavigate } from "react-router-dom";
import { sellerApi } from "./SellerDashboard";
import "./Products.css";

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

function Img({ src, alt, className, w, h }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <div className={className} style={{ width: w, height: h, background: "#eee" }} />;
  return <img className={className} src={src} alt={alt} width={w} height={h} loading="lazy" decoding="async" onError={() => setBad(true)} />;
}

const Card = memo(function Card({ p, onEdit, onDel, onPause }) {
  const n = stock(p);
  const canPause = p.status === "approved" || p.status === "active";
  return (
    <div className="sp-card">
      <Img src={cover(p)} alt={p.name} className="sp-card-img" />
      <div className="sp-card-body">
        <p className="sp-card-name">{p.name}</p>
        {p.category && <p className="sp-card-cat">{p.category}</p>}
        <p className="sp-card-info"><strong>{money(p.price)}</strong> · {stockText(n)}</p>
        <p className="sp-card-status">{statusText(p)}</p>
        <div className="sp-card-btns">
          <button className="sp-btn" onClick={() => onEdit(p)}>Edit</button>
          {canPause && <button className="sp-btn" onClick={() => onPause(p)}>{p.is_paused ? "Resume" : "Pause"}</button>}
          <button className="sp-btn sp-btn-red" onClick={() => onDel(p)}>Delete</button>
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
      <td>
        <Img src={cover(p)} alt={p.name} className="sp-thumb" w={36} h={36} />
        {p.name}
      </td>
      <td>{money(p.price)}</td>
      <td>{stockText(n)}</td>
      <td>{statusText(p)}</td>
      <td>
        <div style={{ display: "flex", gap: 4 }}>
          <button className="sp-btn" onClick={() => onEdit(p)}>Edit</button>
          {canPause && <button className="sp-btn" onClick={() => onPause(p)}>{p.is_paused ? "▶" : "⏸"}</button>}
          <button className="sp-btn sp-btn-red" onClick={() => onDel(p)}>✕</button>
        </div>
      </td>
    </tr>
  );
});

function Modal({ title, onClose, children }) {
  useEffect(() => {
    document.body.classList.add("sp-lock");
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      document.body.classList.remove("sp-lock");
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  return (
    <div className="sp-overlay" onClick={onClose}>
      <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

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
    <div className="sp-page">

      <div className="sp-top">
        <div>
          <h2>Listings</h2>
          <small>{pag?.total || items.length} products</small>
        </div>
        <div className="sp-btns">
          <button className="sp-btn" onClick={load} disabled={loading}>
            {loading ? <span className="sp-spin" /> : "Refresh"}
          </button>
          {!mobile && (
            <>
              <button className={`sp-btn ${view === "grid" ? "sp-btn-dark" : ""}`} onClick={() => setView("grid")}>Grid</button>
              <button className={`sp-btn ${view === "list" ? "sp-btn-dark" : ""}`} onClick={() => setView("list")}>List</button>
            </>
          )}
          <button className="sp-btn sp-btn-dark" onClick={() => nav("/minimart/post-ad")}>+ New</button>
        </div>
      </div>

      {err && <p className="sp-error">{err} — <button className="sp-btn" onClick={load}>Retry</button></p>}

      <input className="sp-search" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="sp-pills">
        {FILTERS.map(([k, l]) => (
          <button key={k} className={`sp-pill ${filter === k ? "sp-pill-on" : ""}`} onClick={() => { setFilter(k); setPage(1); }}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="sp-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="sp-card">
              <div className="sp-card-img sp-skel" />
              <div className="sp-card-body">
                <div className="sp-skel" style={{ height: 12, width: "70%", marginBottom: 6 }} />
                <div className="sp-skel" style={{ height: 12, width: "40%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="sp-empty">
          <p>{q || filter ? "No products found." : "No listings yet."}</p>
          <button className="sp-btn sp-btn-dark" onClick={() => nav("/minimart/post-ad")}>+ Post product</button>
        </div>
      ) : grid ? (
        <div className="sp-grid">
          {items.map((p) => (
            <Card key={p.id} p={p} onEdit={onEdit} onDel={setDelItem} onPause={setPauseItem} />
          ))}
        </div>
      ) : (
        <table className="sp-table">
          <thead>
            <tr>
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
        <div className="sp-pag">
          <span>Page {pag.page} of {tp}</span>
          <div className="sp-pag-btns">
            <button className="sp-pag-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</button>
            {pages(page, tp).map((n) => (
              <button key={n} className={`sp-pag-btn ${page === n ? "sp-pag-on" : ""}`} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button className="sp-pag-btn" disabled={page === tp} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}

      {delItem && (
        <Modal title="Delete listing" onClose={() => setDelItem(null)}>
          <p>Remove "<strong>{delItem.name}</strong>"? This cannot be undone.</p>
          <div className="sp-modal-btns">
            <button className="sp-btn" onClick={() => setDelItem(null)}>Cancel</button>
            <button className="sp-btn sp-btn-red" onClick={doDelete}>Delete</button>
          </div>
        </Modal>
      )}

      {pauseItem && (
        <Modal title={pauseItem.is_paused ? "Resume" : "Pause"} onClose={() => setPauseItem(null)}>
          <p>{pauseItem.is_paused ? "Show this listing to buyers again?" : "Hide this listing from buyers?"}</p>
          <div className="sp-modal-btns">
            <button className="sp-btn" onClick={() => setPauseItem(null)}>Cancel</button>
            <button className="sp-btn sp-btn-dark" onClick={doPause}>{pauseItem.is_paused ? "Resume" : "Pause"}</button>
          </div>
        </Modal>
      )}

    </div>
  );
}
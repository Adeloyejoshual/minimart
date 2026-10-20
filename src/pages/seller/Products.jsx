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

const money = (v) =>
  "₦" +
  Number(v || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const cover = (p) => {
  if (p.images?.length) {
    const m = p.images.find((i) => i.is_primary) || p.images[0];
    return m?.url || m?.image_url || "";
  }
  return p.image_url || "";
};

const stock = (p) => {
  if (p.variants?.length)
    return p.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  return Number(p.stock || p.quantity || 0);
};

const statusText = (p) => {
  if (p.is_paused) return "Paused";
  return (p.status || "—").replace(/^\w/, (c) => c.toUpperCase());
};

const stockText = (n) => {
  if (n <= 0) return "Out of stock";
  if (n <= 5) return `${n} left`;
  return `${n} in stock`;
};

const statusClass = (p) => {
  if (p.is_paused) return "pp-badge pp-badge-gray";
  const s = (p.status || "").toLowerCase();
  if (s === "approved" || s === "active") return "pp-badge pp-badge-green";
  if (s === "pending") return "pp-badge pp-badge-yellow";
  if (s === "rejected") return "pp-badge pp-badge-red";
  return "pp-badge pp-badge-gray";
};

const pages = (cur, total) => {
  const count = Math.min(total, 5);
  let s = total <= 5 ? 1 : cur <= 3 ? 1 : cur >= total - 2 ? total - 4 : cur - 2;
  if (s < 1) s = 1;
  return Array.from({ length: count }, (_, i) => s + i);
};

/* ─── Image ─── */
function Img({ src, alt, className }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) {
    return (
      <div className={`${className} pp-img-fallback`}>
        <span>No image</span>
      </div>
    );
  }
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setBad(true)}
    />
  );
}

/* ─── Card ─── */
const Card = memo(function Card({ p, onEdit, onDel, onPause }) {
  const n = stock(p);
  const canPause = p.status === "approved" || p.status === "active";

  return (
    <article className="pp-card">
      <div className="pp-card-media">
        <Img src={cover(p)} alt={p.name} className="pp-card-img" />
        <span className={statusClass(p)}>{statusText(p)}</span>
      </div>

      <div className="pp-card-body">
        <h3 className="pp-card-name" title={p.name}>
          {p.name}
        </h3>

        <div className="pp-card-meta">
          <span className="pp-price">{money(p.price)}</span>
          <span className={`pp-stock ${n <= 0 ? "pp-stock-out" : ""}`}>
            {stockText(n)}
          </span>
        </div>

        <div className="pp-card-actions">
          <button className="pp-btn pp-btn-ghost" onClick={() => onEdit(p)}>
            Edit
          </button>
          {canPause && (
            <button className="pp-btn pp-btn-ghost" onClick={() => onPause(p)}>
              {p.is_paused ? "Resume" : "Pause"}
            </button>
          )}
          <button className="pp-btn pp-btn-danger" onClick={() => onDel(p)}>
            Delete
          </button>
        </div>
      </div>
    </article>
  );
});

/* ─── Row ─── */
const Row = memo(function Row({ p, onEdit, onDel, onPause }) {
  const n = stock(p);
  const canPause = p.status === "approved" || p.status === "active";
  return (
    <tr>
      <td>
        <div className="pp-row-prod">
          <Img src={cover(p)} alt={p.name} className="pp-thumb" />
          <span>{p.name}</span>
        </div>
      </td>
      <td>{money(p.price)}</td>
      <td>{stockText(n)}</td>
      <td>
        <span className={statusClass(p)}>{statusText(p)}</span>
      </td>
      <td>
        <div className="pp-row-actions">
          <button className="pp-btn pp-btn-ghost" onClick={() => onEdit(p)}>
            Edit
          </button>
          {canPause && (
            <button className="pp-btn pp-btn-ghost" onClick={() => onPause(p)}>
              {p.is_paused ? "Resume" : "Pause"}
            </button>
          )}
          <button className="pp-btn pp-btn-danger" onClick={() => onDel(p)}>
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
});

/* ─── Modal ─── */
function Modal({ title, onClose, children }) {
  useEffect(() => {
    document.body.classList.add("pp-lock");
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      document.body.classList.remove("pp-lock");
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  return (
    <div className="pp-overlay" onClick={onClose}>
      <div className="pp-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

/* ─── Main ─── */
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
    const t = setTimeout(() => {
      setQReal(q.trim());
      setPage(1);
    }, 350);
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
          page,
          limit: 12,
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

  useEffect(() => {
    load();
    return () => abort.current?.abort();
  }, [load]);

  const onEdit = (p) => nav("/minimart/edit-ad/" + p.id);

  const doDelete = async () => {
    if (!delItem) return;
    try {
      const { data } = await sellerApi.delete(API + "/" + delItem.id);
      if (data.success) {
        setDelItem(null);
        load();
      }
    } catch {}
  };

  const doPause = async () => {
    if (!pauseItem) return;
    try {
      const { data } = await sellerApi.patch(API + "/" + pauseItem.id + "/pause");
      if (data.success) {
        setPauseItem(null);
        load();
      }
    } catch {}
  };

  const tp = pag?.totalPages || 0;
  const grid = mobile || view === "grid";

  return (
    <div className="pp-page">
      {/* Header */}
      <header className="pp-header">
        <div>
          <h1 className="pp-title">Listings</h1>
          <p className="pp-sub">{pag?.total || items.length} products</p>
        </div>

        <div className="pp-header-actions">
          <button className="pp-btn pp-btn-ghost" onClick={load} disabled={loading}>
            {loading ? <span className="pp-spin" /> : "Refresh"}
          </button>
          {!mobile && (
            <div className="pp-toggle">
              <button
                className={`pp-toggle-btn ${view === "grid" ? "pp-toggle-on" : ""}`}
                onClick={() => setView("grid")}
              >
                Grid
              </button>
              <button
                className={`pp-toggle-btn ${view === "list" ? "pp-toggle-on" : ""}`}
                onClick={() => setView("list")}
              >
                List
              </button>
            </div>
          )}
          <button className="pp-btn pp-btn-primary" onClick={() => nav("/minimart/post-ad")}>
            + New
          </button>
        </div>
      </header>

      {err && (
        <div className="pp-error">
          <span>{err}</span>
          <button className="pp-btn pp-btn-ghost" onClick={load}>Retry</button>
        </div>
      )}

      {/* Search */}
      <input
        className="pp-search"
        placeholder="Search products…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {/* Filters */}
      <div className="pp-pills">
        {FILTERS.map(([k, l]) => (
          <button
            key={k}
            className={`pp-pill ${filter === k ? "pp-pill-on" : ""}`}
            onClick={() => {
              setFilter(k);
              setPage(1);
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="pp-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="pp-card">
              <div className="pp-card-media pp-skel" />
              <div className="pp-card-body">
                <div className="pp-skel pp-skel-line" style={{ width: "70%" }} />
                <div className="pp-skel pp-skel-line" style={{ width: "40%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="pp-empty">
          <p>{q || filter ? "No products found." : "No listings yet."}</p>
          <button className="pp-btn pp-btn-primary" onClick={() => nav("/minimart/post-ad")}>
            + Post product
          </button>
        </div>
      ) : grid ? (
        <div className="pp-grid">
          {items.map((p) => (
            <Card key={p.id} p={p} onEdit={onEdit} onDel={setDelItem} onPause={setPauseItem} />
          ))}
        </div>
      ) : (
        <div className="pp-table-wrap">
          <table className="pp-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <Row key={p.id} p={p} onEdit={onEdit} onDel={setDelItem} onPause={setPauseItem} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {tp > 1 && (
        <div className="pp-pag">
          <span>Page {pag.page} of {tp}</span>
          <div className="pp-pag-btns">
            <button
              className="pp-pag-btn"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Prev
            </button>
            {pages(page, tp).map((n) => (
              <button
                key={n}
                className={`pp-pag-btn ${page === n ? "pp-pag-on" : ""}`}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            <button
              className="pp-pag-btn"
              disabled={page === tp}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {delItem && (
        <Modal title="Delete listing" onClose={() => setDelItem(null)}>
          <p>
            Remove "<strong>{delItem.name}</strong>"? This cannot be undone.
          </p>
          <div className="pp-modal-btns">
            <button className="pp-btn pp-btn-ghost" onClick={() => setDelItem(null)}>
              Cancel
            </button>
            <button className="pp-btn pp-btn-danger" onClick={doDelete}>
              Delete
            </button>
          </div>
        </Modal>
      )}

      {pauseItem && (
        <Modal
          title={pauseItem.is_paused ? "Resume listing" : "Pause listing"}
          onClose={() => setPauseItem(null)}
        >
          <p>
            {pauseItem.is_paused
              ? "Show this listing to buyers again?"
              : "Hide this listing from buyers?"}
          </p>
          <div className="pp-modal-btns">
            <button className="pp-btn pp-btn-ghost" onClick={() => setPauseItem(null)}>
              Cancel
            </button>
            <button className="pp-btn pp-btn-primary" onClick={doPause}>
              {pauseItem.is_paused ? "Resume" : "Pause"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
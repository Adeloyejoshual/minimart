// components/seller/dashboard/Products.jsx
import { formatNGN } from "./Shared";

export const Products = ({ products }) => (
  <div className="sd-card">
    <div className="sd-card-header">
      <h3 className="sd-card-title">🏷️ My Products</h3>
      <a href="/minimart/add" style={s.addBtn}>➕ Add Product</a>
    </div>

    {!products?.length ? (
      <div className="sd-empty">
        <p>No products yet</p>
        <a href="/minimart/add" className="sd-empty-cta">
          ➕ Add Your First Product
        </a>
      </div>
    ) : (
      <div className="sd-product-list">
        {products.map((p, i) => (
          <div key={p.id ?? i} className="sd-product-row">
            <span className="sd-product-rank">#{i + 1}</span>

            {p.image ? (
              <img src={p.image} alt={p.name} className="sd-product-img" />
            ) : (
              <div className="sd-product-img-placeholder">📦</div>
            )}

            <div className="sd-product-info">
              <span className="sd-product-name">{p.name ?? p.title}</span>
              <span className="sd-product-meta">
                {p.total_sold ?? 0} sold ·{" "}
                {formatNGN(p.price)}
              </span>
            </div>

            <div style={{ textAlign: "right" }}>
              <div className="sd-product-revenue">
                {formatNGN(p.revenue)}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>
                revenue
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const s = {
  addBtn: {
    display:         "inline-block",
    padding:         "0.45rem 1rem",
    background:      "#eef2ff",
    color:           "#6366f1",
    borderRadius:    "8px",
    textDecoration:  "none",
    fontWeight:      600,
    fontSize:        "0.85rem",
  },
};
import { fmt, fmtN, fmtDate } from "../adminlayout/helpers";
import { Pill, Card, Rfr, Srch } from "../adminlayout/atoms";

export default function Products({
  displayedProds, products, pending,
  productTab, setProductTab,
  productQ, setProductQ,
  approveProduct, rejectProduct,
  busy, reloadProducts, confirm,
}) {
  const tabs = (
    <div className="tabs">
      {[
        { id: "all",     label: `All (${products.length})` },
        { id: "pending", label: `Pending (${pending.length})` },
      ].map((t) => (
        <button
          key={t.id}
          className={`tab ${productTab === t.id ? "active" : ""}`}
          onClick={() => setProductTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  const colCount = productTab === "pending" ? 9 : 8;

  return (
    <>
      <div className="ph">
        <div className="ph-left"><h1>Products</h1></div>
        <div className="ph-right">
          <Srch value={productQ} onChange={setProductQ} placeholder="Search product or seller…" />
          <Rfr onClick={reloadProducts} />
        </div>
      </div>

      <Card tabs={tabs} title={`${displayedProds.length} results`}>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Product</th><th>Seller</th><th>Price</th><th>Category</th>
                <th>Location</th><th>Status</th><th>Promoted</th><th>Created</th>
                {productTab === "pending" && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {displayedProds.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 700, maxWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      {p.thumbnail_url && (
                        <img className="thumb" src={p.thumbnail_url} alt="" />
                      )}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.name || p.title}
                      </span>
                    </div>
                  </td>
                  <td style={{ color: "var(--accent)", fontSize: ".75rem" }}>{p.seller_name || "—"}</td>
                  <td className="mono" style={{ color: "var(--green)" }}>{fmtN(p.price)}</td>
                  <td className="dim"  style={{ fontSize: ".72rem" }}>{p.category_name || "—"}</td>
                  <td style={{ fontSize: ".72rem" }}>
                    {[p.location_city, p.location_state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td><Pill s={p.status} /></td>
                  <td>
                    {p.is_promoted
                      ? <span className="pill pc">Boosted</span>
                      : <span className="dim">—</span>
                    }
                  </td>
                  <td className="mono dim" style={{ fontSize: ".68rem" }}>{fmtDate(p.created_at)}</td>
                  {productTab === "pending" && (
                    <td>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button
                          className="btn b-green"
                          disabled={busy === `ap-${p.id}`}
                          onClick={() =>
                            confirm({
                              title:   "Approve Product?",
                              body:    `Publish "${p.name || p.title}"?`,
                              confirm: "Approve",
                              action:  () => approveProduct(p.id),
                            })
                          }
                        >
                          {busy === `ap-${p.id}` ? "…" : "Approve"}
                        </button>
                        <button
                          className="btn b-red"
                          disabled={busy === `rp-${p.id}`}
                          onClick={() =>
                            confirm({
                              title:   "Reject Product?",
                              body:    `Reject "${p.name || p.title}"?`,
                              danger:  true,
                              confirm: "Reject",
                              action:  () => rejectProduct(p.id),
                            })
                          }
                        >
                          {busy === `rp-${p.id}` ? "…" : "Reject"}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!displayedProds.length && (
                <tr><td colSpan={colCount} className="empty">No products found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
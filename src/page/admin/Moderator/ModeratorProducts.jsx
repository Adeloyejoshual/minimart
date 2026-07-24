// src/page/admin/Moderator/ModeratorProducts.jsx

import { useState, useMemo } from "react";
import { fmt, fmtN, fmtDate } from "../adminlayout/helpers";
import { Pill, Card, Rfr, Srch } from "../adminlayout/atoms";
import toast from "react-hot-toast";

export default function ModeratorProducts({
  displayedProds, products, pending,
  productTab, setProductTab,
  productQ, setProductQ,
  approveProduct, rejectProduct, flagProduct,
  busy, reloadProducts, confirm,
}) {
  const [preview, setPreview] = useState(null);

  const stats = useMemo(() => ({
    total:    products.length,
    pending:  pending.length,
    active:   products.filter((p) => p.status === "active").length,
    rejected: products.filter((p) => p.status === "rejected").length,
    flagged:  products.filter((p) => p.status === "flagged").length,
  }), [products, pending]);

  const handleApprove = (p) => {
    confirm({
      title:   "Approve Product?",
      body:    `Approve "${p.name || p.title}" by ${p.seller_name || "unknown seller"}?`,
      confirm: "Yes, Approve",
      action:  async () => {
        try {
          await approveProduct(p.id);
          toast.success(`"${p.name || p.title}" approved`);
        } catch (err) {
          toast.error(err.message || "Approval failed");
        }
      },
    });
  };

  const handleReject = (p) => {
    const reason = prompt(`Why are you rejecting "${p.name || p.title}"?\n\nThis reason will be sent to the seller.`);
    if (!reason?.trim()) return;

    confirm({
      title:   "Reject Product?",
      body:    `Reject "${p.name || p.title}"?\n\nReason: ${reason}`,
      danger:  true,
      confirm: "Yes, Reject",
      action:  async () => {
        try {
          await rejectProduct(p.id, reason);
          toast.success("Product rejected");
        } catch (err) {
          toast.error(err.message || "Rejection failed");
        }
      },
    });
  };

  const handleFlag = (p) => {
    const reason = prompt(`Why are you flagging "${p.name || p.title}"?\n\nThis will notify senior admins.`);
    if (!reason?.trim()) return;

    confirm({
      title:   "Flag for Review?",
      body:    `Flag "${p.name || p.title}" for senior admin review?\n\nReason: ${reason}`,
      danger:  true,
      confirm: "Yes, Flag",
      action:  async () => {
        try {
          await flagProduct(p.id, reason);
          toast.success("Product flagged for review");
        } catch (err) {
          toast.error(err.message || "Flag failed");
        }
      },
    });
  };

  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>
            Products{" "}
            <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "1rem" }}>
              ({fmt(displayedProds.length)})
            </span>
          </h1>
          <p style={{ color: "var(--muted)", fontSize: ".78rem", marginTop: 4 }}>
            Review, approve or reject product listings
          </p>
        </div>
        <div className="ph-right">
          <Srch value={productQ} onChange={setProductQ} placeholder="Search…" />
          <Rfr onClick={reloadProducts} />
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display             : "grid",
        gridTemplateColumns : "repeat(auto-fit, minmax(140px, 1fr))",
        gap                 : 10,
        marginBottom        : 12,
      }}>
        <StatBox label="Total"    value={fmt(stats.total)}    color="#3b82f6" />
        <StatBox label="Pending"  value={fmt(stats.pending)}  color="#f59e42" />
        <StatBox label="Active"   value={fmt(stats.active)}   color="#22c55e" />
        <StatBox label="Rejected" value={fmt(stats.rejected)} color="#ef4444" />
        <StatBox label="Flagged"  value={fmt(stats.flagged)}  color="#a855f7" />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {[
          { key: "pending", label: `Pending (${pending.length})` },
          { key: "all",     label: `All (${products.length})` },
        ].map((t) => (
          <button
            key={t.key}
            className={`btn ${productTab === t.key ? "b-solid" : "b-ghost"}`}
            style={{ fontSize: ".78rem", padding: "6px 14px" }}
            onClick={() => setProductTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Product</th>
                <th>Seller</th>
                <th>Category</th>
                <th>Price</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedProds.map((p) => (
                <tr key={p.id}>
                  <td style={{ width: 50 }}>
                    {p.image_url || p.image ? (
                      <img
                        src={p.image_url || p.image}
                        alt=""
                        onClick={() => setPreview(p.image_url || p.image)}
                        style={{
                          width        : 40,
                          height       : 40,
                          borderRadius : 6,
                          objectFit    : "cover",
                          cursor       : "pointer",
                          border       : "1px solid var(--border)",
                        }}
                      />
                    ) : (
                      <div style={{
                        width: 40, height: 40, borderRadius: 6,
                        background: "var(--card2)",
                        display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 16,
                        border: "1px solid var(--border)",
                      }}>
                        📦
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 700 }}>
                      {p.name || p.title || "—"}
                    </div>
                    <div className="dim" style={{
                      fontSize: ".65rem", marginTop: 2,
                      maxWidth: 240, overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {p.description || "No description"}
                    </div>
                  </td>
                  <td>{p.seller_name || "—"}</td>
                  <td className="dim" style={{ fontSize: ".72rem" }}>
                    {p.category || "—"}
                  </td>
                  <td className="mono" style={{ color: "var(--green)", fontWeight: 700 }}>
                    {fmtN(p.price)}
                  </td>
                  <td><Pill s={p.status || "pending"} /></td>
                  <td className="mono dim" style={{ fontSize: ".68rem" }}>
                    {fmtDate(p.created_at)}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {p.status === "pending" && (
                        <>
                          <button
                            className="btn b-solid"
                            style={{ fontSize: ".68rem", padding: "2px 8px" }}
                            disabled={busy === `ap-${p.id}`}
                            onClick={() => handleApprove(p)}
                            title="Approve"
                          >
                            {busy === `ap-${p.id}` ? "…" : "✓"}
                          </button>
                          <button
                            className="btn b-red"
                            style={{ fontSize: ".68rem", padding: "2px 8px" }}
                            disabled={busy === `rp-${p.id}`}
                            onClick={() => handleReject(p)}
                            title="Reject"
                          >
                            {busy === `rp-${p.id}` ? "…" : "✗"}
                          </button>
                        </>
                      )}
                      <button
                        className="btn b-ghost"
                        style={{ fontSize: ".68rem", padding: "2px 8px" }}
                        disabled={busy === `fp-${p.id}`}
                        onClick={() => handleFlag(p)}
                        title="Flag for senior admin review"
                      >
                        {busy === `fp-${p.id}` ? "…" : "🚩"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!displayedProds.length && (
                <tr>
                  <td colSpan={8} className="empty">
                    {productTab === "pending"
                      ? "🎉 No pending products. Great work!"
                      : "No products found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Image preview modal */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position       : "fixed",
            inset          : 0,
            background     : "rgba(0,0,0,.85)",
            display        : "flex",
            alignItems     : "center",
            justifyContent : "center",
            zIndex         : 500,
            cursor         : "pointer",
          }}
        >
          <img
            src={preview}
            alt="Preview"
            style={{
              maxWidth  : "90vw",
              maxHeight : "90vh",
              borderRadius: 8,
            }}
          />
        </div>
      )}
    </>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{
      background   : "var(--card)",
      border       : "1px solid var(--border)",
      borderRadius : 10,
      padding      : "12px 14px",
    }}>
      <div style={{
        fontSize      : ".65rem",
        color         : "var(--muted)",
        textTransform : "uppercase",
        fontWeight    : 700,
      }}>
        {label}
      </div>
      <div style={{
        fontSize   : "1.3rem",
        fontWeight : 800,
        color,
        marginTop  : 4,
      }}>
        {value}
      </div>
    </div>
  );
}
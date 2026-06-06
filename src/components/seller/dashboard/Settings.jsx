// components/seller/dashboard/Settings.jsx
import { StatusBadge, formatNGN } from "./Shared";

export const Settings = ({ vendor }) => {
  const rows = [
    { label: "Store Name",     value: vendor?.store_name              },
    { label: "Category",       value: vendor?.store_category          },
    { label: "Status",         value: <StatusBadge status={vendor?.status} /> },
    { label: "Rating",         value: `⭐ ${vendor?.rating ?? "0.00"}` },
    { label: "Trust Score",    value: vendor?.trust_score ?? 0        },
    { label: "Products",       value: vendor?.products_count ?? 0     },
    { label: "Total Sales",    value: formatNGN(vendor?.total_sales)  },
    { label: "Total Revenue",  value: formatNGN(vendor?.total_revenue) },
    { label: "Member Since",   value: vendor?.created_at
        ? new Date(vendor.created_at).toLocaleDateString("en-NG", {
            year: "numeric", month: "long", day: "numeric",
          })
        : "—"
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Store banner + logo */}
      <div className="sd-card">
        <div className="sd-card-header">
          <h3 className="sd-card-title">⚙️ Store Settings</h3>
          <a href="/become-seller" style={s.editBtn}>✏️ Edit Store</a>
        </div>

        {vendor?.store_banner && (
          <div style={s.bannerWrap}>
            <img src={vendor.store_banner} alt="Banner" style={s.banner} />
            {vendor?.store_logo && (
              <img src={vendor.store_logo} alt="Logo" style={s.logo} />
            )}
          </div>
        )}

        {vendor?.store_description && (
          <p style={s.description}>{vendor.store_description}</p>
        )}

        <div className="sd-settings-grid">
          {rows.map(({ label, value }) => (
            <div key={label} className="sd-setting-row">
              <span className="sd-setting-label">{label}</span>
              <span className="sd-setting-value">{value ?? "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bank details */}
      <div className="sd-card">
        <h3 className="sd-card-title">🏦 Payout Bank</h3>
        <div className="sd-settings-grid">
          {[
            { label: "Bank Name",     value: vendor?.bank_name                                   },
            { label: "Account",       value: "•".repeat(6) + (vendor?.bank_account?.slice(-4) ?? "——") },
            { label: "Account Name",  value: vendor?.account_name                                },
          ].map(({ label, value }) => (
            <div key={label} className="sd-setting-row">
              <span className="sd-setting-label">{label}</span>
              <span className="sd-setting-value">{value ?? "—"}</span>
            </div>
          ))}
        </div>

        <a href="/become-seller" style={{ ...s.editBtn, display: "inline-block", marginTop: "1rem" }}>
          🔄 Update Bank Details
        </a>
      </div>

    </div>
  );
};

const s = {
  editBtn: {
    padding:        "0.5rem 1rem",
    background:     "#eef2ff",
    color:          "#6366f1",
    borderRadius:   "8px",
    textDecoration: "none",
    fontWeight:     600,
    fontSize:       "0.85rem",
  },
  bannerWrap: {
    position:     "relative",
    marginBottom: "2rem",
    borderRadius: "12px",
    overflow:     "visible",
  },
  banner: {
    width:        "100%",
    height:       "140px",
    objectFit:    "cover",
    borderRadius: "12px",
    display:      "block",
  },
  logo: {
    position:     "absolute",
    bottom:       "-20px",
    left:         "1rem",
    width:        "60px",
    height:       "60px",
    borderRadius: "12px",
    objectFit:    "cover",
    border:       "3px solid white",
    boxShadow:    "0 2px 8px rgba(0,0,0,0.15)",
  },
  description: {
    color:        "#6b7280",
    fontSize:     "0.875rem",
    lineHeight:   1.6,
    marginBottom: "1.5rem",
    paddingTop:   "1rem",
    borderTop:    "1px solid #f3f4f6",
  },
};
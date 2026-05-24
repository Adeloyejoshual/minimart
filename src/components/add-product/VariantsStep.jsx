import { FiTrash2, FiPlus } from "react-icons/fi";
import { BLANK_VARIANT } from "./constants";

const ATTRIBUTES = [
  { key: "color",    placeholder: "e.g. Midnight Black" },
  { key: "size",     placeholder: "e.g. XL or US10"    },
  { key: "storage",  placeholder: "e.g. 256 GB"        },
  { key: "material", placeholder: "e.g. Aluminium"     },
];

function StockBadge({ stock }) {
  const qty = parseInt(stock, 10) || 0;
  const cls = qty === 0 ? "ap-stock-badge--zero"
            : qty <= 5  ? "ap-stock-badge--low"
            :             "ap-stock-badge--ok";
  const label = qty === 0 ? "Out of stock"
              : qty <= 5  ? `⚠️ Only ${qty} left`
              :             `${qty} units`;
  return <span className={`ap-stock-badge ${cls}`}>{label}</span>;
}

export default function VariantsStep({ variants, setVariants }) {
  const updateVariant = (i, field, value) =>
    setVariants((p) =>
      p.map((x, j) => (j === i ? { ...x, [field]: value } : x))
    );

  const updateAttr = (i, attr, value) =>
    setVariants((p) =>
      p.map((x, j) =>
        j === i
          ? { ...x, attributes: { ...x.attributes, [attr]: value } }
          : x
      )
    );

  const removeVariant = (i) =>
    setVariants((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : p));

  return (
    <>
      <p className="ap-section-title">Product Variants & Inventory</p>
      <p className="ap-section-sub">
        Each variant is a unique SKU with its own price and stock.
        E.g. different colours, sizes, or storage options.
      </p>

      {variants.map((v, i) => (
        <div className="ap-variant-card" key={v._id}>
          {/* Header */}
          <div className="ap-variant-header">
            <strong>Variant {i + 1}</strong>
            <button
              type="button"
              className="ap-variant-delete"
              onClick={() => removeVariant(i)}
            >
              <FiTrash2 size={13} />
            </button>
          </div>

          {/* Core fields */}
          <div className="ap-variant-grid">
            <div className="ap-variant-field ap-variant-field--full">
              <label>Variant Name *</label>
              <input
                placeholder='e.g. "Black 256GB"'
                value={v.name}
                onChange={(e) => updateVariant(i, "name", e.target.value)}
              />
            </div>

            <div className="ap-variant-field">
              <label>SKU *</label>
              <input
                placeholder='e.g. "SAM-A54-BLK-256"'
                value={v.sku}
                onChange={(e) =>
                  updateVariant(i, "sku", e.target.value.toUpperCase())
                }
              />
            </div>

            <div className="ap-variant-field">
              <label>Price (₦) *</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={v.price ? Number(v.price).toLocaleString() : ""}
                onChange={(e) =>
                  updateVariant(i, "price", e.target.value.replace(/\D/g, ""))
                }
              />
            </div>

            <div className="ap-variant-field">
              <label>Stock Qty *</label>
              <input
                type="number"
                min="0"
                placeholder="1"
                value={v.stock}
                onChange={(e) => updateVariant(i, "stock", e.target.value)}
              />
              <StockBadge stock={v.stock} />
            </div>
          </div>

          {/* Attributes */}
          <p className="ap-attr-label">Attributes (fill what applies)</p>
          <div className="ap-variant-grid">
            {ATTRIBUTES.map(({ key, placeholder }) => (
              <div className="ap-variant-field" key={key}>
                <label>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                <input
                  placeholder={placeholder}
                  value={v.attributes[key] || ""}
                  onChange={(e) => updateAttr(i, key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {variants.length < 12 && (
        <button
          type="button"
          className="ap-add-btn ap-add-btn--lg"
          onClick={() => setVariants((p) => [...p, BLANK_VARIANT()])}
        >
          <FiPlus size={14} /> Add Another Variant
        </button>
      )}
    </>
  );
}
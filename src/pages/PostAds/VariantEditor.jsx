import React from "react";
import { FiTrash2, FiPlus } from "react-icons/fi";

export default function VariantEditor({
  variants,
  onUpdate,
  onUpdateAttr,
  onAdd,
  onRemove,
}) {
  return (
    <>
      <p className="pa-section-title">Product Variants</p>
      <p className="pa-section-sub">
        Each variant is a unique SKU — different colour, size, storage, etc.
      </p>

      {variants.map((v, i) => {
        const stock = parseInt(v.stock, 10) || 0;

        return (
          <div className="pa-variant-card" key={v.id}>

            {/* Card header */}
            <div className="pa-variant-header">
              <span className="pa-variant-title">Variant {i + 1}</span>
              <button
                type="button"
                className="pa-variant-delete"
                onClick={() => onRemove(i)}
              >
                <FiTrash2 size={13} />
              </button>
            </div>

            {/* Core fields */}
            <div className="pa-variant-grid" style={{ marginBottom: 10 }}>
              <div className="pa-variant-field" style={{ gridColumn: "span 2" }}>
                <label>Variant Name *</label>
                <input
                  placeholder='e.g. "Black 128GB"'
                  value={v.name}
                  onChange={(e) => onUpdate(i, "name", e.target.value)}
                />
              </div>

              <div className="pa-variant-field">
                <label>SKU *</label>
                <input
                  placeholder='e.g. "IP13-BLK-128"'
                  value={v.sku}
                  onChange={(e) => onUpdate(i, "sku", e.target.value.toUpperCase())}
                />
              </div>

              <div className="pa-variant-field">
                <label>Price (₦) *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={v.price ? Number(v.price).toLocaleString() : ""}
                  onChange={(e) =>
                    onUpdate(i, "price", e.target.value.replace(/\D/g, ""))
                  }
                />
              </div>

              <div className="pa-variant-field">
                <label>Stock Qty</label>
                <input
                  type="number"
                  min="0"
                  placeholder="1"
                  value={v.stock}
                  onChange={(e) => onUpdate(i, "stock", e.target.value)}
                />
                <span
                  className={`pa-stock-badge ${
                    stock === 0 ? "pa-stock-badge--zero" :
                    stock <= 3  ? "pa-stock-badge--low"  : "pa-stock-badge--ok"
                  }`}
                >
                  {stock === 0
                    ? "Out of stock"
                    : stock <= 3
                    ? `Only ${stock} left!`
                    : `${stock} in stock`}
                </span>
              </div>
            </div>

            {/* Attributes */}
            <p style={{
              fontSize: 11, fontWeight: 700, color: "#aaa",
              textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8,
            }}>
              Attributes (fill what applies)
            </p>

            <div className="pa-variant-grid">
              <div className="pa-variant-field">
                <label>Color</label>
                <input
                  placeholder='e.g. "Midnight Black"'
                  value={v.attributes.color}
                  onChange={(e) => onUpdateAttr(i, "color", e.target.value)}
                />
              </div>
              <div className="pa-variant-field">
                <label>Size</label>
                <input
                  placeholder='e.g. "XL" or "42"'
                  value={v.attributes.size}
                  onChange={(e) => onUpdateAttr(i, "size", e.target.value)}
                />
              </div>
              <div className="pa-variant-field">
                <label>Storage</label>
                <input
                  placeholder='e.g. "256GB"'
                  value={v.attributes.storage}
                  onChange={(e) => onUpdateAttr(i, "storage", e.target.value)}
                />
              </div>
              <div className="pa-variant-field">
                <label>Material</label>
                <input
                  placeholder='e.g. "Cotton"'
                  value={v.attributes.material || ""}
                  onChange={(e) => onUpdateAttr(i, "material", e.target.value)}
                />
              </div>
            </div>

          </div>
        );
      })}

      {variants.length < 10 && (
        <button
          type="button"
          className="pa-add-btn"
          style={{ height: 48, fontSize: 14 }}
          onClick={onAdd}
        >
          <FiPlus size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
          Add Another Variant
        </button>
      )}
    </>
  );
}

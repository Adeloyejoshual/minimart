import { FiInfo } from "react-icons/fi";
import categories from "../../config/categories";

/* ── Dynamic attribute fields ── */
function CategoryAttributesForm({ attributes, values, onChange }) {
  if (!attributes.length) return null;

  return (
    <div className="ap-cat-attribs">
      <p className="ap-section-sub">
        Fill in the fields specific to this category.
      </p>
      <div className="ap-cat-attrib-grid">
        {attributes.map((attr) => (
          <div className="ap-variant-field" key={attr.field_key}>
            <label>
              {attr.field_label}
              {attr.is_required && (
                <span className="ap-required"> *</span>
              )}
            </label>

            {attr.field_type === "select" ? (
              <select
                value={values[attr.field_key] || ""}
                onChange={(e) => onChange(attr.field_key, e.target.value)}
              >
                <option value="">
                  {attr.placeholder || `Select ${attr.field_label}`}
                </option>
                {(attr.field_options || []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder={attr.placeholder || ""}
                value={values[attr.field_key] || ""}
                onChange={(e) => onChange(attr.field_key, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CategoryStep({
  categoryId,      setCategoryId,
  catAttribDefs,
  catAttribValues, setCatAttribValues,
  loadingAttribs,
}) {
  const activeCategory = categories.find((c) => c.id === categoryId);

  return (
    <>
      <p className="ap-section-title">Category & Attributes</p>
      <p className="ap-section-sub">
        Choose the correct category. Dynamic fields will appear below
        to capture category-specific details.
      </p>

      {/* ── Category grid ── */}
      <div className="ap-field">
        <label className="ap-label">Category *</label>
        <div className="ap-cat-grid">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`ap-cat-btn ${categoryId === c.id ? "ap-cat-btn--active" : ""}`}
              onClick={() => setCategoryId(c.id)}
            >
              <span className="ap-cat-icon">{c.icon}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Dynamic attributes ── */}
      {categoryId && (
        loadingAttribs ? (
          <div className="ap-loading-attribs">
            <div className="ap-spinner-sm" />
            <span>Loading category fields…</span>
          </div>
        ) : catAttribDefs.length > 0 ? (
          <>
            <p className="ap-section-title" style={{ marginTop: 20 }}>
              {activeCategory?.icon} {activeCategory?.name} Details
            </p>
            <CategoryAttributesForm
              attributes={catAttribDefs}
              values={catAttribValues}
              onChange={(key, val) =>
                setCatAttribValues((p) => ({ ...p, [key]: val }))
              }
            />
          </>
        ) : (
          <div className="ap-no-attribs">
            <FiInfo size={16} />
            <span>
              No extra fields for this category.
              Use the Specifications section to add details.
            </span>
          </div>
        )
      )}
    </>
  );
}
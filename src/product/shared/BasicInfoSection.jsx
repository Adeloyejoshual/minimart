/**
 * src/product/shared/BasicInfoSection.jsx
 * Title · Description · Price
 *
 * v2 — Inline field errors
 *      Each input shows the exact validation message under it
 *      when fieldError.field matches the input's key.
 */
import { useEffect, useState } from "react";
import { useAddProductContext } from "../../hooks/useAddProductContext.jsx";
import SectionDot  from "../../pages/product/components/SectionDot.jsx";
import CharCounter from "../../pages/product/components/CharCounter.jsx";
import { WarningIcon } from "../../pages/product/components/icons/index.jsx";

export default function BasicInfoSection({ innerRef }) {
  const {
    form, updateForm, displayPrice, onlyNumbers, isEditMode,
    fieldError,   /* ✅ v8: inline field errors */
  } = useAddProductContext();

  const [titleSuggestions, setTitleSuggestions] = useState([]);

  useEffect(() => {
    if (isEditMode) return;
    if (!form.description || form.description.length < 30
        || form.title?.trim().length >= 10) {
      setTitleSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      const words = form.description
        .split(/[\s,.\-|]+/)
        .filter((w) => w.length > 3)
        .slice(0, 5);
      setTitleSuggestions(words.length >= 3 ? [words.join(" ")] : []);
    }, 600);
    return () => clearTimeout(t);
  }, [isEditMode, form.description, form.title]);

  const basicFilled =
    !!(form.title?.trim() && form.description?.trim() && form.price);

  /* Helper — checks if a specific field has an error right now */
  const hasError = (field) => fieldError?.field === field;

  return (
    <section ref={innerRef} className="section form-card">
      <h3 className="section-title">
        Basic Information <SectionDot filled={basicFilled} />
      </h3>

      {/* ── TITLE ── */}
      <div className={`form-group ${hasError("title") ? "has-error" : ""}`}>
        <label htmlFor="ap-title">Product Title *</label>
        <input
          id="ap-title"
          placeholder="e.g. HP Pavilion 15 Laptop"
          value={form.title}
          onChange={(e) => updateForm("title", e.target.value)}
          maxLength={120}
          aria-invalid={hasError("title") || undefined}
          aria-describedby={hasError("title") ? "ap-title-error" : undefined}
        />
        <div className="field-footer">
          <span />
          <CharCounter value={form.title} max={120} />
        </div>

        {hasError("title") && (
          <div id="ap-title-error" className="field-error" role="alert">
            <WarningIcon />
            <span>{fieldError.message}</span>
          </div>
        )}

        {!isEditMode && titleSuggestions.length > 0 && (
          <div className="title-suggestions">
            <span className="title-suggestions-label">Suggestion:</span>
            {titleSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="title-suggestion-chip"
                onClick={() => {
                  updateForm("title", s);
                  setTitleSuggestions([]);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── DESCRIPTION ── */}
      <div className={`form-group ${hasError("description") ? "has-error" : ""}`}>
        <label htmlFor="ap-desc">Description *</label>
        <textarea
          id="ap-desc"
          rows={4}
          placeholder="Describe your product — condition, features, reason for selling"
          value={form.description}
          onChange={(e) => updateForm("description", e.target.value)}
          maxLength={2000}
          aria-invalid={hasError("description") || undefined}
          aria-describedby={hasError("description") ? "ap-desc-error" : undefined}
        />
        <div className="field-footer">
          <span />
          <CharCounter value={form.description} max={2000} min={10} />
        </div>

        {hasError("description") && (
          <div id="ap-desc-error" className="field-error" role="alert">
            <WarningIcon />
            <span>{fieldError.message}</span>
          </div>
        )}
      </div>

      {/* ── PRICE ── */}
      <div className={`form-group ${hasError("price") ? "has-error" : ""}`}>
        <label htmlFor="ap-price">Price (&#8358;) *</label>
        <input
          id="ap-price"
          type="text"
          inputMode="numeric"
          placeholder="Enter price"
          value={displayPrice(form.price)}
          onChange={(e) => updateForm("price", onlyNumbers(e.target.value))}
          aria-invalid={hasError("price") || undefined}
          aria-describedby={hasError("price") ? "ap-price-error" : undefined}
        />

        {hasError("price") && (
          <div id="ap-price-error" className="field-error" role="alert">
            <WarningIcon />
            <span>{fieldError.message}</span>
          </div>
        )}
      </div>
    </section>
  );
}
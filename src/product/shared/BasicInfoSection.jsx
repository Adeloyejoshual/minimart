/**
 * src/product/shared/BasicInfoSection.jsx
 * Title · Description · Price
 */
import { useAddProductContext } from "../../hooks/useAddProductContext.jsx";
import SectionDot   from "../components/SectionDot.jsx";
import CharCounter  from "../../components/CharCounter.jsx";
import { useEffect, useState } from "react";

export default function BasicInfoSection({ innerRef }) {
  const {
    form, updateForm, displayPrice, onlyNumbers, isEditMode,
  } = useAddProductContext();

  const [titleSuggestions, setTitleSuggestions] = useState([]);

  /* ── Auto-suggest title from description ── */
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

  return (
    <section ref={innerRef} className="section form-card">
      <h3 className="section-title">
        Basic Information <SectionDot filled={basicFilled} />
      </h3>

      <div className="form-group">
        <label htmlFor="ap-title">Product Title *</label>
        <input
          id="ap-title"
          placeholder="e.g. HP Pavilion 15 Laptop"
          value={form.title}
          onChange={(e) => updateForm("title", e.target.value)}
          maxLength={120}
        />
        <div className="field-footer">
          <span />
          <CharCounter value={form.title} max={120} />
        </div>

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

      <div className="form-group">
        <label htmlFor="ap-desc">Description *</label>
        <textarea
          id="ap-desc"
          rows={4}
          placeholder="Describe your product — condition, features, reason for selling"
          value={form.description}
          onChange={(e) => updateForm("description", e.target.value)}
          maxLength={2000}
        />
        <div className="field-footer">
          <span />
          <CharCounter value={form.description} max={2000} min={10} />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="ap-price">Price (&#8358;) *</label>
        <input
          id="ap-price"
          type="text"
          inputMode="numeric"
          placeholder="Enter price"
          value={displayPrice(form.price)}
          onChange={(e) => updateForm("price", onlyNumbers(e.target.value))}
        />
      </div>
    </section>
  );
}
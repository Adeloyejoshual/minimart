import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api";

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}
function authH() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/* ── helpers ── */
const CURRENCY = "\u20A6"; // ₦

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/* ── category → suggested attribute keys ── */
const CATEGORY_ATTRS = {
  electronics:   ["Color", "Storage", "RAM", "Screen Size"],
  phones:        ["Color", "Storage", "RAM", "Battery"],
  computers:     ["Color", "Storage", "RAM", "Processor"],
  fashion:       ["Color", "Size", "Material", "Gender"],
  clothing:      ["Color", "Size", "Material", "Fit"],
  shoes:         ["Color", "Size", "Material"],
  home:          ["Color", "Material", "Dimensions", "Weight"],
  furniture:     ["Color", "Material", "Dimensions"],
  beauty:        ["Size", "Skin Type", "Volume"],
  sports:        ["Color", "Size", "Weight"],
  automotive:    ["Color", "Year", "Mileage", "Fuel Type"],
  vehicles:      ["Color", "Year", "Mileage", "Transmission"],
  books:         ["Author", "Language", "Pages", "Publisher"],
  default:       ["Color"],
};

function getSuggestedAttrs(categoryName) {
  if (!categoryName) return CATEGORY_ATTRS.default;
  const key = categoryName.toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_ATTRS)) {
    if (key.includes(k)) return v;
  }
  return CATEGORY_ATTRS.default;
}

/* ══════════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════════ */
const Ic = {
  plus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  minus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M5 12h14"/>
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
    </svg>
  ),
  camera: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  close: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  ),
  check: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  ),
  upload: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  info: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4M12 8h.01"/>
    </svg>
  ),
};

/* ══════════════════════════════════════════════
   DYNAMIC PAIR LIST
   Used for: Attributes, Specs, Key Features, Box Contents
══════════════════════════════════════════════ */
function PairList({
  title,
  subtitle,
  items,
  setItems,
  keyPlaceholder = "e.g. Color",
  valuePlaceholder = "e.g. Black",
  keyLabel = "Name",
  valueLabel = "Value",
  suggestions = [],
}) {
  const addRow = useCallback(() => {
    setItems(prev => [...prev, { key: "", value: "" }]);
  }, [setItems]);

  const removeRow = useCallback((idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }, [setItems]);

  const updateRow = useCallback((idx, field, val) => {
    setItems(prev =>
      prev.map((item, i) =>
        i === idx ? { ...item, [field]: val } : item
      )
    );
  }, [setItems]);

  const addSuggested = useCallback((sugKey) => {
    /* don't add if already exists */
    setItems(prev => {
      if (prev.some(p => p.key.toLowerCase() === sugKey.toLowerCase())) {
        return prev;
      }
      return [...prev, { key: sugKey, value: "" }];
    });
  }, [setItems]);

  return (
    <div style={{
      background: "#fafafa",
      border: "1px solid #f0f0f0",
      borderRadius: 14,
      padding: "16px 18px",
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
      }}>
        <div>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: "#18181b", letterSpacing: "-.2px",
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={addRow}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "6px 12px", borderRadius: 8,
            border: "1.5px solid #e5e7eb",
            background: "#fff", color: "#555",
            fontSize: 12, fontWeight: 600,
            cursor: "pointer", transition: "all .15s",
          }}
        >
          {Ic.plus} Add
        </button>
      </div>

      {/* Suggestion chips (only show keys not already added) */}
      {suggestions.length > 0 && (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 6,
          marginBottom: items.length > 0 ? 10 : 0,
        }}>
          {suggestions
            .filter(s => !items.some(it => it.key.toLowerCase() === s.toLowerCase()))
            .map(s => (
              <button
                key={s}
                type="button"
                onClick={() => addSuggested(s)}
                style={{
                  padding: "4px 10px", borderRadius: 16,
                  border: "1.5px dashed #d1d5db",
                  background: "#fff", color: "#666",
                  fontSize: 11, fontWeight: 500,
                  cursor: "pointer", transition: "all .15s",
                }}
                onMouseEnter={e => {
                  e.target.style.borderColor = "#18181b";
                  e.target.style.color = "#18181b";
                }}
                onMouseLeave={e => {
                  e.target.style.borderColor = "#d1d5db";
                  e.target.style.color = "#666";
                }}
              >
                + {s}
              </button>
            ))}
        </div>
      )}

      {/* Rows */}
      {items.length === 0 && (
        <div style={{
          textAlign: "center", padding: "14px 0",
          fontSize: 12, color: "#bbb",
        }}>
          No items yet. Click "Add" or select a suggestion above.
        </div>
      )}

      {items.map((item, idx) => (
        <div
          key={idx}
          style={{
            display: "flex", gap: 8,
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          {/* Key input */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {idx === 0 && (
              <label style={{
                fontSize: 10, fontWeight: 700,
                color: "#888", textTransform: "uppercase",
                letterSpacing: ".5px",
                display: "block", marginBottom: 3,
              }}>
                {keyLabel}
              </label>
            )}
            <input
              type="text"
              value={item.key}
              onChange={e => updateRow(idx, "key", e.target.value)}
              placeholder={keyPlaceholder}
              style={{
                width: "100%", padding: "8px 10px",
                borderRadius: 8, border: "1.5px solid #e5e7eb",
                fontSize: 13, background: "#fff",
                outline: "none", boxSizing: "border-box",
                transition: "border-color .15s",
              }}
              onFocus={e => (e.target.style.borderColor = "#18181b")}
              onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
            />
          </div>

          {/* Value input */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {idx === 0 && (
              <label style={{
                fontSize: 10, fontWeight: 700,
                color: "#888", textTransform: "uppercase",
                letterSpacing: ".5px",
                display: "block", marginBottom: 3,
              }}>
                {valueLabel}
              </label>
            )}
            <input
              type="text"
              value={item.value}
              onChange={e => updateRow(idx, "value", e.target.value)}
              placeholder={valuePlaceholder}
              style={{
                width: "100%", padding: "8px 10px",
                borderRadius: 8, border: "1.5px solid #e5e7eb",
                fontSize: 13, background: "#fff",
                outline: "none", boxSizing: "border-box",
                transition: "border-color .15s",
              }}
              onFocus={e => (e.target.style.borderColor = "#18181b")}
              onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
            />
          </div>

          {/* Remove button */}
          <button
            type="button"
            onClick={() => removeRow(idx)}
            style={{
              width: 32, height: 32,
              borderRadius: 8, border: "1.5px solid #fecaca",
              background: "#fef2f2", color: "#ef4444",
              cursor: "pointer", flexShrink: 0,
              display: "flex", alignItems: "center",
              justifyContent: "center",
              marginTop: idx === 0 ? 18 : 0,
              transition: "all .15s",
            }}
          >
            {Ic.trash}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════
   SINGLE-VALUE LIST
   Used for: What's in the Box
══════════════════════════════════════════════ */
function SingleList({
  title,
  subtitle,
  items,
  setItems,
  placeholder = "e.g. 1x Charging Cable",
}) {
  const addRow = useCallback(() => {
    setItems(prev => [...prev, ""]);
  }, [setItems]);

  const removeRow = useCallback((idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }, [setItems]);

  const updateRow = useCallback((idx, val) => {
    setItems(prev => prev.map((item, i) => (i === idx ? val : item)));
  }, [setItems]);

  return (
    <div style={{
      background: "#fafafa",
      border: "1px solid #f0f0f0",
      borderRadius: 14,
      padding: "16px 18px",
      marginBottom: 16,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
      }}>
        <div>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: "#18181b", letterSpacing: "-.2px",
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={addRow}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "6px 12px", borderRadius: 8,
            border: "1.5px solid #e5e7eb",
            background: "#fff", color: "#555",
            fontSize: 12, fontWeight: 600,
            cursor: "pointer", transition: "all .15s",
          }}
        >
          {Ic.plus} Add
        </button>
      </div>

      {items.length === 0 && (
        <div style={{
          textAlign: "center", padding: "14px 0",
          fontSize: 12, color: "#bbb",
        }}>
          No items yet. Click "Add" to start.
        </div>
      )}

      {items.map((item, idx) => (
        <div
          key={idx}
          style={{
            display: "flex", gap: 8,
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <input
            type="text"
            value={item}
            onChange={e => updateRow(idx, e.target.value)}
            placeholder={placeholder}
            style={{
              flex: 1, padding: "8px 10px",
              borderRadius: 8, border: "1.5px solid #e5e7eb",
              fontSize: 13, background: "#fff",
              outline: "none", boxSizing: "border-box",
              transition: "border-color .15s",
            }}
            onFocus={e => (e.target.style.borderColor = "#18181b")}
            onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
          />
          <button
            type="button"
            onClick={() => removeRow(idx)}
            style={{
              width: 32, height: 32,
              borderRadius: 8, border: "1.5px solid #fecaca",
              background: "#fef2f2", color: "#ef4444",
              cursor: "pointer", flexShrink: 0,
              display: "flex", alignItems: "center",
              justifyContent: "center",
              transition: "all .15s",
            }}
          >
            {Ic.trash}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN POST ADS COMPONENT
══════════════════════════════════════════════ */
export default function PostAds({ user }) {
  const navigate = useNavigate();

  /* ── form state ── */
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [price,       setPrice]       = useState("");
  const [categoryId,  setCategoryId]  = useState("");
  const [condition,   setCondition]   = useState("new");
  const [city,        setCity]        = useState("");
  const [state_,      setState_]     = useState("");
  const [images,      setImages]      = useState([]); // File[]
  const [previews,    setPreviews]    = useState([]); // string[]

  /* ── dynamic sections — start with ONE row each ── */
  const [attributes,  setAttributes]  = useState([{ key: "Color", value: "" }]);
  const [features,    setFeatures]    = useState([{ key: "", value: "" }]);
  const [specs,       setSpecs]       = useState([{ key: "", value: "" }]);
  const [boxItems,    setBoxItems]    = useState([""]);

  /* ── meta ── */
  const [categories,  setCategories]  = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [success,     setSuccess]     = useState(false);

  const fileRef = useRef(null);

  /* ── load categories ── */
  useEffect(() => {
    axios
      .get(`${API}/addproduct/categories`, { headers: authH() })
      .then(({ data }) => {
        const list = Array.isArray(data)
          ? data
          : data.categories || data.data || [];
        setCategories(list);
      })
      .catch(() => {});
  }, []);

  /* ── get selected category name ── */
  const selectedCategory = useMemo(() => {
    if (!categoryId) return null;
    return categories.find(c => String(c.id) === String(categoryId));
  }, [categoryId, categories]);

  /* ── suggested attribute keys based on category ── */
  const suggestedAttrs = useMemo(
    () => getSuggestedAttrs(selectedCategory?.name),
    [selectedCategory]
  );

  /* ── when category changes, pre-fill first attribute key ── */
  useEffect(() => {
    if (suggestedAttrs.length > 0 && attributes.length === 1 && !attributes[0].value) {
      setAttributes([{ key: suggestedAttrs[0], value: "" }]);
    }
    // eslint-disable-next-line
  }, [categoryId]);

  /* ── image handling ── */
  const handleImageSelect = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const MAX = 6;
    const remaining = MAX - images.length;
    const toAdd = files.slice(0, remaining);

    if (toAdd.length < files.length) {
      setError(`Maximum ${MAX} images allowed`);
    }

    const newPreviews = toAdd.map(f => URL.createObjectURL(f));
    setImages(prev => [...prev, ...toAdd]);
    setPreviews(prev => [...prev, ...newPreviews]);
    e.target.value = "";
  }, [images.length]);

  const removeImage = useCallback((idx) => {
    URL.revokeObjectURL(previews[idx]);
    setImages(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  }, [previews]);

  /* ── cleanup previews ── */
  useEffect(() => {
    return () => previews.forEach(u => URL.revokeObjectURL(u));
    // eslint-disable-next-line
  }, []);

  /* ── submit ── */
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError("");

    /* validation */
    if (!title.trim())       return setError("Title is required");
    if (!price || Number(price) <= 0)
                             return setError("Enter a valid price");
    if (!categoryId)         return setError("Select a category");
    if (!description.trim()) return setError("Description is required");
    if (images.length === 0) return setError("Upload at least one image");
    if (!city.trim())        return setError("City is required");
    if (!state_.trim())      return setError("State is required");

    setLoading(true);

    try {
      /* build attributes object */
      const attrObj = {};
      attributes.forEach(a => {
        if (a.key.trim() && a.value.trim())
          attrObj[a.key.trim()] = a.value.trim();
      });

      /* build features array of {key, value} */
      const featArr = features
        .filter(f => f.key.trim() && f.value.trim())
        .map(f => ({ key: f.key.trim(), value: f.value.trim() }));

      /* build specs array of {key, value} */
      const specArr = specs
        .filter(s => s.key.trim() && s.value.trim())
        .map(s => ({ key: s.key.trim(), value: s.value.trim() }));

      /* box items */
      const boxArr = boxItems.filter(b => b.trim());

      const form = new FormData();
      form.append("title",          title.trim());
      form.append("description",    description.trim());
      form.append("price",          Number(price));
      form.append("category_id",    categoryId);
      form.append("condition",      condition);
      form.append("location_city",  city.trim());
      form.append("location_state", state_.trim());
      form.append("slug",           slugify(title));

      if (Object.keys(attrObj).length > 0)
        form.append("attributes",   JSON.stringify(attrObj));
      if (featArr.length > 0)
        form.append("key_features", JSON.stringify(featArr));
      if (specArr.length > 0)
        form.append("specifications", JSON.stringify(specArr));
      if (boxArr.length > 0)
        form.append("whats_in_box", JSON.stringify(boxArr));

      images.forEach(img => form.append("images", img));

      await axios.post(`${API}/addproduct`, form, {
        headers: {
          ...authH(),
          "Content-Type": "multipart/form-data",
        },
        timeout: 30000,
      });

      setSuccess(true);
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Failed to post ad. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [
    title, description, price, categoryId, condition,
    city, state_, images, attributes, features, specs,
    boxItems, navigate,
  ]);

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */

  if (success) {
    return (
      <div style={{
        maxWidth: 480, margin: "80px auto", textAlign: "center",
        padding: "40px 24px",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "#f0fdf4", margin: "0 auto 20px",
          display: "flex", alignItems: "center",
          justifyContent: "center", color: "#22c55e",
        }}>
          {Ic.check}
        </div>
        <h2 style={{
          fontSize: 20, fontWeight: 800,
          color: "#18181b", margin: "0 0 8px",
        }}>
          Ad Posted Successfully
        </h2>
        <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6 }}>
          Your listing is pending review. You'll be redirected to your dashboard.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: 640, margin: "0 auto",
      padding: "24px 16px 60px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>

      {/* Page title */}
      <h1 style={{
        fontSize: 22, fontWeight: 900,
        color: "#18181b", margin: "0 0 4px",
        letterSpacing: "-.3px",
      }}>
        Post New Ad
      </h1>
      <p style={{ fontSize: 13, color: "#888", margin: "0 0 24px" }}>
        Fill in the details below. Fields marked * are required.
      </p>

      {/* Error banner */}
      {error && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fecaca",
          borderRadius: 10, padding: "10px 14px",
          marginBottom: 16, fontSize: 13, color: "#dc2626",
          fontWeight: 500, display: "flex", alignItems: "center", gap: 8,
        }}>
          {Ic.info} {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>

        {/* ── Images ── */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            fontSize: 12, fontWeight: 700, color: "#555",
            textTransform: "uppercase", letterSpacing: ".5px",
            display: "block", marginBottom: 8,
          }}>
            Photos * ({images.length}/6)
          </label>
          <div style={{
            display: "flex", gap: 10, flexWrap: "wrap",
          }}>
            {previews.map((url, idx) => (
              <div key={idx} style={{
                width: 80, height: 80, borderRadius: 12,
                overflow: "hidden", position: "relative",
                border: idx === 0 ? "2.5px solid #22c55e" : "1.5px solid #e5e7eb",
                flexShrink: 0,
              }}>
                <img src={url} alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
                <button type="button" onClick={() => removeImage(idx)}
                  style={{
                    position: "absolute", top: 3, right: 3,
                    width: 20, height: 20, borderRadius: "50%",
                    background: "rgba(0,0,0,.6)", border: "none",
                    color: "#fff", cursor: "pointer",
                    display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 10,
                  }}>
                  {Ic.close}
                </button>
                {idx === 0 && (
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    background: "#22c55e", color: "#fff",
                    fontSize: 9, fontWeight: 700, textAlign: "center",
                    padding: "1px 0",
                  }}>
                    COVER
                  </div>
                )}
              </div>
            ))}

            {images.length < 6 && (
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{
                  width: 80, height: 80, borderRadius: 12,
                  border: "2px dashed #d1d5db",
                  background: "#f9fafb", color: "#888",
                  cursor: "pointer", display: "flex",
                  flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: 4,
                  fontSize: 10, fontWeight: 600,
                  transition: "all .15s", flexShrink: 0,
                }}>
                {Ic.camera}
                Add
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            style={{ display: "none" }}
          />
        </div>

        {/* ── Title ── */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            fontSize: 12, fontWeight: 700, color: "#555",
            textTransform: "uppercase", letterSpacing: ".5px",
            display: "block", marginBottom: 6,
          }}>
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. iPhone 15 Pro Max 256GB"
            maxLength={120}
            style={{
              width: "100%", padding: "11px 14px",
              borderRadius: 10, border: "1.5px solid #e5e7eb",
              fontSize: 14, background: "#f9fafb",
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* ── Price + Category ── */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 12, marginBottom: 16,
        }}>
          <div>
            <label style={{
              fontSize: 12, fontWeight: 700, color: "#555",
              textTransform: "uppercase", letterSpacing: ".5px",
              display: "block", marginBottom: 6,
            }}>
              Price ({CURRENCY}) *
            </label>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="0"
              min={0}
              style={{
                width: "100%", padding: "11px 14px",
                borderRadius: 10, border: "1.5px solid #e5e7eb",
                fontSize: 14, background: "#f9fafb",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label style={{
              fontSize: 12, fontWeight: 700, color: "#555",
              textTransform: "uppercase", letterSpacing: ".5px",
              display: "block", marginBottom: 6,
            }}>
              Category *
            </label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              style={{
                width: "100%", padding: "11px 14px",
                borderRadius: 10, border: "1.5px solid #e5e7eb",
                fontSize: 14, background: "#f9fafb",
                outline: "none", boxSizing: "border-box",
                color: categoryId ? "#18181b" : "#888",
              }}
            >
              <option value="">Select category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Condition + Location ── */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12, marginBottom: 16,
        }}>
          <div>
            <label style={{
              fontSize: 12, fontWeight: 700, color: "#555",
              textTransform: "uppercase", letterSpacing: ".5px",
              display: "block", marginBottom: 6,
            }}>
              Condition
            </label>
            <select
              value={condition}
              onChange={e => setCondition(e.target.value)}
              style={{
                width: "100%", padding: "11px 14px",
                borderRadius: 10, border: "1.5px solid #e5e7eb",
                fontSize: 14, background: "#f9fafb",
                outline: "none", boxSizing: "border-box",
              }}
            >
              <option value="new">New</option>
              <option value="used">Used</option>
              <option value="refurbished">Refurbished</option>
            </select>
          </div>
          <div>
            <label style={{
              fontSize: 12, fontWeight: 700, color: "#555",
              textTransform: "uppercase", letterSpacing: ".5px",
              display: "block", marginBottom: 6,
            }}>
              City *
            </label>
            <input
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="e.g. Lagos"
              style={{
                width: "100%", padding: "11px 14px",
                borderRadius: 10, border: "1.5px solid #e5e7eb",
                fontSize: 14, background: "#f9fafb",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label style={{
              fontSize: 12, fontWeight: 700, color: "#555",
              textTransform: "uppercase", letterSpacing: ".5px",
              display: "block", marginBottom: 6,
            }}>
              State *
            </label>
            <input
              type="text"
              value={state_}
              onChange={e => setState_(e.target.value)}
              placeholder="e.g. Lagos"
              style={{
                width: "100%", padding: "11px 14px",
                borderRadius: 10, border: "1.5px solid #e5e7eb",
                fontSize: 14, background: "#f9fafb",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* ── Description ── */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            fontSize: 12, fontWeight: 700, color: "#555",
            textTransform: "uppercase", letterSpacing: ".5px",
            display: "block", marginBottom: 6,
          }}>
            Description *
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe your product in detail — condition, features, reason for selling..."
            rows={5}
            maxLength={3000}
            style={{
              width: "100%", padding: "11px 14px",
              borderRadius: 10, border: "1.5px solid #e5e7eb",
              fontSize: 14, background: "#f9fafb",
              outline: "none", boxSizing: "border-box",
              resize: "vertical", lineHeight: 1.6,
              fontFamily: "inherit",
            }}
          />
          <div style={{
            fontSize: 11, color: "#bbb",
            textAlign: "right", marginTop: 4,
          }}>
            {description.length}/3000
          </div>
        </div>

        {/* ═══ DYNAMIC SECTIONS ═══ */}

        {/* ── Attributes (Color, Size, etc.) ── */}
        <PairList
          title="Attributes"
          subtitle="Add product attributes like color, size, storage, etc."
          items={attributes}
          setItems={setAttributes}
          keyPlaceholder="e.g. Color"
          valuePlaceholder="e.g. Midnight Black"
          keyLabel="Attribute"
          valueLabel="Value"
          suggestions={suggestedAttrs}
        />

        {/* ── Key Features ── */}
        <PairList
          title="Key Features"
          subtitle="Highlight the main selling points"
          items={features}
          setItems={setFeatures}
          keyPlaceholder="e.g. Battery"
          valuePlaceholder="e.g. 5000mAh"
          keyLabel="Feature"
          valueLabel="Detail"
        />

        {/* ── Specifications ── */}
        <PairList
          title="Specifications"
          subtitle="Technical specifications"
          items={specs}
          setItems={setSpecs}
          keyPlaceholder="e.g. RAM"
          valuePlaceholder="e.g. 8GB"
          keyLabel="Spec"
          valueLabel="Value"
        />

        {/* ── What's in the Box ── */}
        <SingleList
          title="What's in the Box"
          subtitle="List all included items"
          items={boxItems}
          setItems={setBoxItems}
          placeholder='e.g. 1x Charging Cable'
        />

        {/* ── Submit ── */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            border: "none",
            background: loading ? "#888" : "#18181b",
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            cursor: loading ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all .15s",
            marginTop: 8,
          }}
        >
          {loading ? (
            <>
              <span style={{
                display: "inline-block", width: 16, height: 16,
                border: "2.5px solid rgba(255,255,255,.3)",
                borderTopColor: "#fff", borderRadius: "50%",
                animation: "spin .6s linear infinite",
              }}/>
              Posting...
            </>
          ) : (
            <>
              {Ic.upload}
              Post Ad
            </>
          )}
        </button>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
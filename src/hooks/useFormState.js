/**
 * hooks/useFormState.js
 *
 * v3 — COMPLETE REWRITE
 * ─────────────────────────────────────────────────────────────
 *  - Email removed from contact (lives in users table only)
 *  - Phone is optional
 *  - Clean, minimal, well-commented
 */

import { useState, useCallback } from "react";

const toArray = (v) => (Array.isArray(v) ? v : []);

/* ═══════════════════════════════════════════════════════════════
   INITIAL FORM
   ✅ Phone optional — empty string is valid
   ✅ Email intentionally absent — backend reads from users table
═══════════════════════════════════════════════════════════════ */
export const INITIAL_FORM = Object.freeze({
  title         : "",
  description   : "",
  price         : "",
  category_id   : "",
  subcategory_id: "",

  attributes: Object.freeze({
    brand           : "",
    model           : "",
    color           : "",
    condition       : "",
    used_detail     : "",
    ram             : "",
    storage         : "",
    sim             : "",
    year            : "",
    engine          : "",
    fuel_type       : "",
    features        : Object.freeze([]),
    size            : "",
    age_range       : "",
    bedrooms        : "",
    bathrooms       : "",
    experience_level: "",
    skills          : "",
  }),

  delivery: Object.freeze({
    available: false,
    duration : Object.freeze({ from: "", to: "" }),
    fee      : "",
    note     : "",
  }),

  /*
   * ✅ Contact — phone is OPTIONAL (empty string is valid)
   * ✅ Email is intentionally absent — never stored here
   *    Email is always read fresh from users table by backend
   */
  contact: Object.freeze({
    phone        : "",   /* optional */
    whatsapp     : "",   /* optional */
    whatsapp_link: "",   /* optional */
    preferred    : "chat",
  }),
});

/* ═══════════════════════════════════════════════════════════════
   FRESH FORM FACTORY
═══════════════════════════════════════════════════════════════ */
export const freshForm = () => structuredClone(INITIAL_FORM);

/* ═══════════════════════════════════════════════════════════════
   HOOK
═══════════════════════════════════════════════════════════════ */
export function useFormState(initial = null) {
  const [form, setForm] = useState(initial ?? freshForm());

  /* ── Update top-level field ── */
  const updateForm = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  /* ── Update attribute field ── */
  const updateAttribute = useCallback((key, value) => {
    setForm((prev) => {
      const next = { ...prev.attributes, [key]: value };
      /* Reset dependent fields */
      if (key === "brand")     next.model      = "";
      if (key === "condition") next.used_detail = "";
      return { ...prev, attributes: next };
    });
  }, []);

  /*
   * ── Update contact field ──
   * ✅ email key silently ignored — never stored in form state
   *    backend always reads fresh from users table
   */
  const updateContact = useCallback((key, value) => {
    if (key === "email") {
      if (import.meta.env?.DEV) {
        console.warn(
          "[useFormState] updateContact('email') ignored — " +
          "email comes from users table, not form input."
        );
      }
      return;
    }
    setForm((prev) => ({
      ...prev,
      contact: { ...prev.contact, [key]: value },
    }));
  }, []);

  /* ── Update delivery field ── */
  const updateDelivery = useCallback((key, value) => {
    setForm((prev) => ({
      ...prev,
      delivery: { ...prev.delivery, [key]: value },
    }));
  }, []);

  /* ── Update delivery duration (from / to) ── */
  const updateDeliveryDuration = useCallback((key, value) => {
    setForm((prev) => ({
      ...prev,
      delivery: {
        ...prev.delivery,
        duration: { ...prev.delivery.duration, [key]: value },
      },
    }));
  }, []);

  /* ── Toggle feature in attributes.features array ── */
  const toggleFeature = useCallback((feature) => {
    setForm((prev) => {
      const features = toArray(prev.attributes?.features);
      return {
        ...prev,
        attributes: {
          ...prev.attributes,
          features: features.includes(feature)
            ? features.filter((f) => f !== feature)
            : [...features, feature],
        },
      };
    });
  }, []);

  /* ── Reset to blank form ── */
  const resetForm = useCallback(() => {
    setForm(freshForm());
  }, []);

  /*
   * ── Load existing product data (edit mode) ──
   * ✅ email explicitly stripped even if product data contains it
   * ✅ phone loaded as-is (optional — may be empty)
   */
  const loadForm = useCallback((data) => {
    setForm({
      title         : data.title          || "",
      description   : data.description    || "",
      price         : String(data.price   || ""),
      category_id   : String(data.category_id    || ""),
      subcategory_id: String(data.subcategory_id || ""),

      attributes: {
        ...structuredClone(INITIAL_FORM.attributes),
        ...(
          typeof data.attributes === "object" &&
          data.attributes !== null
            ? data.attributes
            : {}
        ),
        features: toArray(data.attributes?.features),
      },

      delivery: {
        available: data.delivery?.available ?? false,
        duration : {
          from: data.delivery?.duration?.from ?? "",
          to  : data.delivery?.duration?.to   ?? "",
        },
        fee : data.delivery?.fee  ?? "",
        note: data.delivery?.note ?? "",
      },

      /*
       * ✅ Phone loaded from product data — may be empty string
       * ✅ Email intentionally excluded — backend reads from users table
       */
      contact: {
        phone        : data.phone         ||
                       data.contact?.phone         || "",
        whatsapp     : data.whatsapp      ||
                       data.contact?.whatsapp      || "",
        whatsapp_link: data.whatsapp_link ||
                       data.contact?.whatsapp_link || "",
        preferred    : data.contact?.preferred || "chat",
        /* email: deliberately not included */
      },
    });
  }, []);

  return {
    form,
    setForm,
    updateForm,
    updateAttribute,
    updateContact,
    updateDelivery,
    updateDeliveryDuration,
    toggleFeature,
    resetForm,
    loadForm,
  };
}
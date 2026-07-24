/**
 * hooks/useFormState.js
 * All form field state + updaters for AddProduct.
 *
 * v2 — EMAIL REMOVED
 * ─────────────────────────────────────────────────────────────
 *  - email field completely removed from contact object
 *  - Email is handled by backend (fetched from users table)
 *  - Contact now only contains: phone, whatsapp, whatsapp_link, preferred
 */

import { useState, useCallback } from "react";

const toArray = (v) => (Array.isArray(v) ? v : []);

/* ═══════════════════════════════════════════════════════════════
   INITIAL FORM
   ✅ v2: email removed from contact
═══════════════════════════════════════════════════════════════ */
export const INITIAL_FORM = Object.freeze({
  title          : "",
  description    : "",
  price          : "",
  category_id    : "",
  subcategory_id : "",

  attributes: Object.freeze({
    brand            : "",
    model            : "",
    color            : "",
    condition        : "",
    used_detail      : "",
    ram              : "",
    storage          : "",
    sim              : "",
    year             : "",
    engine           : "",
    fuel_type        : "",
    features         : Object.freeze([]),
    size             : "",
    age_range        : "",
    bedrooms         : "",
    bathrooms        : "",
    experience_level : "",
    skills           : "",
  }),

  delivery: Object.freeze({
    available : false,
    duration  : Object.freeze({ from: "", to: "" }),
    fee       : "",
    note      : "",
  }),

  /* ✅ v2: email removed — backend always reads from users table */
  contact: Object.freeze({
    phone         : "",
    whatsapp      : "",
    whatsapp_link : "",
    preferred     : "chat",
    /* email intentionally omitted */
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
      if (key === "brand")     next.model       = "";
      if (key === "condition") next.used_detail = "";

      return { ...prev, attributes: next };
    });
  }, []);

  /* ── Update contact field ──
     ✅ v2: email key is ignored even if accidentally passed
            to prevent email from leaking into form state   */
  const updateContact = useCallback((key, value) => {
    if (key === "email") {
      /* Silently ignore — email is never stored in form state */
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

  /* ── Update delivery duration ── */
  const updateDeliveryDuration = useCallback((key, value) => {
    setForm((prev) => ({
      ...prev,
      delivery: {
        ...prev.delivery,
        duration: { ...prev.delivery.duration, [key]: value },
      },
    }));
  }, []);

  /* ── Toggle feature ── */
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

  /* ── Load existing product data (edit mode)
     ✅ v2: email is explicitly stripped — never loaded into form
            even if product data contains it                     */
  const loadForm = useCallback((data) => {
    setForm({
      title          : data.title          || "",
      description    : data.description    || "",
      price          : String(data.price   || ""),
      category_id    : String(data.category_id    || ""),
      subcategory_id : String(data.subcategory_id || ""),

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
        available : data.delivery?.available ?? false,
        duration  : {
          from : data.delivery?.duration?.from ?? "",
          to   : data.delivery?.duration?.to   ?? "",
        },
        fee  : data.delivery?.fee  ?? "",
        note : data.delivery?.note ?? "",
      },

      /* ✅ v2: email intentionally excluded
                even if data.contact.email exists, it is dropped
                backend always reads fresh from users table       */
      contact: {
        phone         : data.phone         || data.contact?.phone         || "",
        whatsapp      : data.whatsapp      || data.contact?.whatsapp      || "",
        whatsapp_link : data.whatsapp_link || data.contact?.whatsapp_link || "",
        preferred     : data.contact?.preferred || "chat",
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
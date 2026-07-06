/**
 * hooks/useFormState.js
 * All form field state + updaters for AddProduct.
 */

import { useState, useCallback } from "react";

const toArray = (v) => (Array.isArray(v) ? v : []);

export const INITIAL_FORM = Object.freeze({
  title          : "",
  description    : "",
  price          : "",
  category_id    : "",
  subcategory_id : "",
  attributes     : Object.freeze({
    brand            : "", model        : "", color    : "",
    condition        : "", used_detail  : "", ram      : "",
    storage          : "", sim          : "", year     : "",
    engine           : "", fuel_type    : "",
    features         : Object.freeze([]),
    size             : "", age_range    : "", bedrooms : "",
    bathrooms        : "", experience_level: "", skills: "",
  }),
  delivery : Object.freeze({
    available : false,
    duration  : Object.freeze({ from: "", to: "" }),
    fee : "", note : "",
  }),
  contact : Object.freeze({
    phone : "", whatsapp : "", whatsapp_link : "",
    email : "", preferred : "chat",
  }),
});

export const freshForm = () => structuredClone(INITIAL_FORM);

export function useFormState(initial = null) {
  const [form, setForm] = useState(initial ?? freshForm());

  const updateForm = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateAttribute = useCallback((key, value) => {
    setForm((prev) => {
      const next = { ...prev.attributes, [key]: value };
      if (key === "brand")     next.model       = "";
      if (key === "condition") next.used_detail = "";
      return { ...prev, attributes: next };
    });
  }, []);

  const updateContact = useCallback((key, value) => {
    setForm((prev) => ({
      ...prev,
      contact: { ...prev.contact, [key]: value },
    }));
  }, []);

  const updateDelivery = useCallback((key, value) => {
    setForm((prev) => ({
      ...prev,
      delivery: { ...prev.delivery, [key]: value },
    }));
  }, []);

  const updateDeliveryDuration = useCallback((key, value) => {
    setForm((prev) => ({
      ...prev,
      delivery: {
        ...prev.delivery,
        duration: { ...prev.delivery.duration, [key]: value },
      },
    }));
  }, []);

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

  const resetForm = useCallback(() => {
    setForm(freshForm());
  }, []);

  const loadForm = useCallback((data) => {
    setForm({
      title          : data.title          || "",
      description    : data.description    || "",
      price          : String(data.price   || ""),
      category_id    : String(data.category_id    || ""),
      subcategory_id : String(data.subcategory_id || ""),
      attributes     : {
        ...structuredClone(INITIAL_FORM.attributes),
        ...(typeof data.attributes === "object" && data.attributes !== null
          ? data.attributes : {}),
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
      contact: {
        phone         : data.phone         || data.contact?.phone         || "",
        whatsapp      : data.whatsapp      || data.contact?.whatsapp      || "",
        whatsapp_link : data.whatsapp_link || data.contact?.whatsapp_link || "",
        email         : data.contact?.email || "",
        preferred     : data.contact?.preferred || "chat",
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
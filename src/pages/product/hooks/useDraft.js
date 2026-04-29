// src/pages/product/hooks/useDraft.js
import { useState, useEffect, useCallback } from "react";

const STORAGE_DRAFT = "product_draft";

export function useDraft({ form, images, selectedPlan, imagesCount }) {
  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  const save = useCallback(() => {
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_DRAFT,
          JSON.stringify({
            form,
            state,
            city,
            imagesCount: images.length,
            selectedPlan: selectedPlan?.id || null,
          })
        );
      } catch {}
    }, 1000);

    return () => clearTimeout(timeout);
  }, [form, state, city, images, selectedPlan]);

  useEffect(() => {
    const cleanup = save();
    return cleanup;
  }, [save]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT);
      if (!saved) return;

      const draft = JSON.parse(saved);
      setState(draft.state || "");
      setCity(draft.city || "");

      const sp = promotionPlans.find((p) => p.id === draft.selectedPlan);
      if (sp) setSelectedPlan(sp);
    } catch {
      // ignore corrupt draft
    }
  }, []);

  return {
    state,
    city,
    setState,
    setCity,
  };
}
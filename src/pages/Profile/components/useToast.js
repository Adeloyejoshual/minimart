// src/pages/Profile/components/useToast.js
import { useState, useCallback } from "react";

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((msg, type = "info", ms = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      ms
    );
  }, []);

  return { toasts, show };
}
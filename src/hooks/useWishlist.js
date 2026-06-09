import { useState, useCallback } from "react";

const STORAGE_KEY = "mm_wishlist";

function loadWishlist() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveWishlist(set) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

export default function useWishlist() {
  const [items, setItems] = useState(loadWishlist);

  const toggle = useCallback((id) => {
    setItems((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveWishlist(next);
      return next;
    });
  }, []);

  const has = useCallback((id) => items.has(id), [items]);

  return { items, toggle, has };
}
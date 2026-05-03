/**
 * hooks/useProductFeed.js
 * Shared hook for fetching a paginated, infinite-scroll product list.
 * Used by TrendingPage, DealsPage, NewArrivalsPage, NearbyPage, CategoryPage.
 *
 * @param {string} endpoint  - Full API URL to fetch from (with query params)
 */

import { useState, useEffect, useCallback, useRef } from "react";

const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => !seen.has(p.id) && seen.add(p.id));
};

export function useProductFeed(endpoint) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const productsRef = useRef([]);
  const sentinelRef = useRef(null);

  const fetchPage = useCallback(
    async (pageNum, append = false) => {
      try {
        const sep = endpoint.includes("?") ? "&" : "?";
        const url = `${endpoint}${sep}page=${pageNum}&limit=40`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const incoming = Array.isArray(data.products)
          ? data.products
          : Array.isArray(data)
          ? data
          : [];

        const merged = append
          ? dedup([...productsRef.current, ...incoming])
          : dedup(incoming);

        productsRef.current = merged;
        setProducts(merged);
        setHasMore(incoming.length >= 40);
      } catch (e) {
        setError("Could not load listings. Check your connection.");
        console.error(e);
      }
    },
    [endpoint]
  );

  // Initial load
  useEffect(() => {
    productsRef.current = [];
    setProducts([]);
    setPage(1);
    setError(null);
    setLoading(true);
    fetchPage(1, false).finally(() => setLoading(false));
  }, [fetchPage]);

  // Load more
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    await fetchPage(next, true);
    setPage(next);
    setLoadingMore(false);
  }, [loadingMore, hasMore, page, fetchPage]);

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  return { products, loading, loadingMore, error, sentinelRef };
}

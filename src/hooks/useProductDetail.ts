// src/hooks/useProductDetail.ts

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const BASE_URL      = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API           = `${BASE_URL}/api`;
const FAV_KEY       = "loemart_favs";
const REVIEWS_LIMIT = 5;
const FAV_DEBOUNCE  = 400;

/* ═══════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════ */
export interface ProductImage {
  url?: string;
  thumbnail_url?: string;
}

export interface ProductContact {
  whatsapp?: string;
  whatsapp_link?: string;
  phone?: string;
}

export interface Product {
  id: string | number;
  slug: string;
  title: string;
  price: number;
  description?: string;
  specifications?: Record<string, string>;
  seller_id: string | number;
  category_id?: string | number;
  image?: string;
  main_image?: string;
  thumbnail_url?: string;
  images?: (string | ProductImage)[];
  whatsapp?: string;
  whatsapp_link?: string;
  phone?: string;
  contact?: ProductContact;
  is_promoted?: boolean;
  condition?: string;
  location_city?: string;
  location?: { city?: string };
  views_count?: number;
  created_at?: string;
}

export interface Seller {
  id: string | number;
  name?: string;
  store_name?: string;
  store_logo?: string;
  profile_image?: string;
  verified?: boolean;
  is_online?: boolean;
  products_count?: number;
  total_sales?: number;
  rating?: number;
  trust_score?: number;
}

export interface Review {
  id?: string | number;
  author?: string;
  author_image?: string;
  rating: number;
  comment?: string;
  created_at?: string;
}

export interface ReviewStats {
  total: number;
  average: number;
  one_star?: number;
  two_star?: number;
  three_star?: number;
  four_star?: number;
  five_star?: number;
}

export interface User {
  id?: string | number;
}

/* ═══════════════════════════════════════════════════════════════
   AUTH UTILS
═══════════════════════════════════════════════════════════════ */
export const getToken = (): string | null =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

export const authH = (): Record<string, string> => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const decodeJWT = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
};

export const readUserId = (): string | null => {
  try {
    const token = getToken();
    if (token) {
      const p  = decodeJWT(token);
      const id = p?.id || p?.sub || p?.userId || p?.user_id;
      if (id) return String(id);
    }
    for (const key of ["user", "loemart_user", "authUser"]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const p  = JSON.parse(raw) as { id?: unknown; user?: { id?: unknown } };
      const id = p?.id || p?.user?.id;
      if (id) return String(id);
    }
    return null;
  } catch {
    return null;
  }
};

/* ═══════════════════════════════════════════════════════════════
   FAV UTILS
═══════════════════════════════════════════════════════════════ */
const loadFavs = (): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveFavs = (f: Record<string, boolean>): void => {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(f));
  } catch {}
};

/* ═══════════════════════════════════════════════════════════════
   HOOK RETURN TYPE
═══════════════════════════════════════════════════════════════ */
export interface UseProductDetailReturn {
  // State
  product:      Product | null;
  seller:       Seller | null;
  similar:      Product[];
  moreSeller:   Product[];
  reviews:      Review[];
  reviewStats:  ReviewStats | null;
  reviewTotal:  number;
  reviewPage:   number;
  loading:      boolean;
  error:        string | null;
  fav:          boolean;
  chatBusy:     boolean;
  chatError:    string | null;
  isOwn:        boolean;
  userId:       string | null;
  slug:         string | undefined;
  // Actions
  toggleFav:    () => void;
  openWhatsApp: () => void;
  openCall:     () => void;
  openChat:     () => Promise<void>;
  goProduct:    (p: Product) => void;
  loadReviews:  (page?: number) => Promise<void>;
  dismissChatError: () => void;
  handleLoadMoreReviews: () => void;
  handleReviewDone: () => void;
}

/* ═══════════════════════════════════════════════════════════════
   THE HOOK
═══════════════════════════════════════════════════════════════ */
export function useProductDetail(user?: User): UseProductDetailReturn {
  const { slug }   = useParams<{ slug: string }>();
  const navigate   = useNavigate();
  const { addSingleProduct } = useProductCache();

  /* ── state ───────────────────────────────────────────────── */
  const [product,     setProduct]     = useState<Product | null>(null);
  const [seller,      setSeller]      = useState<Seller | null>(null);
  const [similar,     setSimilar]     = useState<Product[]>([]);
  const [moreSeller,  setMoreSeller]  = useState<Product[]>([]);
  const [reviews,     setReviews]     = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewPage,  setReviewPage]  = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [fav,         setFav]         = useState(false);
  const [chatBusy,    setChatBusy]    = useState(false);
  const [chatError,   setChatError]   = useState<string | null>(null);

  /* ── refs ────────────────────────────────────────────────── */
  const favTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef    = useRef<AbortController | null>(null);

  /* ── derived ─────────────────────────────────────────────── */
  const userId = useMemo<string | null>(
    () => (user?.id ? String(user.id) : readUserId()),
    [user]
  );

  const isOwn = useMemo(
    () => !!(userId && product?.seller_id && userId === String(product.seller_id)),
    [userId, product?.seller_id]
  );

  /* ── load product ────────────────────────────────────────── */
  const loadProduct = useCallback(async () => {
    if (!slug || slug === "undefined") {
      setError("Invalid product link.");
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `${API}/product/slug/${encodeURIComponent(slug)}`,
        { signal: controller.signal }
      );

      if (res.status === 404) throw new Error("Product not found");
      if (!res.ok)            throw new Error("Could not load product");

      const data: Product = await res.json();
      setProduct(data);
      addSingleProduct?.(data);
      setFav(!!loadFavs()[String(data.id)]);
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [slug, addSingleProduct]);

  useEffect(() => {
    loadProduct();
    return () => abortRef.current?.abort();
  }, [loadProduct]);

  /* ── secondary fetches (parallel) ───────────────────────── */
  useEffect(() => {
    if (!product?.id) return;
    const { id, seller_id, category_id } = product;

    Promise.allSettled([
      fetch(`${API}/product/products/${id}/view`, { method: "POST" }),

      seller_id &&
        fetch(`${API}/seller/${seller_id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => { if (d) setSeller(d.seller || d); }),

      seller_id &&
        fetch(
          `${API}/product/by-seller?${new URLSearchParams({
            seller_id: String(seller_id),
            exclude:   String(id),
            limit:     "12",
          })}`
        )
          .then((r) => (r.ok ? r.json() : []))
          .then((d) => setMoreSeller(Array.isArray(d) ? d : [])),

      category_id &&
        fetch(
          `${API}/product/similar?${new URLSearchParams({
            category_id: String(category_id),
            exclude:     String(id),
            limit:       "12",
          })}`
        )
          .then((r) => (r.ok ? r.json() : []))
          .then((d) => setSimilar(Array.isArray(d) ? d : [])),
    ]).catch(() => {});
  }, [product?.id, product?.seller_id, product?.category_id]);

  /* ── reviews ─────────────────────────────────────────────── */
  const loadReviews = useCallback(
    async (page = 1) => {
      if (!slug) return;
      try {
        const res = await fetch(
          `${API}/product/slug/${encodeURIComponent(slug)}/reviews` +
            `?limit=${REVIEWS_LIMIT}&page=${page}`
        );
        if (!res.ok) return;
        const data = await res.json();

        setReviews((prev) =>
          page === 1
            ? data.reviews || []
            : [...prev, ...(data.reviews || [])]
        );
        if (data.stats) {
          setReviewStats(data.stats);
          setReviewTotal(data.stats.total || 0);
        }
      } catch {}
    },
    [slug]
  );

  useEffect(() => { loadReviews(1); }, [loadReviews]);

  /* ── actions ─────────────────────────────────────────────── */
  const toggleFav = useCallback(() => {
    if (!product?.id) return;
    const next = !fav;
    setFav(next);

    const favs = loadFavs();
    if (next) favs[String(product.id)] = true;
    else      delete favs[String(product.id)];
    saveFavs(favs);

    if (!userId) return;

    if (favTimerRef.current) clearTimeout(favTimerRef.current);
    favTimerRef.current = setTimeout(() => {
      fetch(`${API}/product/products/${product.id}/favorite`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ user_id: userId }),
      }).catch(() => {
        setFav(!next);
        const rollback = loadFavs();
        if (!next) rollback[String(product.id)] = true;
        else       delete rollback[String(product.id)];
        saveFavs(rollback);
      });
    }, FAV_DEBOUNCE);
  }, [fav, product, userId]);

  const openWhatsApp = useCallback(() => {
    if (!product) return;
    fetch(`${API}/product/products/${product.id}/click`, { method: "POST" })
      .catch(() => {});

    const waNumber = product.whatsapp || product.contact?.whatsapp;
    const waLink   = product.whatsapp_link || product.contact?.whatsapp_link;
    const msg      = encodeURIComponent(
      `Hi, I'm interested in: ${product.title} — ${window.location.href}`
    );
    const url =
      waLink ||
      (waNumber
        ? `https://wa.me/${waNumber.replace(/\D/g, "")}?text=${msg}`
        : null);

    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }, [product]);

  const openCall = useCallback(() => {
    const phone = product?.phone || product?.contact?.phone;
    if (phone) window.location.href = `tel:${phone}`;
  }, [product]);

  const openChat = useCallback(async () => {
    if (!userId) {
      navigate(`/auth?redirect=/product/${encodeURIComponent(slug || "")}`);
      return;
    }
    if (isOwn || !product?.seller_id) return;

    setChatBusy(true);
    setChatError(null);

    try {
      const res = await fetch(`${API}/conversations`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...authH() },
        body:    JSON.stringify({
          buyerId:   userId,
          sellerId:  product.seller_id,
          productId: product.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Server error");

      const threadId = data.thread_id || data.id;
      if (!threadId) throw new Error("No thread ID returned");

      navigate(`/chat/${threadId}`);
    } catch (err: unknown) {
      setChatError((err as Error).message || "Could not open chat.");
    } finally {
      setChatBusy(false);
    }
  }, [userId, isOwn, product, slug, navigate]);

  const goProduct = useCallback(
    (p: Product) => { navigate(`/product/${p.slug || p.id}`); },
    [navigate]
  );

  const dismissChatError = useCallback(() => setChatError(null), []);

  const handleLoadMoreReviews = useCallback(() => {
    const next = reviewPage + 1;
    setReviewPage(next);
    loadReviews(next);
  }, [reviewPage, loadReviews]);

  const handleReviewDone = useCallback(() => {
    setReviewPage(1);
    loadReviews(1);
  }, [loadReviews]);

  return {
    product, seller, similar, moreSeller,
    reviews, reviewStats, reviewTotal, reviewPage,
    loading, error, fav, chatBusy, chatError,
    isOwn, userId, slug,
    toggleFav, openWhatsApp, openCall, openChat,
    goProduct, loadReviews, dismissChatError,
    handleLoadMoreReviews, handleReviewDone,
  };
}
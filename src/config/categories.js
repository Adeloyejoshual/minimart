// src/config/categories.js
//
// v2 — Now supports hierarchical tree
// ─────────────────────────────────────
// - Hardcoded flat list (fallback if API fails)
// - API loader for full tree
// - Helper functions for navigation

import axios from "axios";

/* ═══════════════════════════════════════════════════════════════
   FALLBACK: Hardcoded flat categories (top-level only)
   Used when API is unavailable or offline
═══════════════════════════════════════════════════════════════ */
export const CATEGORIES_FALLBACK = [
  { id: "85d13ecd-a84a-4c39-8358-db890206e280", name: "Art & Collectibles",           slug: "art-collectibles",           level: 1, parent_id: null, icon: "🎨" },
  { id: "754e63f4-7e20-483c-a9c2-6782e615bd2d", name: "Babies & Kids",                slug: "babies-kids",                level: 1, parent_id: null, icon: "👶" },
  { id: "4aba6a69-2b1c-4b19-9ca0-3b2630ef6fdb", name: "Beauty & Personal Care",       slug: "beauty-personal-care",       level: 1, parent_id: null, icon: "💄" },
  { id: "947ce100-d961-4455-bfbf-c1d33537f11b", name: "Books & Stationery",           slug: "books-stationery",           level: 1, parent_id: null, icon: "📚" },
  { id: "39dc4492-0754-4826-816b-bc32f31081d0", name: "Commercial Equipment & Tools", slug: "commercial-equipment",       level: 1, parent_id: null, icon: "🛠️" },
  { id: "fc1acba9-a5ca-4a82-8305-81586ecb75e1", name: "Computers & Laptops",          slug: "computers-laptops",          level: 1, parent_id: null, icon: "💻" },
  { id: "bba9b3e7-4118-42c4-9ea9-4aa2afd445dc", name: "Electronics",                  slug: "electronics",                level: 1, parent_id: null, icon: "📺" },
  { id: "8ba64fb7-33a6-415e-a895-38d778a49075", name: "Fashion",                      slug: "fashion",                    level: 1, parent_id: null, icon: "👗" },
  { id: "cf185f2a-d291-40cc-8694-67291f1a6a26", name: "Food, Agriculture & Farming",  slug: "food-agriculture",           level: 1, parent_id: null, icon: "🌾" },
  { id: "b236303d-3ccf-4169-8321-81243d796481", name: "Gaming",                       slug: "gaming",                     level: 1, parent_id: null, icon: "🎮" },
  { id: "6609d41f-7fd5-469d-8155-9a7c0a7d05f3", name: "Health & Fitness",             slug: "health-fitness",             level: 1, parent_id: null, icon: "🏋️" },
  { id: "4bb82894-f6aa-478a-8541-da3305d5a293", name: "Home, Furniture & Appliances", slug: "home-furniture-appliances",  level: 1, parent_id: null, icon: "🏠" },
  { id: "3079d791-8695-47ef-aaa1-78b9eabb32fe", name: "Jobs",                         slug: "jobs",                       level: 1, parent_id: null, icon: "💼" },
  { id: "4d13f1aa-bd53-49a1-9e86-cf33ece1b254", name: "Leisure & Activities",         slug: "leisure-activities",         level: 1, parent_id: null, icon: "🎯" },
  { id: "f1c8a3d5-7e2b-4d9f-8a6c-3b5e4f1d9a2c", name: "Miscellaneous / Others",       slug: "miscellaneous",              level: 1, parent_id: null, icon: "📦" },
  { id: "a4b7c2d9-1e3f-4a8c-9b6d-5f2e1a8c3b7d", name: "Mobile & Tech Accessories",   slug: "mobile-tech-accessories",    level: 1, parent_id: null, icon: "🔌" },
  { id: "e6d02486-ce55-4718-a096-6af8001d4a2c", name: "Musical Instruments",          slug: "musical-instruments",        level: 1, parent_id: null, icon: "🎹" },
  { id: "e70d46b2-9450-42ee-a938-4235c319b8b3", name: "Pets",                         slug: "pets",                       level: 1, parent_id: null, icon: "🐶" },
  { id: "102055d1-180a-4b8f-a39b-3b20a4838e90", name: "Phones & Tablets",             slug: "phones-tablets",             level: 1, parent_id: null, icon: "📱" },
  { id: "c96bba5b-a9f8-43ed-8dbb-3326f34e07c0", name: "Property",                     slug: "property",                   level: 1, parent_id: null, icon: "🏡" },
  { id: "46f8dcab-69d0-4fa0-aead-f9ab6c64c139", name: "Repair & Construction",        slug: "repair-construction",        level: 1, parent_id: null, icon: "🔧" },
  { id: "d6b767d7-1f3b-46cc-9e67-00b699e4ec04", name: "Seeking Work CVs",             slug: "seeking-work-cvs",           level: 1, parent_id: null, icon: "📄" },
  { id: "20371324-5130-4952-91ed-29cf67c93f72", name: "Services",                     slug: "services",                   level: 1, parent_id: null, icon: "🛎️" },
  { id: "3c93ad90-2b69-4072-b2cb-748384f44d3f", name: "Sports & Outdoors",            slug: "sports-outdoors",            level: 1, parent_id: null, icon: "⚽" },
  { id: "d30edb05-1f94-41e6-9400-6f8d8252a29b", name: "Toys & Games",                 slug: "toys-games",                 level: 1, parent_id: null, icon: "🧸" },
  { id: "b2345835-2bf3-4749-a1e9-760e8159ecc6", name: "Vehicles",                     slug: "vehicles",                   level: 1, parent_id: null, icon: "🚗" },
  { id: "cb32087f-c235-466e-9e75-6fbee393903b", name: "Vehicles Parts & Accessories", slug: "vehicles-parts-accessories", level: 1, parent_id: null, icon: "⚙️" },
  { id: "e5a9f2c1-8b4d-4e7a-a3c6-5b9d1e2f8a4c", name: "Watches, Jewelry & Accessories", slug: "watches-jewelry",          level: 1, parent_id: null, icon: "⌚" },
];

/* Default export = flat fallback (drop-in replacement) */
export default CATEGORIES_FALLBACK;

/* ═══════════════════════════════════════════════════════════════
   API — Fetch full tree (with sub-categories)
═══════════════════════════════════════════════════════════════ */
const BASE = import.meta.env.VITE_API_BASE_URL;
const API  = `${BASE}/api/categories`;

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/* Fetch all categories from server */
export async function fetchAllCategories(force = false) {
  const now = Date.now();
  if (!force && _cache && (now - _cacheTime < CACHE_TTL)) {
    return _cache;
  }

  try {
    const res = await axios.get(API, { timeout: 8_000 });
    const data = res.data?.data ?? [];
    _cache     = data;
    _cacheTime = now;
    return data;
  } catch (err) {
    console.warn("[categories] Fetch failed, using fallback:", err.message);
    return CATEGORIES_FALLBACK;
  }
}

/* Fetch breadcrumb trail for a category */
export async function fetchBreadcrumb(categoryId) {
  if (!categoryId) return [];
  try {
    const res = await axios.get(`${API}/${categoryId}/breadcrumb`, {
      timeout: 5_000,
    });
    return res.data?.data ?? [];
  } catch {
    return [];
  }
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS — Client-side tree navigation
═══════════════════════════════════════════════════════════════ */

/**
 * Get direct children of a category
 * @param {Array} allCategories - flat list from API
 * @param {string|null} parentId - null = top-level
 */
export function getChildren(allCategories, parentId = null) {
  return allCategories
    .filter((c) => c.parent_id === parentId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/**
 * Get a category by ID
 */
export function findCategoryById(allCategories, id) {
  return allCategories.find((c) => c.id === id) ?? null;
}

/**
 * Get a category by slug
 */
export function findCategoryBySlug(allCategories, slug) {
  return allCategories.find((c) => c.slug === slug) ?? null;
}

/**
 * Build breadcrumb trail client-side (if you have full tree loaded)
 */
export function buildBreadcrumb(allCategories, categoryId) {
  const trail = [];
  let current = findCategoryById(allCategories, categoryId);

  while (current) {
    trail.unshift(current);
    current = current.parent_id
      ? findCategoryById(allCategories, current.parent_id)
      : null;
  }

  return trail;
}

/**
 * Get top-level categories only
 */
export function getTopLevel(allCategories) {
  return getChildren(allCategories, null);
}

/**
 * Check if category has children
 */
export function hasChildren(allCategories, categoryId) {
  return allCategories.some((c) => c.parent_id === categoryId);
}
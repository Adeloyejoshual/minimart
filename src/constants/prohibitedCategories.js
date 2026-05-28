// src/constants/prohibitedCategories.js

/**
 * Prohibited category identifiers shared between frontend validation,
 * backend moderation, and AI filtering pipelines.
 *
 * Keep this file in sync with the backend prohibited list.
 * Both systems should import from a shared source once a monorepo
 * or API-driven config is adopted.
 *
 * Usage:
 *   - Listing form validation
 *   - Category selector filtering
 *   - Upload/image moderation hooks
 *   - Admin moderation dashboard
 *   - AI keyword scanning pipeline
 */

export const PROHIBITED_CATEGORIES = [
  // ── Weapons & Dangerous Items ──────────────────────────────────────
  "firearms",
  "ammunition",
  "explosives",
  "dangerous_chemicals",
  "military_equipment",
  "police_equipment",

  // ── Controlled Substances ──────────────────────────────────────────
  "controlled_drugs",
  "unregistered_pharmaceuticals",
  "expired_medications",
  "prescription_without_authorization",

  // ── Fraud & Identity ───────────────────────────────────────────────
  "fake_documents",
  "forged_certificates",
  "stolen_goods",
  "counterfeit_currency",

  // ── Adult & Restricted Content ─────────────────────────────────────
  "adult_content",
  "human_remains",
  "live_animals_unpermitted",

  // ── Customs & Contraband ───────────────────────────────────────────
  "customs_prohibited_imports",
  "unverified_bulk_secondhand",

  // ── Property Fraud ─────────────────────────────────────────────────
  "property_without_ownership_proof",
  "unauthorized_land_listing",

  // ── Recalled & Banned Products ─────────────────────────────────────
  "government_banned_products",
  "recalled_consumer_goods",
];

/**
 * Maps category identifiers to human-readable labels.
 * Used in UI error messages and moderation dashboards.
 */
export const PROHIBITED_CATEGORY_LABELS = {
  firearms                       : "Firearms and Weapons",
  ammunition                     : "Ammunition and Explosives",
  explosives                     : "Explosives and Hazardous Materials",
  dangerous_chemicals            : "Dangerous Chemicals",
  military_equipment             : "Military Equipment",
  police_equipment               : "Police Equipment and Uniforms",
  controlled_drugs               : "Controlled Substances",
  unregistered_pharmaceuticals   : "Unregistered Pharmaceuticals",
  expired_medications            : "Expired Medications",
  prescription_without_authorization: "Unauthorized Prescription Drugs",
  fake_documents                 : "Fake or Forged Documents",
  forged_certificates            : "Forged Certificates",
  stolen_goods                   : "Stolen Goods",
  counterfeit_currency           : "Counterfeit Currency",
  adult_content                  : "Adult or Explicit Content",
  human_remains                  : "Human Remains or Body Parts",
  live_animals_unpermitted       : "Live Animals Without Permits",
  customs_prohibited_imports     : "Customs-Prohibited Imports",
  unverified_bulk_secondhand     : "Unverified Bulk Second-Hand Goods",
  property_without_ownership_proof: "Property Without Proof of Ownership",
  unauthorized_land_listing      : "Unauthorized Land or Property Listing",
  government_banned_products     : "Government-Banned Products",
  recalled_consumer_goods        : "Recalled Consumer Goods",
};

/**
 * Returns true if a given category identifier is prohibited.
 *
 * @param {string} categoryId
 * @returns {boolean}
 *
 * @example
 * isProhibitedCategory("firearms") // true
 * isProhibitedCategory("electronics") // false
 */
export function isProhibitedCategory(categoryId) {
  return PROHIBITED_CATEGORIES.includes(categoryId);
}

/**
 * Returns the human-readable label for a prohibited category.
 * Falls back to the raw identifier if no label is found.
 *
 * @param {string} categoryId
 * @returns {string}
 */
export function getProhibitedLabel(categoryId) {
  return PROHIBITED_CATEGORY_LABELS[categoryId] ?? categoryId;
}
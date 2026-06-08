/* ═══════════════════════════════════════════════════════════
   PostAds Utilities
   — Prohibited scanner
   — File hash (duplicate detection)
   — Performance helpers
═══════════════════════════════════════════════════════════ */

/* ─── Prohibited items scanner ─── */
const PROHIBITED = [
  /* Weapons */
  { pattern: /\b(gun|pistol|rifle|shotgun|firearm|weapon|ammo|ammunition|explosive|bomb|grenade|knife\s?blade|machete)\b/i, category: "Weapons & Dangerous Items" },
  /* Drugs */
  { pattern: /\b(cocaine|heroin|meth|cannabis|marijuana|weed|drug|narcotic|tramadol abuse|codeine syrup)\b/i, category: "Illegal Drugs" },
  /* Fake / counterfeit */
  { pattern: /\b(replica|fake|counterfeit|knockoff|pirated|clone watch|bootleg)\b/i, category: "Counterfeit Items" },
  /* Human trafficking */
  { pattern: /\b(human trafficking|organ|kidney for sale|blood for sale)\b/i, category: "Human Trafficking" },
  /* Scam keywords */
  { pattern: /\b(investment scheme|ponzi|pay upfront|western union only|bitcoin only|advance fee)\b/i, category: "Scam / Fraud" },
  /* Adult */
  { pattern: /\b(pornograph|escort service|sex service|adult only service)\b/i, category: "Adult Services" },
  /* Wildlife */
  { pattern: /\b(ivory|rhino horn|tiger skin|illegal wildlife|poached)\b/i, category: "Illegal Wildlife" },
  /* Stolen */
  { pattern: /\b(stolen|chop shop|IMEI removed|serial removed)\b/i, category: "Stolen Goods" },
];

const SUSPICIOUS = [
  { pattern: /\b(untraceable|no questions asked|cash only|no receipt|as is no return)\b/i, label: "Suspicious terms detected" },
  { pattern: /\b(whatsapp only|telegram only|contact outside)\b/i,                          label: "Off-platform contact attempt" },
  { pattern: /\b(urgent sale|leaving country|emergency sale)\b/i,                           label: "Urgency pressure tactic" },
];

/**
 * Scans title + description + features for prohibited content.
 * @returns {{ blocked: {text,category}[], suspicious: {text,label}[] }}
 */
export function scanForProhibited({ title = "", description = "", keyFeatures = [] }) {
  const corpus = [title, description, ...keyFeatures].join(" ");

  const blocked = PROHIBITED
    .filter((r) => r.pattern.test(corpus))
    .map((r) => ({
      text:     corpus.match(r.pattern)?.[0] ?? "flagged term",
      category: r.category,
    }));

  const suspicious = SUSPICIOUS
    .filter((r) => r.pattern.test(corpus))
    .map((r) => ({
      text:  corpus.match(r.pattern)?.[0] ?? "flagged term",
      label: r.label,
    }));

  return { blocked, suspicious };
}

/* ─── File hash using SubtleCrypto (SHA-256) ─── */
/**
 * Returns a hex SHA-256 hash of a File object.
 * Used for true duplicate detection (not URL comparison).
 */
export async function hashFile(file) {
  try {
    const buf    = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    /* Fallback: name+size+lastModified */
    return `${file.name}-${file.size}-${file.lastModified}`;
  }
}

/* ─── Normalize text ─── */
export const normalize = (s = "") => String(s).replace(/\s+/g, " ").trim();

/* ─── Unique array ─── */
export const uniq = (arr) => [...new Set(arr.filter(Boolean))];
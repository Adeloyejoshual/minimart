/**
 * services/location.js
 *
 * Minimart Delivery Zones — v2
 * ─────────────────────────────────────────────────────────
 * ✓ Coverage: Osun State + Ondo State (Ondo Town ONLY)
 * ✓ Phone validation handles +234 / 0 prefixes
 * ✓ Bus stop terminology aligned with UI (was "landmark")
 * ✓ Normalisation strips international format on save
 * ✓ Pure functions — no DB, no side effects, easily testable
 */

/* ══════════════════════════════════════════════════════════════
   DELIVERY ZONES
   ─────────────────────────────────────────────────────────────
   Source of truth for allowed states + cities.
   Frontend fetches this via GET /api/checkout/address/zones
   so state and city dropdowns always stay in sync with the
   backend without duplicating the list.
══════════════════════════════════════════════════════════════ */
export const DELIVERY_ZONES = {
  Osun: {
    label:  "Osun State",
    cities: [
      "Osogbo",
      "Ile-Ife",
      "Ilesa",
      "Ede",
      "Iwo",
      "Ikirun",
      "Ikire",
      "Erin-Osun",
      "Gbongan",
      "Inisa",
      "Okuku",
      "Ifon-Osun",
    ],
  },
  Ondo: {
    label:  "Ondo State",
    cities: [
      "Ondo Town",   /* STRICT — only city in Ondo State */
    ],
  },
};

export const ALLOWED_STATES = Object.keys(DELIVERY_ZONES);

/* ══════════════════════════════════════════════════════════════
   ZONE LOOKUPS
══════════════════════════════════════════════════════════════ */
export function getCitiesForState(state) {
  return DELIVERY_ZONES[state]?.cities ?? [];
}

export function isStateAllowed(state) {
  return !!DELIVERY_ZONES[state];
}

export function isCityAllowed(state, city) {
  return getCitiesForState(state).includes(city);
}

/* ══════════════════════════════════════════════════════════════
   PHONE NORMALISATION
   ─────────────────────────────────────────────────────────────
   Accepts any of these formats and returns the canonical
   11-digit Nigerian format (0XXXXXXXXXX):
     +2348012345678  →  08012345678
     2348012345678   →  08012345678
     08012345678     →  08012345678
     0 8012345678    →  08012345678   (spaces/dashes stripped)
══════════════════════════════════════════════════════════════ */
export function normalizePhone(raw = "") {
  let c = String(raw).trim().replace(/[\s\-()]/g, "");
  if (c.startsWith("+234")) c = "0" + c.slice(4);
  if (c.startsWith("234") && c.length === 13) c = "0" + c.slice(3);
  return c;
}

export function isValidPhone(phone) {
  const c = normalizePhone(phone);
  return /^0[7-9][01]\d{8}$/.test(c);
}

/* ══════════════════════════════════════════════════════════════
   FAKE INPUT DETECTION
   ─────────────────────────────────────────────────────────────
   Catches obvious placeholder text like "abc", "test", "aaaa"
   before it gets stored in the DB. Matches the frontend rules
   so users see the same error on both sides.
══════════════════════════════════════════════════════════════ */
const FAKE_PATTERNS = [
  /^(abc|xyz|test|house|street|road|address|home|here|there|nil|na|none|bus|stop|busstop)$/i,
  /^(.)\1{4,}$/,      /* aaaaa, 11111 */
  /^[0-9]+$/,          /* pure digits */
  /^[a-z]{1,3}$/i,     /* 1-3 letters */
];

function isFakeValue(value = "", minLen = 5) {
  const t = String(value).trim();
  if (t.length < minLen) return true;
  return FAKE_PATTERNS.some((p) => p.test(t));
}

/* ══════════════════════════════════════════════════════════════
   ADDRESS VALIDATION
   ─────────────────────────────────────────────────────────────
   Full address shape:
   {
     id, user_id,
     label,
     recipient_name, phone,
     state, city,
     address_line,
     bus_stop, landmark,        ← same value, dual-write
     additional_directions,
     call_before_delivery,
     is_default,
     last_used_at,
     created_at, updated_at
   }

   Returns:
     { valid: boolean, errors: { field: message } }
══════════════════════════════════════════════════════════════ */
export function validateAddress(address) {
  const errors = {};

  /* ── Recipient name ── */
  if (!address.recipient_name?.trim()) {
    errors.recipient_name = "Recipient name is required";
  } else if (address.recipient_name.trim().length < 2) {
    errors.recipient_name = "Enter the recipient's full name";
  }

  /* ── Phone ── */
  if (!address.phone?.trim()) {
    errors.phone = "Phone number is required";
  } else if (!isValidPhone(address.phone)) {
    errors.phone = "Enter a valid Nigerian number (e.g. 08012345678)";
  }

  /* ── State ── */
  if (!address.state?.trim()) {
    errors.state = "State is required";
  } else if (!isStateAllowed(address.state)) {
    errors.state =
      `We don't deliver to ${address.state} yet. ` +
      `We cover Osun and Ondo States.`;
  }

  /* ── City ── */
  if (!address.city?.trim()) {
    errors.city = "City is required";
  } else if (address.state && !isCityAllowed(address.state, address.city)) {
    errors.city =
      address.state === "Ondo"
        ? "We only deliver to Ondo Town in Ondo State"
        : `We don't deliver to ${address.city} yet`;
  }

  /* ── Street address ── */
  if (!address.address_line?.trim()) {
    errors.address_line = "Street address is required";
  } else if (isFakeValue(address.address_line, 10)) {
    errors.address_line =
      "Enter a real address (e.g. No. 5, Oba Adesida Road)";
  }

  /*
   * ── Bus stop ──
   * The frontend calls this "bus stop" but the DB column is
   * "landmark" for legacy reasons. We accept either field name
   * here — the route layer passes whichever the user sent.
   */
  const busStopValue = address.bus_stop || address.landmark;

  if (!busStopValue?.trim()) {
    errors.bus_stop =
      "Bus stop is required — helps our rider find you";
  } else if (isFakeValue(busStopValue, 5)) {
    errors.bus_stop =
      "Enter a real bus stop (e.g. Oja Oba bus stop, Olaiya junction)";
  }

  /* additional_directions and call_before_delivery are optional */

  return {
    valid:  Object.keys(errors).length === 0,
    errors,
  };
}

/* ══════════════════════════════════════════════════════════════
   NORMALISE INCOMING BODY BEFORE DB WRITE
   ─────────────────────────────────────────────────────────────
   Trims strings, applies phone normalisation, converts empty
   strings to null where appropriate.
══════════════════════════════════════════════════════════════ */
export function normalizeAddress(raw) {
  return {
    label:                 raw.label?.trim()                    || "Home",
    recipient_name:        raw.recipient_name?.trim()           || "",
    phone:                 normalizePhone(raw.phone ?? ""),
    state:                 raw.state?.trim()                    || "",
    city:                  raw.city?.trim()                     || "",
    address_line:          raw.address_line?.trim()             || "",
    bus_stop:              (raw.bus_stop || raw.landmark)?.trim() || "",
    landmark:              (raw.landmark || raw.bus_stop)?.trim() || "",
    additional_directions: raw.additional_directions?.trim()    || null,
    call_before_delivery:  raw.call_before_delivery             ?? false,
    is_default:            raw.is_default                       ?? false,
  };
}

/* ══════════════════════════════════════════════════════════════
   COVERAGE MESSAGE (UI helper)
══════════════════════════════════════════════════════════════ */
export function getCoverageMessage() {
  return "Osun State & Ondo State (Ondo Town only)";
}
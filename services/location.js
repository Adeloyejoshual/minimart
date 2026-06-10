/**
 * services/location.js
 *
 * Minimart Delivery Zones — Version 1
 * Coverage: Osun State + Ondo State (Ondo Town ONLY)
 */

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
      "Ondo Town",   /* STRICT — only city in Ondo */
    ],
  },
};

export const ALLOWED_STATES = Object.keys(DELIVERY_ZONES);

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
   ADDRESS VALIDATION
   Full structure:
   {
     id, user_id,
     label,
     recipient_name, phone,
     state, city,
     address_line, landmark, additional_directions,
     call_before_delivery,
     is_default,
     created_at, updated_at
   }
══════════════════════════════════════════════════════════════ */
export function validateAddress(address) {
  const errors = {};

  /* ── Recipient name ── */
  if (!address.recipient_name?.trim())
    errors.recipient_name = "Recipient name is required";

  /* ── Phone number ── */
  if (!address.phone?.trim()) {
    errors.phone = "Phone number is required";
  } else {
    const cleaned = address.phone.trim().replace(/[\s\-\(\)]/g, "");
    if (!/^0[789][01]\d{8}$/.test(cleaned)) {
      errors.phone = "Enter a valid Nigerian number e.g. 08012345678";
    }
  }

  /* ── State — must be from controlled list ── */
  if (!address.state?.trim()) {
    errors.state = "State is required";
  } else if (!isStateAllowed(address.state)) {
    errors.state = `We don't deliver to ${address.state} yet. We cover Osun and Ondo States.`;
  }

  /* ── City — must be from controlled list ── */
  if (!address.city?.trim()) {
    errors.city = "City / area is required";
  } else if (address.state && !isCityAllowed(address.state, address.city)) {
    errors.city =
      address.state === "Ondo"
        ? "We only deliver to Ondo Town in Ondo State"
        : `We don't deliver to ${address.city} yet`;
  }

  /* ── Street address ── */
  if (!address.address_line?.trim())
    errors.address_line = "Street address is required";

  /* ── Landmark — REQUIRED, critical for Nigerian delivery ── */
  if (!address.landmark?.trim()) {
    errors.landmark =
      "Landmark is required — e.g. 'Beside First Bank bus stop'";
  } else if (address.landmark.trim().length < 5) {
    errors.landmark =
      "Please be more specific — e.g. 'Opposite GTBank, after Oja Oba Market'";
  }

  /* additional_directions and call_before_delivery are optional */

  return {
    valid:  Object.keys(errors).length === 0,
    errors,
  };
}

/* ── Normalize before saving ── */
export function normalizeAddress(raw) {
  return {
    label:                 raw.label?.trim()                  || "Home",
    recipient_name:        raw.recipient_name?.trim()         || "",
    phone:                 raw.phone?.trim().replace(/[\s\-\(\)]/g, "") || "",
    state:                 raw.state?.trim()                  || "",
    city:                  raw.city?.trim()                   || "",
    address_line:          raw.address_line?.trim()           || "",
    landmark:              raw.landmark?.trim()               || "",
    additional_directions: raw.additional_directions?.trim()  || null,
    call_before_delivery:  raw.call_before_delivery           ?? false,
    is_default:            raw.is_default                     ?? false,
  };
}

export function getCoverageMessage() {
  return "Osun State & Ondo State (Ondo Town only)";
}
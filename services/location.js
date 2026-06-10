/**
 * services/location.js
 *
 * Minimart Delivery Zones — Version 1
 *
 * Current coverage:
 *   ✅ Osun State  — multiple cities and LGAs
 *   ✅ Ondo State  — Ondo Town ONLY (strict limit)
 *
 * Rules:
 *   ❌ No free typing for state or city
 *   ❌ No uncontrolled address inputs
 *   ✅ Landmark is REQUIRED (critical for Nigerian delivery)
 *   ✅ All dropdowns are controlled from this file
 *   ✅ Ondo State is strictly limited to Ondo Town
 */

/* ══════════════════════════════════════════════════════════════
   DELIVERY ZONES
   Structure:
     state → cities[] → { city, lgas[] }
══════════════════════════════════════════════════════════════ */
export const DELIVERY_ZONES = {

  /* ── Osun State ─────────────────────────────────────────── */
  Osun: {
    label: "Osun State",
    cities: [
      {
        city: "Osogbo",
        lgas: [
          "Osogbo",
          "Olorunda",
          "Boripe",
          "Ola-Oluwa",
        ],
      },
      {
        city: "Ile-Ife",
        lgas: [
          "Ife Central",
          "Ife East",
          "Ife North",
          "Ife South",
          "Ilife-Odan",
        ],
      },
      {
        city: "Ilesa",
        lgas: [
          "Ilesa East",
          "Ilesa West",
          "Oriade",
          "Obokun",
        ],
      },
      {
        city: "Ede",
        lgas: [
          "Ede North",
          "Ede South",
          "Egbedore",
        ],
      },
      {
        city: "Iwo",
        lgas: [
          "Iwo",
          "Ejigbo",
          "Ayedire",
        ],
      },
      {
        city: "Ikirun",
        lgas: [
          "Ifelodun",
        ],
      },
      {
        city: "Ikire",
        lgas: [
          "Irewole",
          "Isokan",
          "Ayedaade",
        ],
      },
      {
        city: "Erin-Osun",
        lgas: [
          "Irepodun",
        ],
      },
      {
        city: "Gbongan",
        lgas: [
          "Ayedaade",
          "Orolu",
        ],
      },
      {
        city: "Inisa",
        lgas: [
          "Odo-Otin",
        ],
      },
      {
        city: "Okuku",
        lgas: [
          "Odo-Otin",
        ],
      },
      {
        city: "Ifon-Osun",
        lgas: [
          "Odo-Otin",
        ],
      },
    ],
  },

  /* ── Ondo State — STRICT: Ondo Town ONLY ────────────────── */
  Ondo: {
    label: "Ondo State",
    cities: [
      {
        city: "Ondo Town",      /* ONLY city allowed in Ondo */
        lgas: [
          "Ondo West",
          "Ondo East",
        ],
      },
      /* ⚠️  DO NOT ADD more Ondo cities until coverage is confirmed */
    ],
  },

};

/* ══════════════════════════════════════════════════════════════
   DERIVED HELPERS
══════════════════════════════════════════════════════════════ */

/** All allowed state names */
export const ALLOWED_STATES = Object.keys(DELIVERY_ZONES);

/** Get all cities for a state */
export function getCitiesForState(state) {
  return DELIVERY_ZONES[state]?.cities ?? [];
}

/** Get all LGAs for a state + city */
export function getLGAsForCity(state, city) {
  const zone    = DELIVERY_ZONES[state];
  if (!zone) return [];
  const cityObj = zone.cities.find((c) => c.city === city);
  return cityObj?.lgas ?? [];
}

/** Check if a state is in our delivery zone */
export function isStateAllowed(state) {
  return !!DELIVERY_ZONES[state];
}

/** Check if a city is allowed within a state */
export function isCityAllowed(state, city) {
  return getCitiesForState(state).some((c) => c.city === city);
}

/** Check if an LGA is valid for a state + city */
export function isLGAAllowed(state, city, lga) {
  if (!lga) return true; /* LGA is optional */
  return getLGAsForCity(state, city).includes(lga);
}

/* ══════════════════════════════════════════════════════════════
   ADDRESS VALIDATION
   Called on both frontend and backend.
   Landmark is REQUIRED — non-negotiable for Nigerian delivery.
══════════════════════════════════════════════════════════════ */
export function validateAddress(address) {
  const errors = {};

  /* ── Personal info ── */
  if (!address.recipient_name?.trim())
    errors.recipient_name = "Recipient name is required";

  if (!address.phone?.trim())
    errors.phone = "Phone number is required";
  else if (!/^0[7-9][01]\d{8}$/.test(address.phone.trim()))
    errors.phone = "Enter a valid Nigerian phone number (e.g. 08012345678)";

  /* ── Street address ── */
  if (!address.address_line?.trim())
    errors.address_line = "Street address is required";

  /* ── Landmark — CRITICAL ── */
  if (!address.landmark?.trim())
    errors.landmark = "Landmark is required — e.g. 'Opposite First Bank, beside bus stop'";
  else if (address.landmark.trim().length < 10)
    errors.landmark = "Please provide a more detailed landmark for easier delivery";

  /* ── State — must be from allowed zones ── */
  if (!address.state?.trim()) {
    errors.state = "State is required";
  } else if (!isStateAllowed(address.state)) {
    errors.state = `Sorry, we don't deliver to ${address.state} yet. We currently cover Osun and Ondo States.`;
  }

  /* ── City — must come from controlled dropdown ── */
  if (!address.city?.trim()) {
    errors.city = "City is required";
  } else if (address.state && !isCityAllowed(address.state, address.city)) {
    if (address.state === "Ondo") {
      errors.city = "We only deliver to Ondo Town in Ondo State";
    } else {
      errors.city = `We don't deliver to ${address.city} in ${address.state} yet`;
    }
  }

  /* ── LGA — optional but must be valid if provided ── */
  if (address.lga && address.state && address.city) {
    if (!isLGAAllowed(address.state, address.city, address.lga)) {
      errors.lga = `${address.lga} is not a valid LGA for ${address.city}`;
    }
  }

  return {
    valid:  Object.keys(errors).length === 0,
    errors,
  };
}

/* ══════════════════════════════════════════════════════════════
   ADDRESS NORMALIZER
   Trims and sanitizes all fields before DB insert.
   Prevents whitespace-only values being saved.
══════════════════════════════════════════════════════════════ */
export function normalizeAddress(raw) {
  return {
    label:          raw.label?.trim()          || "Home",
    recipient_name: raw.recipient_name?.trim() || "",
    phone:          raw.phone?.trim()          || "",
    address_line:   raw.address_line?.trim()   || "",
    landmark:       raw.landmark?.trim()       || "",
    state:          raw.state?.trim()          || "",
    city:           raw.city?.trim()           || "",
    lga:            raw.lga?.trim()            || null,
    is_default:     raw.is_default             ?? false,
  };
}

/* ══════════════════════════════════════════════════════════════
   COVERAGE MESSAGE
   Used in UI to tell buyers where we deliver.
══════════════════════════════════════════════════════════════ */
export function getCoverageMessage() {
  return {
    states:  ALLOWED_STATES,
    summary: "We currently deliver to Osun State (Osogbo, Ile-Ife, Ilesa & more) and Ondo State (Ondo Town only).",
    note:    "More states coming soon.",
  };
}
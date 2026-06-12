// src/pages/Checkout/validators/addressValidator.js

export function validatePhone(phone = "") {
  const cleaned = phone.replace(/[\s\-]/g, "");
  if (!cleaned) return "Phone number is required";
  if (!/^(0[7-9][01]\d{8}|234[7-9][01]\d{8})$/.test(cleaned)) {
    return "Enter a valid phone number (e.g. 08012345678)";
  }
  return null;
}

const FAKE_PATTERNS = [
  /^(abc|xyz|test|house|street|road|address|home|here|there|nil|na|none|bus|stop)$/i,
  /^(.)\1{4,}$/,
  /^[0-9]+$/,
  /^[a-z]{1,3}$/i,
];

export function isFakeText(value = "", minLen = 5, minWords = 1) {
  const t = value.trim();
  if (t.length < minLen) return true;
  if (FAKE_PATTERNS.some((p) => p.test(t))) return true;
  const words = t.split(/\s+/).filter((w) => w.length > 1).length;
  return words < minWords;
}

export function isDuplicate(form, existing = [], excludeId = null) {
  return existing.some((a) => {
    if (excludeId && a.id === excludeId) return false;
    return (
      a.address_line?.toLowerCase().trim() ===
        form.address_line?.toLowerCase().trim() &&
      a.bus_stop?.toLowerCase().trim() ===
        form.bus_stop?.toLowerCase().trim()
    );
  });
}

export function validateForm(form, allAddresses = [], editingId = null) {
  const errors = {};

  if (!form.recipient_name?.trim()) {
    errors.recipient_name = "Recipient name is required";
  } else if (form.recipient_name.trim().length < 2) {
    errors.recipient_name = "Enter a full name";
  }

  const phoneErr = validatePhone(form.phone);
  if (phoneErr) errors.phone = phoneErr;

  if (!form.state?.trim()) {
    errors.state = "Select a state";
  }

  if (!form.city?.trim()) {
    errors.city = "Select a city";
  }

  if (!form.address_line?.trim()) {
    errors.address_line = "Street address is required";
  } else if (isFakeText(form.address_line, 10, 2)) {
    errors.address_line =
      "Enter a real address (e.g. No. 5, Oba Adesida Road)";
  }

  // Bus stop — the most important field for delivery
  if (!form.bus_stop?.trim()) {
    errors.bus_stop =
      "Bus stop is required — our rider needs this to find your area";
  } else if (isFakeText(form.bus_stop, 5, 1)) {
    errors.bus_stop =
      "Enter a real bus stop name (e.g. Oja Oba bus stop)";
  }

  if (
    !errors.address_line &&
    !errors.bus_stop &&
    isDuplicate(form, allAddresses, editingId)
  ) {
    errors.address_line = "This address is already saved";
  }

  return {
    valid:  Object.keys(errors).length === 0,
    errors,
  };
}
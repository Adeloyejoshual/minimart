/**
 * src/pages/Checkout/utils/deliveryDates.js
 *
 * Calculates delivery date ranges based on business days.
 * Skips Sundays automatically (Loemart Express doesn't deliver Sundays).
 *
 * Usage:
 *   getDeliveryRange()           → { start, end, label }
 *   getDeliveryRange({ min: 3 }) → 3 business days minimum
 */

/* ═══════════════════════════════════════════════════════════════
   CONFIG — adjust these to match your actual delivery SLA
═══════════════════════════════════════════════════════════════ */
const DEFAULT_MIN_DAYS = 3;   /* Earliest delivery: 3 business days */
const DEFAULT_MAX_DAYS = 7;   /* Latest delivery:   7 business days */

/*
 * Days the courier does NOT deliver.
 * 0 = Sunday, 6 = Saturday.
 * Currently: Sundays only (adjust if needed)
 */
const NON_DELIVERY_DAYS = new Set([0]);

/* Cutoff hour — orders placed AFTER this count from tomorrow */
const ORDER_CUTOFF_HOUR = 15;   /* 3:00 PM local time */

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */

/**
 * Add N business days to a date, skipping non-delivery days.
 * Returns a new Date — does not mutate input.
 */
function addBusinessDays(startDate, businessDays) {
  const date = new Date(startDate);
  let added  = 0;

  while (added < businessDays) {
    date.setDate(date.getDate() + 1);
    if (!NON_DELIVERY_DAYS.has(date.getDay())) {
      added++;
    }
  }

  return date;
}

/**
 * If the given date lands on a non-delivery day, roll forward
 * to the next available delivery day.
 */
function rollToDeliveryDay(date) {
  const d = new Date(date);
  while (NON_DELIVERY_DAYS.has(d.getDay())) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * Determine the base date for calculating delivery.
 * If order is placed after cutoff, count starts from tomorrow.
 */
function getOrderBaseDate(orderDate = new Date()) {
  const base = new Date(orderDate);
  if (base.getHours() >= ORDER_CUTOFF_HOUR) {
    base.setDate(base.getDate() + 1);
    base.setHours(0, 0, 0, 0);
  }
  return base;
}

/* ═══════════════════════════════════════════════════════════════
   FORMATTERS
═══════════════════════════════════════════════════════════════ */

/**
 * Format a date as "20 August" (day + month name).
 */
function formatDayMonth(date) {
  return new Intl.DateTimeFormat("en-NG", {
    day  : "numeric",
    month: "long",
  }).format(date);
}

/**
 * Format as short month only: "20 Aug"
 */
function formatDayMonthShort(date) {
  return new Intl.DateTimeFormat("en-NG", {
    day  : "numeric",
    month: "short",
  }).format(date);
}

/* ═══════════════════════════════════════════════════════════════
   PUBLIC API
═══════════════════════════════════════════════════════════════ */

/**
 * Get the delivery date range for an order.
 *
 * @param {Object} opts
 * @param {Date}   opts.orderDate  — when the order was placed (default: now)
 * @param {number} opts.min        — minimum business days (default: 3)
 * @param {number} opts.max        — maximum business days (default: 7)
 *
 * @returns {{
 *   start: Date,          // earliest delivery date
 *   end:   Date,          // latest delivery date
 *   label: string,        // "Delivery between 20 August and 24 August"
 *   short: string,        // "20 Aug — 24 Aug"
 *   isSameDay: boolean,   // true if start === end
 *   startFormatted: string, // "20 August"
 *   endFormatted:   string, // "24 August"
 * }}
 */
export function getDeliveryRange({
  orderDate = new Date(),
  min       = DEFAULT_MIN_DAYS,
  max       = DEFAULT_MAX_DAYS,
} = {}) {
  const base = getOrderBaseDate(orderDate);

  const rawStart = addBusinessDays(base, min);
  const rawEnd   = addBusinessDays(base, max);

  const start = rollToDeliveryDay(rawStart);
  const end   = rollToDeliveryDay(rawEnd);

  const startFormatted = formatDayMonth(start);
  const endFormatted   = formatDayMonth(end);

  const isSameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth()    === end.getMonth() &&
    start.getDate()     === end.getDate();

  const label = isSameDay
    ? `Delivery on ${startFormatted}`
    : `Delivery between ${startFormatted} and ${endFormatted}`;

  const short = isSameDay
    ? formatDayMonthShort(start)
    : `${formatDayMonthShort(start)} — ${formatDayMonthShort(end)}`;

  return {
    start,
    end,
    label,
    short,
    isSameDay,
    startFormatted,
    endFormatted,
  };
}

/**
 * Convenience wrapper that returns just the label string.
 */
export function getDeliveryLabel(opts) {
  return getDeliveryRange(opts).label;
}
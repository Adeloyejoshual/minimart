/**
 * scrollToError — scrolls to the first input with an error.
 *
 * @param {string} errorMessage - The validation error message
 * @param {Object} form         - The current form state
 *
 * It maps the error message to the relevant input field name,
 * finds the DOM element, scrolls to it, and focuses it.
 */

// Map validation messages → input CSS selectors
const ERROR_FIELD_MAP = {
  "Title required":                     'input[placeholder*="Product Title"], input[placeholder*="HP Pavilion"]',
  "Description required":               'textarea[placeholder*="Describe"]',
  "Enter a valid price":                'input[placeholder*="Enter price"]',
  "Category required":                  ".form-group:has(label:first-child)",
  "Enter a valid email":                'input[type="email"]',
  "Phone must be at least 10 digits":   'input[placeholder*="0801"]',
  "WhatsApp number required":           'input[placeholder*="0801"]:last-of-type',
  "At least one image required":        ".image-upload-box",
  "Select your state and city":         ".detect-location-btn",
  "Please accept the Terms":            ".terms-checkbox-row",
  "Enter valid delivery days":          'input[type="number"]',
  "Delivery end must be after start":   'input[type="number"]',
  "Enter a valid delivery fee":         'input[inputMode="numeric"]:last-of-type',
};

export function scrollToError(errorMessage) {
  if (!errorMessage) return;

  // Find the matching selector
  let targetSelector = null;

  for (const [key, selector] of Object.entries(ERROR_FIELD_MAP)) {
    if (errorMessage.includes(key) || key.includes(errorMessage)) {
      targetSelector = selector;
      break;
    }
  }

  // Fallback: try to find the first empty required input
  if (!targetSelector) {
    targetSelector = "input:invalid, textarea:invalid, .form-error";
  }

  // Short delay so the error message renders first
  requestAnimationFrame(() => {
    try {
      const el = document.querySelector(targetSelector);
      if (!el) return;

      el.scrollIntoView({
        behavior: "smooth",
        block:    "center",
      });

      // Focus the element if it's an input/textarea
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        setTimeout(() => el.focus(), 400);
      }

      // Flash effect so the user notices
      el.classList.add("field-error-flash");
      setTimeout(() => el.classList.remove("field-error-flash"), 2000);
    } catch {
      // Silently ignore — scroll is a nice-to-have, not critical
    }
  });
}
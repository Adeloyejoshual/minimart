/**
 * Product configuration
 * Steps, variants, draft key, API
 */

// ---------------- ENV ----------------
export const API = `${import.meta.env.VITE_API_BASE_URL}/api`;

// ---------------- STEPS ----------------
/**
 * Multi-step product form steps
 * Used to track progress and render step indicators
 */
export const STEPS = [
  { id: 1, label: "Photos",   icon: "camera"  },
  { id: 2, label: "Info",     icon: "tag"     },
  { id: 3, label: "Category", icon: "package" },
  { id: 4, label: "Variants", icon: "zap"     },
  { id: 5, label: "Pricing",  icon: "dollar"  },
  { id: 6, label: "Review",   icon: "file"    },
];

// ---------------- VARIANT ----------------
/**
 * Returns a blank variant object with a unique _id
 * Used when adding a new variant in the product form
 * @returns {Object} blank variant
 */
export const BLANK_VARIANT = () => ({
  _id: `${Date.now()}-${Math.random()}`,
  sku:        "",
  name:       "",
  price:      "",
  stock:      "1",
  attributes: {
    color:    "",
    size:     "",
    storage:  "",
    material: "",
  },
});

// ---------------- DRAFT ----------------
/**
 * LocalStorage key for saving product form draft
 * Increment version suffix when draft shape changes
 */
export const DRAFT_KEY = "add-product-draft-v2";

// ---------------- STEP HELPERS ----------------
/**
 * Get a step by ID
 * @param {number} id
 * @returns {Object|undefined}
 */
export function getStep(id) {
  return STEPS.find((s) => s.id === id);
}

/**
 * Get total number of steps
 * @returns {number}
 */
export function totalSteps() {
  return STEPS.length;
}

/**
 * Check if current step is the last step
 * @param {number} currentStep
 * @returns {boolean}
 */
export function isLastStep(currentStep) {
  return currentStep === STEPS.length;
}

/**
 * Check if current step is the first step
 * @param {number} currentStep
 * @returns {boolean}
 */
export function isFirstStep(currentStep) {
  return currentStep === 1;
}

/**
 * Get next step id — returns null if already last
 * @param {number} currentStep
 * @returns {number|null}
 */
export function nextStep(currentStep) {
  return isLastStep(currentStep) ? null : currentStep + 1;
}

/**
 * Get previous step id — returns null if already first
 * @param {number} currentStep
 * @returns {number|null}
 */
export function prevStep(currentStep) {
  return isFirstStep(currentStep) ? null : currentStep - 1;
}

// ---------------- DRAFT HELPERS ----------------
/**
 * Save draft to localStorage
 * @param {Object} data
 */
export function saveDraft(data) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("Failed to save draft:", err);
  }
}

/**
 * Load draft from localStorage
 * @returns {Object|null}
 */
export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("Failed to load draft:", err);
    return null;
  }
}

/**
 * Clear draft from localStorage
 */
export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (err) {
    console.error("Failed to clear draft:", err);
  }
}
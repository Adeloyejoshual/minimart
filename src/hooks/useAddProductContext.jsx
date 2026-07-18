/**
 * src/hooks/useAddProductContext.tsx
 * Context + Provider for sharing useAddProduct() result across shells & sections.
 *
 * Usage:
 *
 * // In wrapper (AddProductMobile / AddProductDesktop):
 *   const logic = useAddProduct({ user });
 *   return (
 *     <AddProductProvider value={logic}>
 *       <MobileShell />
 *     </AddProductProvider>
 *   );
 *
 * // In any child section:
 *   const { form, updateForm, handleSubmit } = useAddProductContext();
 */

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

/* ═══════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════ */

/** Shape of a single promotion plan */
export interface PromotionPlan {
  id               : string | number;
  name             : string;
  price            : number | string;
  effective_price? : number | string;
  discount_percent?: number;
  duration?        : string;
  description?     : string;
  features?        : string[];
}

/** Persisted payment session (localStorage) */
export interface PaymentSession {
  reference         : string;
  authUrl           : string;
  planId            : string;
  productId         : string;
  email             : string;
  amount            : number;
  createdAt         : number;
  needsVerification : boolean;
  activeUntil       : string | null;
  daysRemaining     : number | null;
}

/** Data passed to the verification nudge banner */
export interface VerificationData {
  productId     : string;
  activeUntil   : string | null;
  daysRemaining : number;
  message?      : string;
  limits?       : Record<string, unknown>;
}

/** Seller limit info returned from /seller/limits */
export interface SellerLimits {
  seller_verified  : boolean;
  daily_limit      : number;
  daily_used       : number;
  daily_remaining  : number;
  active_limit     : number;
  active_count     : number;
  active_remaining : number;
  cooldown_seconds : number;
  trial_exhausted  : boolean;
  trial_remaining  : number | null;
  lifetime_used    : number;
  lifetime_max     : number | null;
}

/** Delivery duration sub-object */
export interface DeliveryDuration {
  from : number | string;
  to   : number | string;
}

/** Delivery settings */
export interface Delivery {
  available : boolean;
  fee       : number | string;
  duration  : DeliveryDuration;
}

/** Contact info */
export interface Contact {
  email         : string;
  phone         : string;
  whatsapp      : string;
  whatsapp_link : string;
}

/** Existing image (loaded from server in edit mode) */
export interface ExistingImage {
  id         : string;
  url        : string;
  r2_key     : string | null;
  position   : number;
  is_primary : boolean;
  isExisting : true;
}

/** New image (selected by user, not yet uploaded) */
export interface NewImage {
  file  : File;
  url   : string;
  hash? : string;
}

/** The full form state */
export interface ProductForm {
  title          : string;
  description    : string;
  price          : number | string;
  category_id    : string | number;
  subcategory_id?: string | number;
  attributes     : Record<string, unknown>;
  delivery       : Delivery;
  contact        : Contact;
}

/** Everything useAddProduct() returns */
export interface AddProductContextValue {
  /* ── mode ── */
  isEditMode  : boolean;
  editId      : string | null;
  editLoading : boolean;
  editError   : string | null;
  navigate    : (path: string | number) => void;

  /* ── form state ── */
  form           : ProductForm;
  updateForm     : (key: keyof ProductForm, value: unknown) => void;
  updateAttribute: (key: string, value: unknown) => void;
  updateContact  : (key: keyof Contact, value: string) => void;
  updateDelivery : (key: keyof Delivery, value: unknown) => void;
  updateDeliveryDuration: (key: keyof DeliveryDuration, value: unknown) => void;
  toggleFeature  : (feature: string) => void;
  resetForm      : () => void;
  loadForm       : (data: Partial<ProductForm>) => void;

  /* ── images ── */
  images              : NewImage[];
  existingImages      : ExistingImage[];
  removedImageKeys    : string[];
  totalImageCount     : number;
  compressingCount    : number;
  compressingTotal    : number;
  handleImages        : (files: FileList | File[]) => void;
  removeImage         : (index: number) => void;
  removeExistingImage : (id: string) => void;
  moveImage           : (from: number, to: number) => void;
  moveAllImages       : (reordered: (NewImage | ExistingImage)[]) => void;
  resetImages         : () => void;
  loadExistingImages  : (images: ExistingImage[]) => void;

  /* ── location ── */
  locationState    : string;
  city             : string;
  setLocationState : (state: string) => void;
  setCity          : (city: string) => void;
  detectedCoords   : { latitude: number; longitude: number } | null;
  detectingLocation: boolean;
  detectLocation   : () => Promise<void>;

  /* ── categories ── */
  categories       : unknown[];
  categoriesLoaded : boolean;
  selectedCategory : unknown | null;
  options          : Record<string, unknown>;

  /* ── plans ── */
  promotionPlans : PromotionPlan[];
  plansLoading   : boolean;
  selectedPlan   : PromotionPlan | null;
  setSelectedPlan: (plan: PromotionPlan | null) => void;

  /* ── seller limits ── */
  sellerLimits    : SellerLimits | null;
  limitsLoading   : boolean;
  fetchLimits     : () => void;
  isVerifiedSeller: boolean;
  canPost         : boolean;
  dailyRemaining  : number;
  activeRemaining : number;
  cooldownSecs    : number;
  trialExhausted  : boolean;
  trialRemaining  : number | null;

  /* ── progress / loading ── */
  loading             : boolean;
  progressVisible     : boolean;
  progressStep        : string;
  isSelectedPlanPaid  : boolean;

  /* ── feedback ── */
  error   : string;
  success : string;

  /* ── payment ── */
  paymentData          : PaymentSession | null;
  resumePayment        : () => void;
  cancelPendingPayment : () => Promise<void>;

  /* ── verification ── */
  needsVerification : boolean;
  verificationData  : VerificationData | null;

  /* ── terms ── */
  agreedToTerms   : boolean;
  setAgreedToTerms: (agreed: boolean) => void;
  TermsCheckbox   : React.ReactNode;

  /* ── draft ── */
  clearDraft: (() => void) | null;

  /* ── submit ── */
  handleSubmit: () => void;

  /* ── formatters (passed down to sections) ── */
  displayPrice : (v: number | string) => string;
  formatLabel  : (t: string) => string;
  onlyNumbers  : (v: string) => string;
  onlyDigits   : (v: string) => string;

  /* ── misc ── */
  MAX_IMAGES : number;
  apiBase    : string;
}

/* ═══════════════════════════════════════════════════════════════
   CONTEXT
═══════════════════════════════════════════════════════════════ */
const AddProductContext =
  createContext<AddProductContextValue | null>(null);

AddProductContext.displayName = "AddProductContext";

/* ═══════════════════════════════════════════════════════════════
   PROVIDER
═══════════════════════════════════════════════════════════════ */
interface ProviderProps {
  value    : AddProductContextValue;
  children : ReactNode;
}

export function AddProductProvider({ value, children }: ProviderProps) {
  return (
    <AddProductContext.Provider value={value}>
      {children}
    </AddProductContext.Provider>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HOOK
═══════════════════════════════════════════════════════════════ */
export function useAddProductContext(): AddProductContextValue {
  const ctx = useContext(AddProductContext);
  if (!ctx) {
    throw new Error(
      "useAddProductContext must be used inside <AddProductProvider>.\n" +
      "Wrap your shell (MobileShell / DesktopShell) with it."
    );
  }
  return ctx;
}

/* ═══════════════════════════════════════════════════════════════
   RE-EXPORT CONTEXT (for advanced use — e.g. testing)
═══════════════════════════════════════════════════════════════ */
export { AddProductContext };
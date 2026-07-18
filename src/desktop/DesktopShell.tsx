/**
 * src/desktop/DesktopShell.tsx
 * Desktop 2-column layout:
 *   LEFT  — form sections
 *   RIGHT — sticky ListingPreview + PromotionPlan + Submit
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useAddProductContext }                  from "../hooks/useAddProductContext.jsx";

import AddProductHeader         from "../components/AddProductHeader.jsx";
import ProgressOverlay          from "../components/ProgressOverlay.jsx";

import BasicInfoSection         from "../product/shared/BasicInfoSection.jsx";
import ProductDetailsSection    from "../product/shared/ProductDetailsSection.jsx";
import ContactSection           from "../product/shared/ContactSection.jsx";
import LocationDeliverySection  from "../product/shared/LocationDeliverySection.jsx";
import ImagesSection            from "../product/shared/ImagesSection.jsx";
import PromotionPlanSection     from "../product/shared/PromotionPlanSection.jsx";
import SubmitSection            from "../product/shared/SubmitSection.jsx";

import PaymentCountdown         from "../pages/product/components/PaymentCountdown.jsx";
import VerificationUpsellModal  from "../pages/product/components/VerificationUpsellModal.jsx";
import VerificationNudgeBanner  from "../pages/product/components/VerificationNudgeBanner.jsx";
import {
  WarningIcon,
  CheckCircleIcon,
  CardIcon,
} from "../pages/product/components/icons/index.jsx";

import ListingPreview from "./components/ListingPreview";

import "../styles/AddProduct.css";
import "./styles/AddProductDesktop.css";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const PAYMENT_MAX_AGE_MS  = 30 * 60 * 1_000;
const SECTION_BASE_DELAY  = 420;
const SECTION_STEP_DELAY  = 60;
const SECTION_COUNT       = 6;

/* ═══════════════════════════════════════════════════════════════
   EDIT LOADING STATE
═══════════════════════════════════════════════════════════════ */
function EditLoading() {
  return (
    <div className="ap-page apd-page">
      <div className="ap-edit-loading">
        <div className="ap-edit-loading-spinner" />
        <p>Loading listing…</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EDIT ERROR STATE
═══════════════════════════════════════════════════════════════ */
function EditError({
  message,
  onBack,
}: {
  message : string;
  onBack  : () => void;
}) {
  return (
    <div className="ap-page apd-page">
      <div className="ap-edit-error">
        <span>⚠️</span>
        <h2>Could not load listing</h2>
        <p>{message}</p>
        <button onClick={onBack}>← Back to Dashboard</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAYMENT RESUME BANNER
═══════════════════════════════════════════════════════════════ */
function PaymentResumeBanner({
  paymentData,
  onResume,
  onCancel,
}: {
  paymentData : { authUrl: string; createdAt: number };
  onResume    : () => void;
  onCancel    : () => void;
}) {
  return (
    <div className="payment-resume-banner" role="alert">
      <div className="payment-resume-info">
        <CardIcon />
        <div>
          <strong>Incomplete Payment</strong>
          <PaymentCountdown
            createdAt={paymentData.createdAt}
            maxAgeMs={PAYMENT_MAX_AGE_MS}
          />
        </div>
      </div>
      <div className="payment-resume-actions">
        <button
          type="button"
          className="primary-btn"
          onClick={onResume}
        >
          Complete Payment
        </button>
        <button
          type="button"
          className="outline-btn"
          onClick={onCancel}
        >
          Cancel &amp; Save Draft
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FEEDBACK BANNERS
═══════════════════════════════════════════════════════════════ */
function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="form-error ap-error-banner" role="alert">
      <WarningIcon /> {message}
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="form-success" role="status">
      <CheckCircleIcon /> {message}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HOOK — section entrance animation
═══════════════════════════════════════════════════════════════ */
function useSectionEntrance(count: number) {
  const refs = Array.from(
    { length: count },
    () => useRef<HTMLElement>(null)   // eslint-disable-line react-hooks/rules-of-hooks
  );

  useEffect(() => {
    const timers = refs.map((ref, i) =>
      setTimeout(
        () => ref.current?.classList.add("ap-entered"),
        SECTION_BASE_DELAY + i * SECTION_STEP_DELAY
      )
    );
    return () => timers.forEach(clearTimeout);
  }, []); // refs are stable

  return refs;
}

/* ═══════════════════════════════════════════════════════════════
   DESKTOP SHELL
═══════════════════════════════════════════════════════════════ */
export default function DesktopShell() {
  const {
    /* mode */
    isEditMode,
    editLoading,
    editError,
    navigate,
    /* progress */
    progressVisible,
    progressStep,
    isSelectedPlanPaid,
    /* compression */
    compressingTotal,
    compressingCount,
    /* feedback */
    error,
    success,
    /* payment */
    paymentData,
    resumePayment,
    cancelPendingPayment,
    /* verification */
    needsVerification,
    verificationData,
    /* trial */
    trialExhausted,
    trialRemaining,
    /* draft */
    clearDraft,
  } = useAddProductContext();

  const [showUpsellModal, setShowUpsellModal] = useState(false);

  /* Section entrance refs */
  const sectionRefs = useSectionEntrance(SECTION_COUNT);
  const [s0, s1, s2, s3, s4, s5] = sectionRefs;

  /* Show upsell when trial exhausted in create mode */
  useEffect(() => {
    if (trialExhausted && !isEditMode) setShowUpsellModal(true);
  }, [trialExhausted, isEditMode]);

  /* ── Early returns ── */
  if (isEditMode && editLoading) return <EditLoading />;

  if (isEditMode && editError) {
    return (
      <EditError
        message={editError}
        onBack={() => navigate("/dashboard")}
      />
    );
  }

  /* ── Full render ── */
  return (
    <div className="ap-page apd-page">

      {/* Header */}
      <AddProductHeader
        title={isEditMode ? "Edit Listing" : "Post a Listing"}
        onClearDraft={isEditMode ? null : clearDraft}
      />

      {/* Progress overlay */}
      <ProgressOverlay
        visible={progressVisible}
        step={progressStep}
        isPaid={isSelectedPlanPaid}
      />

      {/* Image compression indicator */}
      {compressingTotal > 0 && (
        <div
          className="compression-progress"
          role="status"
          aria-live="polite"
        >
          <span className="btn-spin-svg" aria-hidden="true" />
          Compressing image {compressingCount + 1} of {compressingTotal}…
        </div>
      )}

      {/* Trial exhausted modal */}
      {showUpsellModal && !isEditMode && (
        <VerificationUpsellModal
          onClose={() => setShowUpsellModal(false)}
          trialRemaining={trialRemaining}
        />
      )}

      {/* Edit mode bar */}
      {isEditMode && (
        <div className="ap-edit-mode-bar">
          <span className="ap-edit-mode-icon">✏️</span>
          <span>Editing listing</span>
        </div>
      )}

      {/* Feedback banners */}
      {error   && <ErrorBanner   message={error}   />}
      {success && <SuccessBanner message={success} />}

      {/* Verification nudge */}
      {needsVerification && verificationData && (
        <VerificationNudgeBanner verificationData={verificationData} />
      )}

      {/* Payment resume banner — create mode only */}
      {!isEditMode && paymentData?.authUrl && (
        <PaymentResumeBanner
          paymentData={paymentData}
          onResume={resumePayment}
          onCancel={cancelPendingPayment}
        />
      )}

      {/* ═══════════════════════════════════════════════════════
          TWO-COLUMN LAYOUT
      ═══════════════════════════════════════════════════════ */}
      <div className="apd-grid">

        {/* ── LEFT: Form sections ── */}
        <div className="apd-left">
          <BasicInfoSection        innerRef={s0} />
          <ProductDetailsSection   innerRef={s1} />
          <ContactSection          innerRef={s2} />
          <LocationDeliverySection innerRef={s3} />
          <ImagesSection           innerRef={s4} />
        </div>

        {/* ── RIGHT: Sticky preview + plan + submit ── */}
        <aside className="apd-right">
          <div className="apd-sticky">
            <ListingPreview />
            <PromotionPlanSection innerRef={s5} />
            <SubmitSection />
          </div>
        </aside>

      </div>
    </div>
  );
}
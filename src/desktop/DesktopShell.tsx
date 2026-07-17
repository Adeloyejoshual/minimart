/**
 * src/desktop/DesktopShell.tsx
 * Desktop 2-column layout:
 *   LEFT  — form sections
 *   RIGHT — sticky ListingPreview + PromotionPlan + Submit
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useAddProductContext } from "../hooks/useAddProductContext.js";

import AddProductHeader   from "../components/AddProductHeader.jsx";
import ProgressOverlay    from "../components/ProgressOverlay.jsx";

import BasicInfoSection          from "../product/shared/BasicInfoSection.jsx";
import ProductDetailsSection     from "../product/shared/ProductDetailsSection.jsx";
import ContactSection            from "../product/shared/ContactSection.jsx";
import LocationDeliverySection   from "../product/shared/LocationDeliverySection.jsx";
import ImagesSection             from "../product/shared/ImagesSection.jsx";
import PromotionPlanSection      from "../product/shared/PromotionPlanSection.jsx";
import SubmitSection             from "../product/shared/SubmitSection.jsx";

import PaymentCountdown          from "../product/components/PaymentCountdown.jsx";
import VerificationUpsellModal   from "../product/components/VerificationUpsellModal.jsx";
import VerificationNudgeBanner   from "../product/components/VerificationNudgeBanner.jsx";
import {
  WarningIcon, CheckCircleIcon, CardIcon,
} from "../product/components/icons/index.jsx";

import ListingPreview from "./components/ListingPreview";

import "../styles/AddProduct.css";
import "./styles/AddProductDesktop.css";

export default function DesktopShell() {
  const {
    isEditMode, editLoading, editError, navigate,
    progressVisible, progressStep, isSelectedPlanPaid,
    compressingTotal, compressingCount,
    error, success,
    paymentData, resumePayment, cancelPendingPayment,
    needsVerification, verificationData,
    trialExhausted, trialRemaining,
    clearDraft,
  } = useAddProductContext();

  const [showUpsellModal, setShowUpsellModal] = useState(false);

  /* Section refs for entrance animation */
  const sec0 = useRef<HTMLElement>(null); const sec1 = useRef<HTMLElement>(null);
  const sec2 = useRef<HTMLElement>(null); const sec3 = useRef<HTMLElement>(null);
  const sec4 = useRef<HTMLElement>(null); const sec5 = useRef<HTMLElement>(null);
  const sectionRefs = useMemo(
    () => [sec0, sec1, sec2, sec3, sec4, sec5],
    []
  );

  useEffect(() => {
    const timers = sectionRefs.map((ref, i) =>
      setTimeout(() => ref.current?.classList.add("ap-entered"), 420 + i * 60)
    );
    return () => timers.forEach(clearTimeout);
  }, [sectionRefs]);

  useEffect(() => {
    if (trialExhausted && !isEditMode) setShowUpsellModal(true);
  }, [trialExhausted, isEditMode]);

  /* Edit loading */
  if (isEditMode && editLoading) {
    return (
      <div className="ap-page apd-page">
        <div className="ap-edit-loading">
          <div className="ap-edit-loading-spinner" />
          <p>Loading listing…</p>
        </div>
      </div>
    );
  }

  /* Edit error */
  if (isEditMode && editError) {
    return (
      <div className="ap-page apd-page">
        <div className="ap-edit-error">
          <span>⚠️</span>
          <h2>Could not load listing</h2>
          <p>{editError}</p>
          <button onClick={() => navigate("/dashboard")}>
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ap-page apd-page">
      <AddProductHeader
        title={isEditMode ? "Edit Listing" : "Post a Listing"}
        onClearDraft={isEditMode ? null : clearDraft}
      />

      <ProgressOverlay
        visible={progressVisible}
        step={progressStep}
        isPaid={isSelectedPlanPaid}
      />

      {compressingTotal > 0 && (
        <div className="compression-progress" role="status" aria-live="polite">
          <span className="btn-spin-svg" aria-hidden="true" />
          Compressing image {compressingCount + 1} of {compressingTotal}…
        </div>
      )}

      {showUpsellModal && !isEditMode && (
        <VerificationUpsellModal
          onClose={() => setShowUpsellModal(false)}
          trialRemaining={trialRemaining}
        />
      )}

      {isEditMode && (
        <div className="ap-edit-mode-bar">
          <span className="ap-edit-mode-icon">✏️</span>
          <span>Editing listing</span>
        </div>
      )}

      {error && (
        <div className="form-error ap-error-banner" role="alert">
          <WarningIcon /> {error}
        </div>
      )}
      {success && (
        <div className="form-success" role="status">
          <CheckCircleIcon /> {success}
        </div>
      )}

      {needsVerification && verificationData && (
        <VerificationNudgeBanner verificationData={verificationData} />
      )}

      {!isEditMode && paymentData?.authUrl && (
        <div className="payment-resume-banner" role="alert">
          <div className="payment-resume-info">
            <CardIcon />
            <div>
              <strong>Incomplete Payment</strong>
              <PaymentCountdown
                createdAt={paymentData.createdAt}
                maxAgeMs={30 * 60 * 1_000}
              />
            </div>
          </div>
          <div className="payment-resume-actions">
            <button type="button" className="primary-btn" onClick={resumePayment}>
              Complete Payment
            </button>
            <button type="button" className="outline-btn" onClick={cancelPendingPayment}>
              Cancel &amp; Save Draft
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TWO-COLUMN LAYOUT
      ═══════════════════════════════════════════════════════ */}
      <div className="apd-grid">
        {/* ── LEFT: Form ── */}
        <div className="apd-left">
          <BasicInfoSection        innerRef={sec0} />
          <ProductDetailsSection   innerRef={sec1} />
          <ContactSection          innerRef={sec2} />
          <LocationDeliverySection innerRef={sec3} />
          <ImagesSection           innerRef={sec4} />
        </div>

        {/* ── RIGHT: Preview + Plan + Submit (sticky) ── */}
        <aside className="apd-right">
          <div className="apd-sticky">
            <ListingPreview />
            <PromotionPlanSection innerRef={sec5} />
            <SubmitSection />
          </div>
        </aside>
      </div>
    </div>
  );
}
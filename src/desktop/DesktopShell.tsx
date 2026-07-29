/**
 * src/desktop/DesktopShell.tsx
 * Desktop 2-column layout — feature-parity with AddProduct.jsx (mobile)
 *
 * v6 — VERIFY BEFORE PAY
 * ─────────────────────────────────────────────────────────────
 *  LEFT  — form sections
 *  RIGHT — sticky ListingPreview + PromotionPlan + Submit
 *
 *  ✅ VerifyBeforePayModal (unverified + paid plan)
 *  ✅ SubscriptionUpsellBanner (verified + 500-limit hit)
 *  ✅ PaymentResumeBanner with countdown
 *  ✅ Watermark warning/block banner
 *  ✅ VerificationNudgeBanner
 *  ✅ Trial exhausted upsell modal
 *  ✅ Seller-limit banners (cooldown, daily, lifetime)
 *  ✅ Compression progress indicator
 *  ✅ Section entrance animations
 */

import { useEffect, useCallback, useState, useRef } from "react";
import { useAddProductContext } from "../hooks/useAddProductContext.jsx";

import AddProductHeader from "../components/AddProductHeader.jsx";
import ProgressOverlay from "../components/ProgressOverlay.jsx";
import WatermarkWarningBanner from "../components/WatermarkWarningBanner.jsx";

import BasicInfoSection from "../product/shared/BasicInfoSection.jsx";
import ProductDetailsSection from "../product/shared/ProductDetailsSection.jsx";
import ContactSection from "../product/shared/ContactSection.jsx";
import LocationDeliverySection from "../product/shared/LocationDeliverySection.jsx";
import ImagesSection from "../product/shared/ImagesSection.jsx";
import PromotionPlanSection from "../product/shared/PromotionPlanSection.jsx";
import SubmitSection from "../product/shared/SubmitSection.jsx";

import PaymentCountdown from "../pages/product/components/PaymentCountdown.jsx";
import VerificationUpsellModal from "../pages/product/components/VerificationUpsellModal.jsx";
import VerificationNudgeBanner from "../pages/product/components/VerificationNudgeBanner.jsx";
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
const PAYMENT_MAX_AGE_MS = 30 * 60 * 1_000;
const SECTION_BASE_DELAY = 420;
const SECTION_STEP_DELAY = 60;
const SECTION_COUNT = 6;

/* ═══════════════════════════════════════════════════════════════
   VERIFY BEFORE PAY MODAL
   ✅ v6: Shown when unverified user selects a paid plan
═══════════════════════════════════════════════════════════════ */
function VerifyBeforePayModal({
  onVerify,
  onCancel,
  onFreePlan,
}: {
  onVerify: () => void;
  onCancel: () => void;
  onFreePlan: () => void;
}) {
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div
      className="ap-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vbp-title"
      onClick={handleOverlayClick}
    >
      <div className="ap-modal">
        <div className="ap-modal-icon" aria-hidden="true">🔒</div>

        <h2 id="vbp-title" className="ap-modal-title">
          Verify Your Identity First
        </h2>

        <p className="ap-modal-message">
          You need to verify your identity before purchasing a promotion
          plan. Verification is free and only takes a few minutes.
        </p>

        <ul className="ap-modal-list">
          <li>✅ Post up to 500 listings</li>
          <li>✅ Listings active for 30 days</li>
          <li>✅ Access all paid promotion plans</li>
          <li>✅ Build buyer trust with a verified badge</li>
        </ul>

        <div className="ap-modal-actions">
          <button type="button" className="primary-btn" onClick={onVerify}>
            Verify My Account
          </button>
          <button type="button" className="outline-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>

        <p className="ap-modal-hint">
          Want to post now?{" "}
          <button type="button" className="link-btn" onClick={onFreePlan}>
            Use the free plan instead
          </button>
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SUBSCRIPTION UPSELL BANNER
═══════════════════════════════════════════════════════════════ */
function SubscriptionUpsellBanner({
  subscriptionData,
  onNavigate,
}: {
  subscriptionData: {
    message: string;
    upgradeUrl: string;
    lifetimeUsed: number;
    lifetimeMax: number;
  };
  onNavigate: (url: string) => void;
}) {
  return (
    <div className="subscription-upsell-banner" role="alert">
      <div className="subscription-upsell-info">
        <span className="subscription-upsell-icon" aria-hidden="true">
          ⭐
        </span>
        <div>
          <strong>Listing Limit Reached</strong>
          <p>
            {subscriptionData.message ??
              `You've used ${subscriptionData.lifetimeUsed} of ${subscriptionData.lifetimeMax} listings.`}
          </p>
        </div>
      </div>
      <button
        type="button"
        className="primary-btn"
        onClick={() => onNavigate(subscriptionData.upgradeUrl)}
      >
        Upgrade to Subscriber
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SELLER LIMIT BANNERS
═══════════════════════════════════════════════════════════════ */
function SellerLimitBanners({
  canPost,
  cooldownSecs,
  dailyRemaining,
  activeRemaining,
  lifetimeExhausted,
  lifetimeRemaining,
  lifetimeMax,
  upgradeTo,
  upgradeUrl,
  tier,
  isEditMode,
  onNavigate,
}: {
  canPost: boolean;
  cooldownSecs: number;
  dailyRemaining: number | null;
  activeRemaining: number | null;
  lifetimeExhausted: boolean;
  lifetimeRemaining: number | null;
  lifetimeMax: number | null;
  upgradeTo: string | null;
  upgradeUrl: string | null;
  tier: string;
  isEditMode: boolean;
  onNavigate: (url: string) => void;
}) {
  if (isEditMode) return null;

  const banners: React.ReactNode[] = [];

  if (cooldownSecs > 0) {
    const mins = Math.ceil(cooldownSecs / 60);
    banners.push(
      <div key="cooldown" className="ap-limit-banner ap-limit-cooldown" role="alert">
        <WarningIcon />
        <span>Please wait {mins} minute{mins !== 1 ? "s" : ""} before posting again.</span>
      </div>
    );
  }

  if (lifetimeExhausted) {
    banners.push(
      <div key="lifetime" className="ap-limit-banner ap-limit-lifetime" role="alert">
        <WarningIcon />
        <div>
          <strong>
            {tier === "verified"
              ? "You've reached your 500-listing limit."
              : "Free trial listings used up."}
          </strong>
          {upgradeTo && upgradeUrl && (
            <button
              type="button"
              className="link-btn"
              onClick={() => onNavigate(upgradeUrl)}
            >
              {upgradeTo === "subscriber" ? "Upgrade to Subscriber" : "Verify Your Account"}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (
    !lifetimeExhausted &&
    dailyRemaining !== null &&
    dailyRemaining <= 3 &&
    dailyRemaining > 0
  ) {
    banners.push(
      <div key="daily" className="ap-limit-banner ap-limit-daily" role="status">
        <span>📊 {dailyRemaining} listing{dailyRemaining !== 1 ? "s" : ""} remaining today.</span>
      </div>
    );
  }

  if (
    !lifetimeExhausted &&
    lifetimeRemaining !== null &&
    lifetimeMax !== null &&
    lifetimeRemaining <= 5 &&
    lifetimeRemaining > 0
  ) {
    banners.push(
      <div key="lifetimeWarn" className="ap-limit-banner ap-limit-lifetime-warn" role="status">
        <span>
          📊 {lifetimeRemaining} of {lifetimeMax} lifetime listing
          {lifetimeRemaining !== 1 ? "s" : ""} remaining.
        </span>
      </div>
    );
  }

  return banners.length > 0 ? <>{banners}</> : null;
}

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
  message: string;
  onBack: () => void;
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
  paymentData: { authUrl: string; createdAt: number };
  onResume: () => void;
  onCancel: () => void;
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
        <button type="button" className="primary-btn" onClick={onResume}>
          Complete Payment
        </button>
        <button type="button" className="outline-btn" onClick={onCancel}>
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
   HOOK — section entrance animation (safe ref pattern)
═══════════════════════════════════════════════════════════════ */
function useSectionEntrance(count: number) {
  const refsRef = useRef(
    Array.from({ length: count }, () => ({ current: null as HTMLElement | null }))
  );

  useEffect(() => {
    const timers = refsRef.current.map((ref, i) =>
      window.setTimeout(
        () => ref.current?.classList.add("ap-entered"),
        SECTION_BASE_DELAY + i * SECTION_STEP_DELAY
      )
    );
    return () => timers.forEach(window.clearTimeout);
  }, []);

  return refsRef.current;
}

/* ═══════════════════════════════════════════════════════════════
   DESKTOP SHELL — MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function DesktopShell() {
  const ctx = useAddProductContext();

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

    /* seller limits */
    canPost,
    cooldownSecs,
    dailyRemaining,
    activeRemaining,
    lifetimeExhausted,
    lifetimeRemaining,
    lifetimeMax,
    upgradeTo,
    upgradeUrl,
    tier,
    isVerifiedSeller,
    isSubscriber,

    /* subscription upsell */
    needsSubscription,
    subscriptionData,

    /* draft */
    clearDraft,

    /* watermark */
    watermarkWarnings,
    watermarkNotice,
    dismissWatermarkWarnings,

    /* submit */
    handleSubmit,
    selectedPlan,
    setSelectedPlan,
    promotionPlans,

    /* verify-before-pay support */
    runCreateSubmit,
  } = ctx;

  /* ─── Local state ─── */
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [showVerifyBeforePay, setShowVerifyBeforePay] = useState(false);

  /* ─── Section entrance refs ─── */
  const sectionRefs = useSectionEntrance(SECTION_COUNT);
  const [s0, s1, s2, s3, s4, s5] = sectionRefs;

  /* ─── Watermark banner ref for scroll ─── */
  const wmBannerRef = useRef<HTMLDivElement>(null);

  /* ─── Show upsell when trial exhausted in create mode ─── */
  useEffect(() => {
    if (trialExhausted && !isEditMode) setShowUpsellModal(true);
  }, [trialExhausted, isEditMode]);

  /* ─── Scroll watermark banner into view ─── */
  useEffect(() => {
    if (!watermarkWarnings?.length) return;
    const id = requestAnimationFrame(() => {
      wmBannerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [watermarkWarnings]);

  /* ═══════════════════════════════════════════════════════════
     VERIFY BEFORE PAY — HANDLERS
     ✅ v6: Intercept paid plan submit for unverified users
  ═══════════════════════════════════════════════════════════ */
  const handleDesktopSubmit = useCallback(() => {
    if (isEditMode) {
      handleSubmit();
      return;
    }

    /* Determine the plan that would be used */
    const finalPlan =
      selectedPlan ??
      promotionPlans?.find((p: any) => Number(p.price) === 0) ??
      null;

    const isPaidPlan = !!finalPlan && Number(finalPlan?.price ?? 0) > 0;

    /* ✅ v6: Unverified user + paid plan = show verify modal */
    if (isPaidPlan && !isVerifiedSeller) {
      setShowVerifyBeforePay(true);
      return;
    }

    /* Verified or free plan — proceed normally */
    handleSubmit();
  }, [isEditMode, selectedPlan, promotionPlans, isVerifiedSeller, handleSubmit]);

  const handleVerifyBeforePayVerify = useCallback(() => {
    setShowVerifyBeforePay(false);
    navigate("/verification");
  }, [navigate]);

  const handleVerifyBeforePayCancel = useCallback(() => {
    setShowVerifyBeforePay(false);
  }, []);

  const handleVerifyBeforePayFreePlan = useCallback(() => {
    setShowVerifyBeforePay(false);
    const freePlan =
      promotionPlans?.find((p: any) => Number(p.price) === 0) ?? null;
    setSelectedPlan?.(freePlan);

    /* If context exposes runCreateSubmit, use it with forced free plan */
    if (typeof runCreateSubmit === "function") {
      runCreateSubmit(freePlan);
    } else {
      /* Fallback: just submit — the plan is now free */
      handleSubmit();
    }
  }, [promotionPlans, setSelectedPlan, runCreateSubmit, handleSubmit]);

  /* ═══════════════════════════════════════════════════════════
     EARLY RETURNS
  ═══════════════════════════════════════════════════════════ */
  if (isEditMode && editLoading) return <EditLoading />;

  if (isEditMode && editError) {
    return (
      <EditError
        message={editError}
        onBack={() => navigate("/dashboard")}
      />
    );
  }

  /* ─── Derived ─── */
  const wmHasBlock = watermarkWarnings?.some((w: any) => w.isBlocked) ?? false;
  const wmShowDismiss = !wmHasBlock && !!dismissWatermarkWarnings;

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="ap-page apd-page">

      {/* ✅ v6: Verify Before Pay Modal */}
      {showVerifyBeforePay && !isEditMode && (
        <VerifyBeforePayModal
          onVerify={handleVerifyBeforePayVerify}
          onCancel={handleVerifyBeforePayCancel}
          onFreePlan={handleVerifyBeforePayFreePlan}
        />
      )}

      {/* Trial exhausted modal */}
      {showUpsellModal && !isEditMode && (
        <VerificationUpsellModal
          onClose={() => setShowUpsellModal(false)}
          trialRemaining={trialRemaining}
        />
      )}

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

      {/* Edit mode bar */}
      {isEditMode && (
        <div className="ap-edit-mode-bar">
          <span className="ap-edit-mode-icon">✏️</span>
          <span>Editing listing</span>
        </div>
      )}

      {/* Feedback banners */}
      {error && <ErrorBanner message={error} />}
      {success && <SuccessBanner message={success} />}

      {/* Seller limit banners */}
      <SellerLimitBanners
        canPost={canPost}
        cooldownSecs={cooldownSecs}
        dailyRemaining={dailyRemaining}
        activeRemaining={activeRemaining}
        lifetimeExhausted={lifetimeExhausted}
        lifetimeRemaining={lifetimeRemaining}
        lifetimeMax={lifetimeMax}
        upgradeTo={upgradeTo}
        upgradeUrl={upgradeUrl}
        tier={tier}
        isEditMode={isEditMode}
        onNavigate={navigate}
      />

      {/* Watermark warning/block banner */}
      {!!watermarkWarnings?.length && (
        <div ref={wmBannerRef}>
          <WatermarkWarningBanner
            warnings={watermarkWarnings}
            notice={watermarkNotice ?? ""}
            onDismiss={wmShowDismiss ? dismissWatermarkWarnings : undefined}
          />
        </div>
      )}

      {/* Verification nudge */}
      {needsVerification && verificationData && (
        <VerificationNudgeBanner verificationData={verificationData} />
      )}

      {/* Subscription upsell */}
      {needsSubscription && subscriptionData && (
        <SubscriptionUpsellBanner
          subscriptionData={subscriptionData}
          onNavigate={navigate}
        />
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
          <BasicInfoSection innerRef={s0} />
          <ProductDetailsSection innerRef={s1} />
          <ContactSection innerRef={s2} />
          <LocationDeliverySection innerRef={s3} />
          <ImagesSection innerRef={s4} />
        </div>

        {/* ── RIGHT: Sticky preview + plan + submit ── */}
        <aside className="apd-right">
          <div className="apd-sticky">
            <ListingPreview />
            <PromotionPlanSection innerRef={s5} />
            <SubmitSection onSubmitOverride={handleDesktopSubmit} />
          </div>
        </aside>

      </div>
    </div>
  );
}
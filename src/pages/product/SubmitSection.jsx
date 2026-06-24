/**
 * src/pages/product/SubmitSection.jsx
 */
import { Link } from "react-router-dom";
import { SpinnerIcon, WarningIcon } from "./atoms.jsx";

function CooldownTimer({ initialSecs }) {
  const { useState, useEffect } = require("react"); // eslint-disable-line
  const [secs, setSecs] = useState(initialSecs);
  useEffect(() => {
    setSecs(initialSecs);
    if (initialSecs <= 0) return;
    const id = setInterval(() => {
      setSecs((prev) => { if (prev <= 1) { clearInterval(id); return 0; } return prev - 1; });
    }, 1_000);
    return () => clearInterval(id);
  }, [initialSecs]);

  if (secs <= 0) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const label = m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
  return <span className="cooldown-label">Wait {label}</span>;
}

export default function SubmitSection({
  TermsCheckbox,
  loading,
  agreedToTerms,
  plansLoading,
  canPost,
  isFreePlan,
  deliveryRangeError,
  hasImageErrors,
  cooldownSecs,
  dailyRemaining,
  activeRemaining,
  sellerLimits,
  MIN_IMAGES,
  imageCount,
  handleSubmit,
  onUpsellClick,
}) {
  const submitBlocked =
    loading || !agreedToTerms || plansLoading || !canPost ||
    !!deliveryRangeError || hasImageErrors ||
    imageCount < MIN_IMAGES;

  const submitTitle = !agreedToTerms
    ? "Please accept the Terms & Conditions first"
    : imageCount < MIN_IMAGES     ? `At least ${MIN_IMAGES} image required`
    : plansLoading                ? "Plans are still loading"
    : !!deliveryRangeError        ? deliveryRangeError
    : hasImageErrors              ? "Fix image errors before submitting"
    : !canPost && dailyRemaining  === 0 ? "Daily posting limit reached"
    : !canPost && activeRemaining === 0 ? "Active listing limit reached"
    : !canPost && cooldownSecs    > 0   ? "Please wait before posting again"
    : undefined;

  return (
    <div className="button-section section form-card">
      {TermsCheckbox}

      <button
        type="button"
        disabled={submitBlocked}
        className={[
          "primary-btn full-width",
          !canPost ? "primary-btn--blocked" : "",
        ].filter(Boolean).join(" ")}
        onClick={handleSubmit}
        aria-busy={loading}
        aria-live="polite"
        title={submitTitle}
      >
        {loading ? (
          <>
            <SpinnerIcon />
            <span className="sr-only">Submitting…</span>
            {" "}Processing&#8230;
          </>
        ) : imageCount < MIN_IMAGES ? (
          `Add at least ${MIN_IMAGES} photo`
        ) : deliveryRangeError ? (
          "Fix Delivery Dates"
        ) : hasImageErrors ? (
          "Fix Image Errors"
        ) : !canPost && cooldownSecs > 0 ? (
          <CooldownTimer initialSecs={cooldownSecs} />
        ) : !canPost && dailyRemaining === 0 ? (
          "Daily Limit Reached"
        ) : !canPost && activeRemaining === 0 ? (
          "Active Limit Reached"
        ) : isFreePlan ? (
          "Post Ad"
        ) : (
          "Post Ad & Pay"
        )}
      </button>

      {!canPost && !loading && (
        <p className="submit-limit-note">
          <WarningIcon />
          {dailyRemaining === 0
            ? `You've reached your daily limit (${sellerLimits?.daily_limit}/day). `
            : activeRemaining === 0
            ? `You've reached your active listing limit (${sellerLimits?.active_limit}). `
            : "Posting is on cooldown. "}
          <button type="button" className="link-btn" onClick={onUpsellClick}>
            Complete verification
          </button>
          {" "}to unlock higher limits.
        </p>
      )}
    </div>
  );
}
/**
 * src/product/shared/SubmitSection.jsx
 * Terms checkbox + Submit button
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAddProductContext } from "../../hooks/useAddProductContext.jsx";
import { SpinnerIcon } from "../components/icons/index.jsx";

export default function SubmitSection() {
  const {
    isEditMode, loading, handleSubmit,
    agreedToTerms, setAgreedToTerms,
    plansLoading, selectedPlan,
  } = useAddProductContext();

  const isFreePlan = !selectedPlan || Number(selectedPlan?.price ?? 0) === 0;

  const submitBlocked =
    loading ||
    (!isEditMode && !agreedToTerms) ||
    (!isEditMode && plansLoading);

  const submitTitle =
    !agreedToTerms && !isEditMode
      ? "Please accept the Terms & Conditions first"
      : plansLoading && !isEditMode
        ? "Plans are still loading"
        : undefined;

  const submitLabel = (() => {
    if (loading)     return isEditMode ? "Saving…" : "Processing…";
    if (isEditMode)  return "Save Changes";
    if (isFreePlan)  return "Post Ad";
    return "Post Ad & Pay";
  })();

  /* Terms checkbox JSX */
  const TermsCheckbox = useMemo(() => (
    <div className="ap-terms-row">
      <label
        className="ap-terms-label"
        onClick={(e) => {
          if (e.target.tagName === "A") return;
          e.preventDefault();
          setAgreedToTerms((v) => !v);
        }}
      >
        <span
          className={`ap-terms-box ${agreedToTerms ? "ap-terms-box--on" : ""}`}
          role="checkbox"
          aria-checked={agreedToTerms}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setAgreedToTerms((v) => !v);
            }
          }}
        >
          {agreedToTerms && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                 stroke="#fff" strokeWidth="3"
                 strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
        </span>
        <input
          type="checkbox"
          checked={agreedToTerms}
          onChange={() => {}}
          style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
          aria-hidden="true"
          tabIndex={-1}
        />
        <span className="ap-terms-text">
          I agree to the{" "}
          <Link to="/terms" target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}>
            Terms &amp; Conditions
          </Link>
        </span>
      </label>
    </div>
  ), [agreedToTerms, setAgreedToTerms]);

  return (
    <div className="button-section">
      {!isEditMode && TermsCheckbox}

      {isEditMode && (
        <p className="edit-back-hint">
          Changes are saved to your listing immediately.{" "}
          <Link to="/dashboard">← Back to Dashboard</Link>
        </p>
      )}

      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {loading ? (isEditMode ? "Saving changes" : "Processing submission") : ""}
      </span>

      <button
        type="button"
        disabled={submitBlocked}
        className="primary-btn full-width"
        onClick={handleSubmit}
        aria-busy={loading}
        title={submitTitle}
      >
        {loading
          ? <><SpinnerIcon />{" "}{isEditMode ? "Saving…" : "Processing…"}</>
          : submitLabel}
      </button>
    </div>
  );
}
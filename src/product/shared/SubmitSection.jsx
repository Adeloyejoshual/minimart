/**
 * src/product/shared/SubmitSection.jsx
 * Terms + Submit button
 *
 * v3 — Uses shared TermsCheckbox component (matches mobile UI)
 *      - Orange-filled checkbox
 *      - Better copy (adds Privacy Policy + confirmation line)
 *      - Inline error on submit-without-agreement
 *      - Wired to v8 fieldError for submit-time validation
 * v2 — Inline custom terms row (deprecated)
 */
import { useCallback } from "react";
import { Link } from "react-router-dom";
import { useAddProductContext } from "../../hooks/useAddProductContext.jsx";
import { SpinnerIcon } from "../../pages/product/components/icons/index.jsx";
import TermsCheckbox from "../../pages/product/components/TermsCheckbox.jsx";

export default function SubmitSection() {
  const {
    isEditMode, loading, handleSubmit,
    agreedToTerms, setAgreedToTerms,
    plansLoading, selectedPlan,
    fieldError,           /* ✅ v8: shows terms error after submit attempt */
  } = useAddProductContext();

  const isFreePlan =
    !selectedPlan || Number(selectedPlan?.price ?? 0) === 0;

  const submitBlocked =
    loading ||
    (!isEditMode && plansLoading);
  /* Note: we intentionally DO NOT block on !agreedToTerms.
     Let the click go through so validateForm() runs and
     TermsCheckbox shows its inline error. Better UX than
     a silently-disabled button. */

  const submitTitle =
    plansLoading && !isEditMode
      ? "Plans are still loading"
      : undefined;

  const submitLabel = (() => {
    if (loading)     return isEditMode ? "Saving…" : "Processing…";
    if (isEditMode)  return "Save Changes";
    if (isFreePlan)  return "Post Ad";
    return "Post Ad & Pay";
  })();

  /* TermsCheckbox handles its own internal "touched" state,
     but we also want to force-show the error when validateForm
     flags "Terms" via the top-level submit. */
  const handleTermsChange = useCallback((checked) => {
    setAgreedToTerms(checked);
  }, [setAgreedToTerms]);

  return (
    <div className="button-section">
      {/* ── Terms checkbox (create mode only) ── */}
      {!isEditMode && (
        <TermsCheckbox
          checked={agreedToTerms}
          onChange={handleTermsChange}
        />
      )}

      {/* ── Edit mode hint ── */}
      {isEditMode && (
        <p className="edit-back-hint">
          Changes are saved to your listing immediately.{" "}
          <Link to="/dashboard">← Back to Dashboard</Link>
        </p>
      )}

      {/* ── v8: Extra error banner if form validation flagged Terms
             (belt-and-suspenders — TermsCheckbox also shows its own) ── */}
      {!isEditMode &&
       !agreedToTerms &&
       fieldError?.field === "terms" && (
        <p className="terms-error-msg" role="alert" style={{ marginTop: 4 }}>
          {fieldError.message}
        </p>
      )}

      {/* Screen reader status */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {loading
          ? (isEditMode ? "Saving changes" : "Processing submission")
          : ""}
      </span>

      {/* ── Submit button ── */}
      <button
        type="button"
        disabled={submitBlocked}
        className="primary-btn full-width"
        onClick={handleSubmit}
        aria-busy={loading}
        title={submitTitle}
      >
        {loading ? (
          <>
            <SpinnerIcon />{" "}
            {isEditMode ? "Saving…" : "Processing…"}
          </>
        ) : (
          submitLabel
        )}
      </button>
    </div>
  );
}
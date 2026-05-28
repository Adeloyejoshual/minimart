// src/components/terms/TermsFooter.jsx
import { useNavigate }       from "react-router-dom";
import { isAcceptanceValid } from "../../utils/termsValidation";

export default function TermsFooter({
  hasRead,
  agreed,
  onAgreeChange,
  onAccept,
  isSubmitting,
  submitError,
}) {
  const navigate    = useNavigate();
  const canProceed  = isAcceptanceValid({ hasRead, agreed });

  const handleAccept = () => {
    if (!canProceed || isSubmitting) return;
    onAccept({ hasRead, onSuccess: () => navigate(-1) });
  };

  const buttonLabel = isSubmitting
    ? "Saving your acceptance..."
    : canProceed
    ? "I Understand — Back to Post Ad"
    : !hasRead
    ? "Please Read All Terms First"
    : "Please Check the Box Above";

  return (
    <footer className="terms-footer">

      {/* ── Consent Checkbox ── */}
      <label
        className={`terms-footer__checkbox-label ${
          !hasRead ? "terms-footer__checkbox-label--disabled" : ""
        }`}
        title={!hasRead ? "Please finish reading before agreeing" : ""}
      >
        <input
          type="checkbox"
          className="terms-footer__checkbox"
          checked={agreed}
          disabled={!hasRead || isSubmitting}
          onChange={(e) => onAgreeChange(e.target.checked)}
          aria-label="I agree to the Terms and Conditions"
        />
        <span>
          I have read and agree to the Terms and Conditions
        </span>
      </label>

      {/* ── API Error Notice ── */}
      {submitError && (
        <p
          className="terms-footer__error"
          role="alert"
          aria-live="polite"
        >
          {submitError}
        </p>
      )}

      {/* ── Accept Button ── */}
      <button
        className={`terms-footer__btn ${
          canProceed && !isSubmitting
            ? "terms-footer__btn--active"
            : "terms-footer__btn--disabled"
        }`}
        onClick={handleAccept}
        disabled={!canProceed || isSubmitting}
        aria-disabled={!canProceed || isSubmitting}
        aria-label={
          canProceed
            ? "Accept terms and return to posting"
            : "Complete reading and accept terms first"
        }
      >
        {buttonLabel}
      </button>

    </footer>
  );
}
import { useState } from "react";

export default function TermsCheckbox({ checked, onChange }) {
  const [touched, setTouched] = useState(false);
  const showError = touched && !checked;

  const handleChange = (e) => {
    setTouched(true);
    onChange(e.target.checked);
  };

  return (
    <>
      <label
        className={[
          "terms-wrapper",
          checked   ? "terms-wrapper--checked" : "",
          showError ? "terms-wrapper--error"   : "",
        ].filter(Boolean).join(" ")}
      >
        <span className="terms-checkbox-box">
          <input
            type="checkbox"
            checked={checked}
            onChange={handleChange}
            aria-required="true"
            aria-describedby={showError ? "terms-error" : undefined}
          />
          <span className="terms-checkbox-visual" aria-hidden="true">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor"
                 strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2,6 5,9 10,3" />
            </svg>
          </span>
        </span>

        <span className="terms-text">
          I agree to the{" "}
          <a
            href="/terms#listing-guidelines"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            Listing Terms
          </a>
          ,{" "}
          <a
            href="/terms#prohibited-items"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            Prohibited Items Policy
          </a>
          , and{" "}
          <a
            href="/terms#privacy"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            Privacy Policy
          </a>
          . I confirm this listing is accurate and complies with Loemart rules.
        </span>
      </label>

      {showError && (
        <p id="terms-error" className="terms-error-msg" role="alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8"  x2="12"    y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          You must accept the Listing Terms to continue.
        </p>
      )}
    </>
  );
}
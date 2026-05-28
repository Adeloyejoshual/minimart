// src/components/terms/TermsHeader.jsx
import { useNavigate }  from "react-router-dom";
import { TERMS_CONFIG } from "../../constants/termsConfig";

export default function TermsHeader() {
  const navigate = useNavigate();

  return (
    <header className="terms-header">
      <button
        className="terms-header__back-btn"
        onClick={() => navigate(-1)}
        aria-label="Go back to previous page"
      >
        Back
      </button>

      <h1 className="terms-header__title">
        Terms of Use and Posting Rules
      </h1>

      <p className="terms-header__jurisdiction">
        Applicable Worldwide — All Users
      </p>

      <p className="terms-header__reading-time">
        Estimated reading time: {TERMS_CONFIG.estimatedReadMinutes} minutes
      </p>

      <p className="terms-header__effective">
        Effective Date: {TERMS_CONFIG.effectiveDate}
      </p>
    </header>
  );
}
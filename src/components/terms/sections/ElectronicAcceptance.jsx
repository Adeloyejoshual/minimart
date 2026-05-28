// src/components/terms/sections/ElectronicAcceptance.jsx
import TermsSection from "../TermsSection";
import { TERMS_CONFIG } from "../../../constants/termsConfig";

export default function ElectronicAcceptance() {
  return (
    <TermsSection id="electronic" title="13. Electronic Acceptance">
      <p>
        By <strong>creating an account, posting an ad, or using{" "}
        {TERMS_CONFIG.platformName}</strong>, you acknowledge that you have:
      </p>
      <ul>
        <li>Read and understood these Terms and Conditions in full.</li>
        <li>Agreed to be legally bound by them electronically.</li>
        <li>
          Confirmed that you are at least{" "}
          <strong>{TERMS_CONFIG.minimumAge} years of age</strong>.
        </li>
        <li>
          Accepted that this electronic agreement carries the same legal
          weight as a written signature under applicable electronic
          commerce and evidence legislation.
        </li>
      </ul>
    </TermsSection>
  );
}
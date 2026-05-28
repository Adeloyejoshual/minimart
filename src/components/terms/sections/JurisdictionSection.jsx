// src/components/terms/sections/JurisdictionSection.jsx
import TermsSection from "../TermsSection";
import { TERMS_CONFIG } from "../../../constants/termsConfig";

export default function JurisdictionSection() {
  return (
    <TermsSection id="jurisdiction" title="14. Governing Law & Jurisdiction">
      <p>
        These Terms shall be governed by and interpreted in accordance
        with the laws of the jurisdiction in which{" "}
        <strong>{TERMS_CONFIG.platformName}</strong> is registered and
        operates. Any disputes arising from these Terms shall be resolved
        through the competent courts of that jurisdiction.
      </p>
      <p>
        Where you access this platform from a different country, you remain
        responsible for ensuring that your use of MiniMart complies with
        all local laws and regulations applicable in your location.
      </p>
    </TermsSection>
  );
}
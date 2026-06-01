// src/components/terms/sections/ContactSection.jsx
import TermsSection from "../TermsSection";
import { TERMS_CONFIG } from "../../../constants/termsConfig";

export default function ContactSection() {
  return (
    <TermsSection id="contact" title="13. Contact Us">
      <p>
        If you have any questions, concerns, or requests regarding these
        Terms and Conditions or your use of MiniMart, please contact us
        through one of the following channels:
      </p>
      <ul>
        <li>
          <strong>General Support:</strong>{" "}
          <a href={`mailto:${TERMS_CONFIG.contact.support}`}>
            {TERMS_CONFIG.contact.support}
          </a>
        </li>
        <li>
          <strong>Fraud and Scam Reports:</strong>{" "}
          <a href={`mailto:${TERMS_CONFIG.contact.fraud}`}>
            {TERMS_CONFIG.contact.fraud}
          </a>
        </li>
        <li>
          <strong>Legal Enquiries:</strong>{" "}
          <a href={`mailto:${TERMS_CONFIG.contact.legal}`}>
            {TERMS_CONFIG.contact.legal}
          </a>
        </li>
      </ul>
      <p>
        We aim to respond to all enquiries within 3 to 5 business days.
      </p>
    </TermsSection>
  );
}
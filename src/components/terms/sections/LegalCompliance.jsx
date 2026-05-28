// src/components/terms/sections/LegalCompliance.jsx
import TermsSection from "../TermsSection";

export default function LegalCompliance() {
  return (
    <TermsSection id="legal-compliance" title="1. Legal Compliance">
      <p>
        By using MiniMart, you agree to fully comply with all applicable
        laws and regulations in your country and jurisdiction, including
        but not limited to:
      </p>
      <ul>
        <li>
          <strong>Consumer Protection Laws</strong> — You must not engage
          in deceptive trade practices, false advertising, or misleading
          representations of any product or service listed on this
          platform.
        </li>
        <li>
          <strong>Electronic Commerce Regulations</strong> — You
          acknowledge that electronic agreements made through this
          platform are legally binding under applicable e-commerce and
          digital signature legislation in your jurisdiction.
        </li>
        <li>
          <strong>Anti-Fraud and Cybercrime Laws</strong> — You must not
          use this platform for internet fraud, phishing, impersonation,
          identity theft, or obtaining money or goods by false pretense.
        </li>
        <li>
          <strong>Import and Customs Regulations</strong> — Items on any
          government prohibited or restricted list may not be listed on
          this platform.
        </li>
        <li>
          <strong>Health and Safety Regulations</strong> — Unregistered,
          counterfeit, or unsafe food, drugs, cosmetics, or consumer
          goods are strictly banned from listing.
        </li>
      </ul>
    </TermsSection>
  );
}
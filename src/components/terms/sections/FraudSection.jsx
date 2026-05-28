// src/components/terms/sections/FraudSection.jsx
import TermsSection from "../TermsSection";
import { TERMS_CONFIG } from "../../../constants/termsConfig";

export default function FraudSection() {
  return (
    <TermsSection id="fraud" title="7. Fraud Reporting and Law Enforcement">
      <p>
        MiniMart takes fraud and criminal misuse of the platform
        seriously. If you encounter a scammer, fraudulent listing, or
        suspicious user on MiniMart, please take the following steps:
      </p>
      <ul>
        <li>
          Report the listing or user immediately using the report button
          available on every listing and profile page.
        </li>
        <li>
          Contact our fraud team directly at{" "}
          <a href={`mailto:${TERMS_CONFIG.contact.fraud}`}>
            {TERMS_CONFIG.contact.fraud}
          </a>{" "}
          with as much detail as possible.
        </li>
        <li>
          MiniMart may cooperate with law enforcement agencies and
          regulatory authorities where legally required or where we
          determine cooperation is in the public interest.
        </li>
        <li>
          We reserve the right to preserve and disclose user data
          including IP addresses, device identifiers, phone numbers,
          and listing history to authorities upon receipt of a valid
          legal order.
        </li>
        <li>
          Submitting false or malicious fraud reports against other
          users is itself a violation of these Terms and may result in
          suspension of your account.
        </li>
      </ul>
    </TermsSection>
  );
}
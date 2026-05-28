// src/components/terms/sections/PrivacySection.jsx
import TermsSection from "../TermsSection";
import { TERMS_CONFIG } from "../../../constants/termsConfig";

export default function PrivacySection() {
  return (
    <TermsSection id="privacy" title="6. Privacy and Data">
      <p>
        MiniMart is committed to protecting your personal data in
        accordance with applicable data protection and privacy
        regulations in your jurisdiction.
      </p>
      <ul>
        <li>
          By posting an ad, you consent to your contact information
          being visible to potential buyers or sellers on the platform.
        </li>
        <li>
          We collect only the data necessary to operate the platform,
          including your name, phone number, email address, location,
          and listing content.
        </li>
        <li>
          We will not sell, rent, or share your personal data with
          third-party advertisers without your explicit consent.
        </li>
        <li>
          You have the right to request access to, correction of, or
          deletion of your personal data at any time by contacting us
          at{" "}
          <a href={`mailto:${TERMS_CONFIG.contact.support}`}>
            {TERMS_CONFIG.contact.support}
          </a>
          .
        </li>
        <li>
          MiniMart will never ask for your password, bank PIN, one-time
          password (OTP), or any sensitive authentication credential
          through any channel.
        </li>
        <li>
          Data you submit to this platform may be stored on servers
          located outside your country of residence. By using MiniMart,
          you consent to this transfer where applicable law permits.
        </li>
      </ul>
    </TermsSection>
  );
}
// src/components/terms/sections/AccountSection.jsx
import TermsSection from "../TermsSection";

export default function AccountSection() {
  return (
    <TermsSection id="account" title="8. Account Suspension and Removal">
      <p>
        MiniMart reserves the right to remove listings, suspend
        accounts, or permanently ban users at our sole discretion.
        Actions that may result in suspension or removal include but
        are not limited to:
      </p>
      <ul>
        <li>Violating any part of these Terms and Conditions.</li>
        <li>
          Engaging in fraud, impersonation, scamming, or any form of
          deception toward other users.
        </li>
        <li>
          Posting prohibited items or repeatedly posting listings that
          violate our guidelines.
        </li>
        <li>
          Harassing, threatening, or abusing other users through any
          channel including messages, listings, or reviews.
        </li>
        <li>
          Posting spam, duplicate listings, or automated content without
          authorization.
        </li>
        <li>
          Attempting to circumvent platform rules, safety systems, or
          moderation tools.
        </li>
      </ul>
      <p>
        Suspended users may not create new accounts. Attempting to
        create a new account following a permanent ban may result in
        escalation to law enforcement or legal action.
      </p>
      <p>
        MiniMart is not obligated to provide prior notice before
        removing a listing or suspending an account. We are also not
        obligated to provide a reason for removal in all cases.
      </p>
    </TermsSection>
  );
}
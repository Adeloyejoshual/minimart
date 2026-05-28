// src/components/terms/sections/PaymentsSection.jsx
import TermsSection from "../TermsSection";
import WarningCard  from "../WarningCard";

export default function PaymentsSection() {
  return (
    <TermsSection id="payments" title="2. Payment and Transactions">

      <WarningCard variant="warning">
        <strong>Important:</strong> MiniMart is not a payment platform.
        We do not process, hold, escrow, or guarantee any payments
        between users.
      </WarningCard>

      <ul>
        <li>
          <strong>Do not pay in advance</strong> — never send money for
          delivery fees, commitment fees, reservation fees, or any
          upfront cost before physically inspecting the item.
        </li>
        <li>
          Payments should be made via bank transfer or cash only after
          you have inspected the item in person and are satisfied with
          its condition.
        </li>
        <li>
          MiniMart is not responsible for any financial loss resulting
          from transactions between users.
        </li>
        <li>
          We do not offer buyer protection, escrow services, or payment
          guarantees of any kind.
        </li>
        <li>
          Any payment dispute is solely between the buyer and the seller.
          MiniMart has no obligation to intervene or mediate.
        </li>
      </ul>
    </TermsSection>
  );
}
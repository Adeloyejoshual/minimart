// src/components/terms/sections/SafetySection.jsx
import TermsSection from "../TermsSection";
import WarningCard  from "../WarningCard";

export default function SafetySection() {
  return (
    <TermsSection id="safety" title="5. Safety Guidelines">

      <WarningCard variant="warning">
        <strong>Scam Alert:</strong> If a price looks too good to be
        true — for example, a high-end smartphone listed for a fraction
        of its market value — it is almost certainly a scam. Do not
        proceed with the transaction.
      </WarningCard>

      <h4>Meeting in Person</h4>
      <ul>
        <li>
          Always meet in busy, public places such as shopping centers,
          fast-food restaurants, or fuel stations with CCTV coverage.
        </li>
        <li>
          Consider meeting at a police station or other official public
          building if you have any concerns about safety.
        </li>
        <li>
          Bring a trusted friend or family member when meeting a stranger
          for a transaction.
        </li>
        <li>
          <strong>Inspect before you pay</strong> — always test phones,
          laptops, electronics, and other goods before handing over any
          money.
        </li>
        <li>
          Never share your home address with a buyer or seller you do not
          know and trust.
        </li>
        <li>
          Trust your instincts. If something feels wrong at any point,
          walk away from the transaction.
        </li>
      </ul>

      <h4>Recognizing Common Scams</h4>
      <ul>
        <li>
          <strong>"Pay the delivery fee first"</strong> — legitimate
          sellers do not ask for delivery fees before you receive the
          item. This is a common advance fee scam.
        </li>
        <li>
          <strong>"I am traveling and will ship it to you"</strong> —
          be very cautious of sellers who refuse to meet in person or
          claim to be abroad.
        </li>
        <li>
          <strong>"Send me your account details to receive payment"</strong>
          — never share sensitive banking information, OTP codes, PINs,
          or passwords with any buyer or seller.
        </li>
        <li>
          <strong>Overpayment scam</strong> — a buyer sends more than
          the agreed price via cheque or transfer and asks you to refund
          the difference. The original payment later bounces or reverses.
        </li>
        <li>
          <strong>Fake payment confirmation</strong> — a buyer sends a
          fabricated screenshot or SMS claiming payment has been made.
          Always verify funds in your account before releasing any item.
        </li>
      </ul>
    </TermsSection>
  );
}
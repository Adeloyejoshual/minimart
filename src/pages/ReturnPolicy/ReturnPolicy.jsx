import { Link, useNavigate } from "react-router-dom";
import "./ReturnPolicy.css";

const sections = [
  {
    title: "1. Return window",
    body: "For eligible Loemart Market orders, you may request a return within 3 calendar days after the order is marked as delivered. Contact support within this period and wait for return instructions before sending an item back."
  },
  {
    title: "2. When an item may be returned",
    intro: "A return may be considered when:",
    bullets: [
      "The item arrived damaged or defective.",
      "You received an item different from the one you ordered.",
      "The item is materially different from its product description or photos.",
      "The order was incomplete or an included component was missing."
    ],
    note: "A change of mind or a preference-based request is not automatically eligible. Eligibility is assessed against the listing, the order details and applicable consumer-protection requirements."
  },
  {
    title: "3. Condition of returned items",
    body: "Keep the item, packaging, accessories, labels and any included parts in the condition received. Do not use, repair, alter or dispose of a disputed item. If an item arrived damaged or defective, tell us before doing anything that could affect inspection. This condition does not remove your rights where an item is faulty or was supplied incorrectly."
  },
  {
    title: "4. Return shipping",
    body: "Approved returns covered by this policy are returned at no charge to the customer. Loemart Support will confirm the return method and instructions. Do not independently ship an item to a seller or address until Support has confirmed where and how it should be returned."
  },
  {
    title: "5. How to request a return",
    bullets: [
      "Contact Loemart Support as soon as possible and within 3 calendar days of delivery.",
      "Include your order number, the product name and a clear explanation of the issue.",
      "Attach clear photos or a short video where these help show damage, a defect, a wrong item or missing parts.",
      "Keep the item and its packaging until Support gives you instructions.",
      "Follow the approved return instructions and provide any requested tracking or handover confirmation."
    ]
  },
  {
    title: "6. Inspection and refunds",
    body: "After the returned item is received, it may be inspected against the return reason and order details. If the return is approved, Loemart will arrange the applicable refund to the original payment method where supported, or contact you about an appropriate alternative. Refund timing depends on the payment provider and bank. Support will communicate the decision and next steps. A refund is not considered completed merely because a return request has been submitted."
  },
  {
    title: "7. Items that may not qualify",
    body: "Some items may be excluded where permitted by applicable law, including perishable goods, products made to a customer's specifications, and sealed hygiene or personal-care products that have been unsealed after delivery. Items damaged through misuse, unauthorised repair or accidental damage after delivery may also be ineligible. These exclusions do not limit rights relating to goods that are defective, unsafe, misdescribed or incorrectly supplied."
  },
  {
    title: "8. Marketplace and seller listings",
    body: "Loemart is a marketplace connecting customers with independent sellers. Product-specific warranty information or additional return terms may appear on an individual listing. Any listing-specific term must be read together with this policy and cannot remove rights that customers have under applicable law. For an order-related return, contact Loemart Support first so the request can be directed appropriately."
  },
  {
    title: "9. Contact Loemart",
    body: "For return or refund assistance, email support@loemart.com. Include your order number in the subject line where possible. Please do not include full payment-card details or passwords in your message."
  }
];

function Section({ section }) {
  return (
    <section className="lm-return-section">
      <h2>{section.title}</h2>
      {section.intro && <p>{section.intro}</p>}
      {section.body && <p>{section.body}</p>}
      {section.bullets && (
        <ul>
          {section.bullets.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
      {section.note && <p className="lm-return-note">{section.note}</p>}
    </section>
  );
}

export default function ReturnPolicy() {
  const navigate = useNavigate();

  return (
    <main className="lm-return-page">
      <header className="lm-return-header">
        <button type="button" onClick={() => navigate(-1)} aria-label="Go back" className="lm-return-back">
          <span aria-hidden="true">←</span>
        </button>
        <Link to="/loemart" className="lm-return-brand">
          <span className="lm-return-brand-mark">L</span>
          <span>Loemart</span>
        </Link>
        <span className="lm-return-header-label">Customer care</span>
      </header>

      <div className="lm-return-content">
        <div className="lm-return-hero">
          <span className="lm-return-eyebrow">CUSTOMER PROTECTION</span>
          <div className="lm-return-icon" aria-hidden="true">↩</div>
          <h1>Return &amp; Refund Policy</h1>
          <p>Clear guidance for eligible returns and refunds on Loemart Market orders in Nigeria.</p>
          <div className="lm-return-highlights">
            <div><strong>3 days</strong><span>Return request window</span></div>
            <div><strong>Free</strong><span>Approved eligible returns</span></div>
            <div><strong>Nigeria</strong><span>Policy coverage</span></div>
          </div>
        </div>

        <div className="lm-return-intro">
          <p>We want customers to shop with confidence. This policy explains when a return may be requested, how to contact us, and what happens after an item is returned.</p>
          <p><strong>Important:</strong> Submit your request within 3 calendar days after delivery and wait for instructions from Loemart Support before returning an item.</p>
        </div>

        {sections.map((section) => <Section key={section.title} section={section} />)}

        <div className="lm-return-contact">
          <h2>Need help with an order?</h2>
          <p>Our support team can guide you through a return or refund request.</p>
          <a href="mailto:support@loemart.com?subject=Return%20or%20refund%20request">Email support@loemart.com</a>
        </div>

        <p className="lm-return-updated">Policy applies to Loemart Market orders in Nigeria. Please check the product listing for any additional product-specific warranty information.</p>
      </div>

      <footer className="lm-return-footer">
        <Link to="/terms">Terms of Service</Link>
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/help">Help Centre</Link>
        <span>© {new Date().getFullYear()} Loemart Technologies Ltd.</span>
      </footer>
    </main>
  );
}

// src/data/legal/termsSections.js

/**
 * Declarative registry of all Terms and Conditions sections.
 *
 * Benefits of data-driven section rendering:
 *   - Reorder sections by changing array order only
 *   - Enable/disable sections via feature flags
 *   - Track section-level analytics
 *   - Support future CMS integration
 *   - Simplify multilingual/country-specific overrides
 *   - Enable A/B testing of section presentation
 *
 * Each section entry shape:
 * {
 *   id          : string   — unique identifier, used for aria + anchors
 *   title       : string   — section heading (no emoji)
 *   component   : React.FC — the section content component
 *   required    : boolean  — whether section is legally mandatory
 *   enabled     : boolean  — feature flag for enabling/disabling
 * }
 */

import LegalCompliance      from "../../components/terms/sections/LegalCompliance";
import PaymentsSection      from "../../components/terms/sections/PaymentsSection";
import ProhibitedItems      from "../../components/terms/sections/ProhibitedItems";
import ListingGuidelines    from "../../components/terms/sections/ListingGuidelines";
import SafetySection        from "../../components/terms/sections/SafetySection";
import PrivacySection       from "../../components/terms/sections/PrivacySection";
import FraudSection         from "../../components/terms/sections/FraudSection";
import AccountSection       from "../../components/terms/sections/AccountSection";
import LiabilitySection     from "../../components/terms/sections/LiabilitySection";
import ElectronicAcceptance from "../../components/terms/sections/ElectronicAcceptance";
import JurisdictionSection  from "../../components/terms/sections/JurisdictionSection";
import TermsChanges         from "../../components/terms/sections/TermsChanges";
import ContactSection       from "../../components/terms/sections/ContactSection";
import AcceptanceNotice     from "../../components/terms/sections/AcceptanceNotice";

export const TERMS_SECTIONS = [
  {
    id        : "legal-compliance",
    title     : "1. Legal Compliance",
    component : LegalCompliance,
    required  : true,
    enabled   : true,
  },
  {
    id        : "payments",
    title     : "2. Payment and Transactions",
    component : PaymentsSection,
    required  : true,
    enabled   : true,
  },
  {
    id        : "prohibited-items",
    title     : "3. Prohibited Items",
    component : ProhibitedItems,
    required  : true,
    enabled   : true,
  },
  {
    id        : "listing-guidelines",
    title     : "4. Listing and Photo Guidelines",
    component : ListingGuidelines,
    required  : true,
    enabled   : true,
  },
  {
    id        : "safety",
    title     : "5. Safety Guidelines",
    component : SafetySection,
    required  : true,
    enabled   : true,
  },
  {
    id        : "privacy",
    title     : "6. Privacy and Data",
    component : PrivacySection,
    required  : true,
    enabled   : true,
  },
  {
    id        : "fraud",
    title     : "7. Fraud Reporting and Law Enforcement",
    component : FraudSection,
    required  : true,
    enabled   : true,
  },
  {
    id        : "account",
    title     : "8. Account Suspension and Removal",
    component : AccountSection,
    required  : true,
    enabled   : true,
  },
  {
    id        : "liability",
    title     : "9. Limitation of Liability",
    component : LiabilitySection,
    required  : true,
    enabled   : true,
  },
  {
    id        : "electronic-acceptance",
    title     : "10. Electronic Acceptance",
    component : ElectronicAcceptance,
    required  : true,
    enabled   : true,
  },
  {
    id        : "jurisdiction",
    title     : "11. Governing Law and Jurisdiction",
    component : JurisdictionSection,
    required  : true,
    enabled   : true,
  },
  {
    id        : "changes",
    title     : "12. Changes to Terms",
    component : TermsChanges,
    required  : true,
    enabled   : true,
  },
  {
    id        : "contact",
    title     : "13. Contact Us",
    component : ContactSection,
    required  : false,
    enabled   : true,
  },
  {
    id        : "acceptance-notice",
    title     : "",
    component : AcceptanceNotice,
    required  : true,
    enabled   : true,
  },
];

/**
 * Returns only the enabled sections.
 * Components should always render from this filtered list.
 *
 * @returns {object[]}
 */
export function getEnabledSections() {
  return TERMS_SECTIONS.filter((section) => section.enabled);
}

/**
 * Returns only the required sections.
 * Useful for compliance verification and testing.
 *
 * @returns {object[]}
 */
export function getRequiredSections() {
  return TERMS_SECTIONS.filter((section) => section.required);
}
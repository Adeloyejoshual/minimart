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
 * Imports are sourced exclusively from the barrel file.
 * This ensures a single canonical import path across the
 * entire codebase. If a section file moves, only index.js
 * needs updating — not this file.
 *
 * Each section entry shape:
 * {
 *   id        : string    — unique identifier, used for aria + anchors
 *   title     : string    — section heading (empty string for non-heading sections)
 *   component : React.FC  — the section content component
 *   required  : boolean   — whether section is legally mandatory
 *   enabled   : boolean   — feature flag for enabling/disabling
 * }
 */

import {
  LegalCompliance,
  PaymentsSection,
  ProhibitedItems,
  ListingGuidelines,
  SafetySection,
  PrivacySection,
  FraudSection,
  AccountSection,
  LiabilitySection,
  ElectronicAcceptance,
  JurisdictionSection,
  TermsChanges,
  ContactSection,
  AcceptanceNotice,
} from "../../components/terms/index.js";

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
 * TermsAndConditions.jsx always renders from this list.
 *
 * @returns {object[]}
 */
export function getEnabledSections() {
  return TERMS_SECTIONS.filter((section) => section.enabled);
}

/**
 * Returns only the required sections.
 * Used in compliance verification and test assertions.
 *
 * @returns {object[]}
 */
export function getRequiredSections() {
  return TERMS_SECTIONS.filter((section) => section.required);
}

/**
 * Returns a single section by its id.
 * Useful for targeted updates and admin tooling.
 *
 * @param {string} id
 * @returns {object | undefined}
 */
export function getSectionById(id) {
  return TERMS_SECTIONS.find((section) => section.id === id);
}
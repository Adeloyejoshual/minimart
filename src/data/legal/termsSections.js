// src/data/legal/termsSections.js

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

export function getEnabledSections() {
  return TERMS_SECTIONS.filter((section) => section.enabled);
}

export function getRequiredSections() {
  return TERMS_SECTIONS.filter((section) => section.required);
}

export function getSectionById(id) {
  return TERMS_SECTIONS.find((section) => section.id === id);
}
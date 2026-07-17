/**
 * src/pages/product/components/icons/index.jsx
 * All SVG icon components used across the product pages
 */

export const LocationPinIcon = () => (
  <svg viewBox="0 0 20 20" width="15" height="15" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 2a6 6 0 016 6c0 4-6 10-6 10S4 12 4 8a6 6 0 016-6z"/>
    <circle cx="10" cy="8" r="2"/>
  </svg>
);

export const SpinnerIcon = () => (
  <svg className="btn-spin-svg" viewBox="0 0 20 20" width="15" height="15"
       fill="none" stroke="currentColor" strokeWidth="2.2"
       strokeLinecap="round" aria-hidden="true">
    <circle cx="10" cy="10" r="7" strokeOpacity="0.25"/>
    <path d="M10 3a7 7 0 017 7"/>
  </svg>
);

export const WarningIcon = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9.26 3.23L2.02 15.5A.9.9 0 002.76 17h14.48a.9.9 0 00.74-1.5L10.74 3.23a.9.9 0 00-1.48 0z"/>
    <line x1="10" y1="8" x2="10" y2="12"/>
    <circle cx="10" cy="14.5" r="0.5" fill="currentColor" stroke="none"/>
  </svg>
);

export const CheckCircleIcon = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="10" cy="10" r="8"/>
    <polyline points="6 10 9 13 14 7"/>
  </svg>
);

export const CardIcon = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="16" height="12" rx="2"/>
    <line x1="2" y1="9" x2="18" y2="9"/>
  </svg>
);

export const ClockIcon = () => (
  <svg viewBox="0 0 20 20" width="13" height="13" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="10" cy="10" r="8"/>
    <polyline points="10 6 10 10 13 12"/>
  </svg>
);

export const ShieldIcon = () => (
  <svg viewBox="0 0 20 20" width="16" height="16" fill="none"
       stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 2L4 5v5c0 4.4 2.6 8.2 6 9.6 3.4-1.4 6-5.2 6-9.6V5l-6-3z"/>
  </svg>
);

export const ImageIcon = () => (
  <svg viewBox="0 0 20 20" width="22" height="22" fill="none"
       stroke="currentColor" strokeWidth="1.4"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="16" height="14" rx="2"/>
    <circle cx="7" cy="8" r="1.5"/>
    <polyline points="2 14 6 10 9 13 12 10 18 15"/>
  </svg>
);

export const CheckIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none"
       stroke="currentColor" strokeWidth="2.2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="2 8 6 12 14 4"/>
  </svg>
);

export const StarIcon = () => (
  <svg viewBox="0 0 20 20" width="12" height="12" fill="currentColor" aria-hidden="true">
    <polygon points="10 1 12.9 7 19.5 7.6 14.5 12 16.2 18.5 10 15 3.8 18.5 5.5 12 0.5 7.6 7.1 7"/>
  </svg>
);
// src/components/terms/sections/ListingGuidelines.jsx
import TermsSection from "../TermsSection";

export default function ListingGuidelines() {
  return (
    <TermsSection id="listing-guidelines" title="4. Listing and Photo Guidelines">
      <p>
        All listings on MiniMart must be honest, accurate, and compliant
        with these guidelines. Listings that violate these rules will be
        removed without notice.
      </p>
      <ul>
        <li>
          Your title and description must accurately represent the item
          being sold. Misleading titles or descriptions are not permitted.
        </li>
        <li>
          Photos must show the actual item you are selling. Stock images,
          photos of different items, or images taken from other websites
          are not allowed.
        </li>
        <li>
          Do not include watermarks or branding from other classifieds
          platforms in your photos.
        </li>
        <li>
          Do not include personal or sensitive information in your photos
          such as your home address, bank details, or identification
          documents.
        </li>
        <li>
          No offensive, explicit, violent, or unrelated images may be
          used in any listing.
        </li>
        <li>
          The price listed must reflect your real asking price. Bait and
          switch tactics — advertising a low price and charging more
          upon contact — are strictly prohibited.
        </li>
        <li>
          Duplicate listings of the same item are not permitted. Post
          each item only once.
        </li>
        <li>
          Listings must be placed in the correct category. Miscategorized
          listings may be removed or recategorized at our discretion.
        </li>
      </ul>
    </TermsSection>
  );
}
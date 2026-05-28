// src/components/terms/sections/ProhibitedItems.jsx
import TermsSection from "../TermsSection";

export default function ProhibitedItems() {
  return (
    <TermsSection id="prohibited-items" title="3. Prohibited Items">
      <p>
        The following items are strictly banned from being listed on
        MiniMart. Listings containing prohibited items will be removed
        immediately and may result in permanent account suspension.
      </p>

      <h4>Dangerous and Illegal Items</h4>
      <ul>
        <li>
          Firearms, locally made weapons, ammunition, or explosives of
          any kind.
        </li>
        <li>
          Military or police uniforms, badges, or official equipment.
        </li>
        <li>
          Stolen goods or items with removed, altered, or defaced serial
          numbers.
        </li>
        <li>
          Hazardous chemicals, toxic substances, or explosive materials.
        </li>
      </ul>

      <h4>Drugs and Medications</h4>
      <ul>
        <li>
          Controlled substances, narcotics, or any drug banned by
          applicable law in your jurisdiction.
        </li>
        <li>
          Unregistered pharmaceuticals or expired medications.
        </li>
        <li>
          Prescription medications listed without proper authorization.
        </li>
      </ul>

      <h4>Fake and Forged Documents</h4>
      <ul>
        <li>
          Fake identification documents including passports, national
          ID cards, or driver licenses.
        </li>
        <li>
          Forged academic certificates, professional qualifications, or
          government-issued documents of any kind.
        </li>
        <li>
          Counterfeit currency or financial instruments.
        </li>
      </ul>

      <h4>Restricted and Sensitive Items</h4>
      <ul>
        <li>
          Adult, explicit, or pornographic content of any kind.
        </li>
        <li>
          Human remains, body parts, or biological material.
        </li>
        <li>
          Live animals listed without valid permits or documentation
          required by local law.
        </li>
        <li>
          Products that have been recalled by a government authority or
          manufacturer.
        </li>
      </ul>

      <h4>Property and Land Listings</h4>
      <ul>
        <li>
          Property listings must include valid proof of ownership or
          legal authority to sell. Listings without such documentation
          are subject to immediate removal.
        </li>
        <li>
          Listing property you do not legally own or have authority to
          sell may constitute fraud and could result in legal action.
        </li>
      </ul>
    </TermsSection>
  );
}
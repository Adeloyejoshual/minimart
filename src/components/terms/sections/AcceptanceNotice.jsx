// src/components/terms/sections/AcceptanceNotice.jsx
import WarningCard from "../WarningCard";

export default function AcceptanceNotice() {
  return (
    <WarningCard variant="success">
      By clicking <strong>"Post Ad"</strong>, you confirm that you have
      read, understood, and agreed to these Terms and Conditions in their
      entirety and that they are legally binding upon you.
    </WarningCard>
  );
}
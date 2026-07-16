// src/pages/Profile/Verification.jsx
import { useState, useEffect } from "react";
import VerificationMobile  from "./VerificationMobile";
import VerificationDesktop from "../../desktop/VerificationDesktop";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia("(min-width: 1024px)").matches
  );
  useEffect(() => {
    const mq      = window.matchMedia("(min-width: 1024px)");
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

export default function Verification(props) {
  const isDesktop = useIsDesktop();
  return isDesktop
    ? <VerificationDesktop  {...props} />
    : <VerificationMobile   {...props} />;
}
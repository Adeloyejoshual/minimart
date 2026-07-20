/**
 * src/pages/AuthPage/index.jsx
 * Device switcher — picks mobile or desktop version.
 */

import { useState, useEffect } from "react";
import AuthPageMobile          from "./AuthPage/AuthPageMobile";
import AuthPageDesktop         from "./AuthPage/AuthPageDesktop";

/* ════════════════════════════════════════════════════════════
   DEVICE HOOK
════════════════════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════════════════════
   EXPORTS
   InviteRedirect is re-exported here so the router only
   needs to import from "pages/AuthPage" — one entry point.
════════════════════════════════════════════════════════════ */
export { InviteRedirect } from "./AuthPageDesktop";

/* ════════════════════════════════════════════════════════════
   SWITCHER
════════════════════════════════════════════════════════════ */
export default function AuthPage(props) {
  const isDesktop = useIsDesktop();

  return isDesktop
    ? <AuthPageDesktop {...props} />
    : <AuthPageMobile  {...props} />;
}
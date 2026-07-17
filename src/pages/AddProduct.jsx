/**
 * src/pages/AddProduct.jsx
 * Device switcher — picks mobile or desktop version.
 */

import { useState, useEffect } from "react";
import AddProductMobile        from "./AddProductMobile";
import AddProductDesktop       from "../desktop/AddProductDesktop";

/* ═══════════════════════════════════════════════════════════════
   DEVICE HOOK
═══════════════════════════════════════════════════════════════ */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia("(min-width: 1024px)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isDesktop;
}

/* ═══════════════════════════════════════════════════════════════
   SWITCHER
═══════════════════════════════════════════════════════════════ */
export default function AddProduct(props) {
  const isDesktop = useIsDesktop();

  return isDesktop
    ? <AddProductDesktop {...props} />
    : <AddProductMobile  {...props} />;
}
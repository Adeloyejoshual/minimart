/**
 * src/pages/AddProduct.jsx
 * Route: /minimart/add
 *       /minimart/add?edit=:productId
 *
 * Device switcher — renders mobile or desktop version based on viewport.
 */

import { useState, useEffect } from "react";
import AddProductMobile        from "./AddProductMobile.jsx";
import AddProductDesktop       from "./AddProductDesktop.jsx";

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
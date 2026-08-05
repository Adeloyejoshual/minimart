/**
 * src/loemart/HomePage.jsx
 * Route: /loemart
 *
 * Responsive router — picks mobile or desktop layout
 * No changes to App.jsx
 */

import { useEffect, useState } from "react";
import HomePageMobile  from "./HomePageMobile";
import HomePageDesktop from "./HomePageDesktop";

const DESKTOP_BREAKPOINT = 1024;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" &&
      window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isDesktop;
}

export default function HomePage({ user }) {
  const isDesktop = useIsDesktop();
  return isDesktop
    ? <HomePageDesktop user={user} />
    : <HomePageMobile  user={user} />;
}
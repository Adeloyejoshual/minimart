import { useState, useEffect } from "react";
import DashboardMobile from "./DashboardMobile";
import DashboardDesktop from "../../desktop/DashboardDesktop";

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

export default function Dashboard(props) {
  const isDesktop = useIsDesktop();

  return isDesktop
    ? <DashboardDesktop {...props} />
    : <DashboardMobile {...props} />;
}
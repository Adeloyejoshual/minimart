// src/pages/Profile/SpinWheel.jsx
import { useState, useEffect } from "react";
import SpinWheelMobile  from "./SpinWheelMobile";
import SpinWheelDesktop from "../../desktop/SpinWheelDesktop";

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

export default function SpinWheel(props) {
  const isDesktop = useIsDesktop();
  return isDesktop
    ? <SpinWheelDesktop {...props} />
    : <SpinWheelMobile  {...props} />;
}
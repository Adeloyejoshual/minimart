// src/pages/Profile/EditProfile.jsx
import { useState, useEffect } from "react";
import EditProfileMobile  from "./EditProfileMobile";
import EditProfileDesktop from "../../desktop/EditProfileDesktop";

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

export default function EditProfile(props) {
  const isDesktop = useIsDesktop();

  return isDesktop
    ? <EditProfileDesktop {...props} />
    : <EditProfileMobile {...props} />;
}
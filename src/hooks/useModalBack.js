// src/hooks/useModalBack.js
import { useEffect } from "react";

export default function useModalBack(isOpen, onClose) {
  useEffect(() => {
    if (!isOpen) return;

    // 1. When modal opens, push a fake state to the phone's history stack
    window.history.pushState({ isModalOpen: true }, "");

    // 2. Listen for the phone's hardware back button (popstate)
    const handlePopState = () => {
      // The back button was pressed, so trigger the close function
      onClose();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      
      // 3. If the user closed the modal by clicking the "X" button instead 
      // of the back button, we need to clean up the history stack.
      if (window.history.state?.isModalOpen) {
        window.history.back();
      }
    };
  }, [isOpen, onClose]);
}
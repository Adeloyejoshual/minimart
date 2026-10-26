import { useEffect, useRef, useCallback } from "react";

/**
 * Custom hook to intercept phone hardware back button.
 * - On Open: Adds a dummy entry to browser history.
 * - On Hardware Back: Triggers `onClose` instead of leaving the page.
 * - On UI Close (X button, overlay click): Cleans up the dummy history so it doesn't pile up.
 */
export default function useModalBack(isOpen, onClose) {
  const pushedRef = useRef(false);
  const closingFromUIRef = useRef(false);
  const onCloseRef = useRef(onClose);

  // Keep ref updated to avoid stale closures
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      pushedRef.current = false;
      closingFromUIRef.current = false;
      return;
    }

    // Modal opened -> push a dummy history state
    window.history.pushState({ __modalOpen: true }, "");
    pushedRef.current = true;

    const handlePopState = () => {
      pushedRef.current = false;

      // If we manually triggered history.back() via requestClose, ignore this event
      if (closingFromUIRef.current) {
        closingFromUIRef.current = false;
        return;
      }

      // Otherwise, the user pressed the Phone's physical Back button
      onCloseRef.current?.();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      
      // Cleanup if the component unmounts unexpectedly while open
      if (pushedRef.current && window.history.state?.__modalOpen) {
        pushedRef.current = false;
        window.history.back();
      }
    };
  }, [isOpen]);

  // Use this function for your UI close buttons (Overlay, X button, Cancel button)
  const requestClose = useCallback(() => {
    if (pushedRef.current && window.history.state?.__modalOpen) {
      closingFromUIRef.current = true;
      pushedRef.current = false;
      window.history.back(); // Remove the dummy state
      onCloseRef.current?.(); // Close the modal visually
    } else {
      onCloseRef.current?.();
    }
  }, []);

  return requestClose;
}
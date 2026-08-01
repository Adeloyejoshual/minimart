import { useState, useCallback, useRef, useEffect } from "react";

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message, type = "info", duration = 4000, onClick = null) => {
      const id = ++toastId;

      /* Wrap onClick to auto-dismiss on click */
      const wrappedOnClick = onClick
        ? () => {
            onClick();
            remove(id);
          }
        : null;

      setToasts((prev) => [
        ...prev,
        { id, message, type, onClick: wrappedOnClick },
      ]);

      /* Auto-dismiss after duration */
      if (duration > 0) {
        const timer = setTimeout(() => remove(id), duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [remove]
  );

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  return { toasts, show, remove };
}
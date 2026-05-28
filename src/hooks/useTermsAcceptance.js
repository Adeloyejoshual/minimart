// src/hooks/useTermsAcceptance.js
import { useState, useEffect, useCallback } from "react";
import { hasAcceptedCurrentVersion }        from "../utils/termsStorage";
import { isAcceptanceValid }                from "../utils/termsValidation";
import { postAcceptance }                   from "../services/legal/acceptanceService";

/**
 * Manages all acceptance state, version checks,
 * localStorage sync, and backend submission.
 *
 * Separated from useTermsScroll intentionally —
 * acceptance logic and scroll tracking are distinct concerns.
 *
 * @param {object} options
 * @param {Function} options.setHasRead - Setter from useTermsScroll
 * @param {string|null} options.userId  - Authenticated user ID (optional)
 */
export function useTermsAcceptance({ setHasRead, userId = null }) {
  const [agreed,          setAgreed         ] = useState(false);
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);
  const [isSubmitting,    setIsSubmitting   ] = useState(false);
  const [submitError,     setSubmitError    ] = useState(null);

  // ── On mount: check if user already accepted current version ──
  useEffect(() => {
    if (hasAcceptedCurrentVersion()) {
      setHasRead(true);
      setAgreed(true);
      setAlreadyAccepted(true);
    }
  }, [setHasRead]);

  /**
   * Submits acceptance — persists locally and optionally to backend.
   * Only proceeds if both hasRead and agreed are true.
   */
  const handleAccept = useCallback(
    async ({ hasRead, onSuccess }) => {
      if (!isAcceptanceValid({ hasRead, agreed })) return;

      setIsSubmitting(true);
      setSubmitError(null);

      const result = await postAcceptance(userId);

      setIsSubmitting(false);

      if (result.success || !userId) {
        // ── Guest or successful API call — proceed ──
        if (onSuccess) onSuccess();
      } else {
        // ── API failed — do not block, but surface the error ──
        setSubmitError(
          "Could not sync your acceptance with our servers. " +
          "Your local record has been saved. Please try again later."
        );
        // Still allow navigation — local record is saved
        if (onSuccess) onSuccess();
      }
    },
    [agreed, userId]
  );

  return {
    agreed,
    setAgreed,
    alreadyAccepted,
    isSubmitting,
    submitError,
    handleAccept,
  };
}
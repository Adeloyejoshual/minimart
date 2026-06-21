import { useRef, useEffect } from "react";

export function OTPInput({
  length   = 6,
  value    = "",
  onChange,
  disabled = false,
  hasError = false,
}) {
  const refs = useRef([]);

  /* auto-focus first box */
  useEffect(() => {
    const t = setTimeout(() => refs.current[0]?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  /* re-focus first empty box when error shake clears */
  useEffect(() => {
    if (!hasError) return;
    const t = setTimeout(() => {
      const first = refs.current.findIndex((r) => !r?.value);
      refs.current[Math.max(0, first)]?.focus();
    }, 700);
    return () => clearTimeout(t);
  }, [hasError]);

  const getChar = (idx) => value[idx] || "";

  const update = (idx, char) => {
    const arr = Array.from({ length }, (_, i) => value[i] || "");
    arr[idx]  = char;
    onChange(arr.join(""));
  };

  const handleChange = (e, idx) => {
    const digit = e.target.value.replace(/\D/g, "").slice(-1);
    update(idx, digit);
    if (digit && idx < length - 1) {
      refs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (getChar(idx)) {
        update(idx, "");
      } else if (idx > 0) {
        update(idx - 1, "");
        refs.current[idx - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      refs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < length - 1) {
      refs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const digits = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length);
    // fill exactly `length` slots
    const result = Array.from({ length }, (_, i) => digits[i] || "").join("");
    onChange(result);
    // focus last filled or next empty
    const focusIdx = Math.min(digits.length, length - 1);
    refs.current[focusIdx]?.focus();
  };

  return (
    <div
      className={`otp-group ${hasError ? "otp-group--error" : ""}`}
      role="group"
      aria-label="One-time password input"
    >
      {Array.from({ length }).map((_, i) => {
        const filled = Boolean(getChar(i));
        return (
          <input
            key={i}
            ref={(el) => (refs.current[i] = el)}
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={1}
            value={getChar(i)}
            disabled={disabled}
            aria-label={`Digit ${i + 1} of ${length}`}
            className={[
              "otp-cell",
              filled     ? "otp-cell--filled" : "",
              hasError   ? "otp-cell--error"  : "",
            ].join(" ")}
            onChange={(e)  => handleChange(e, i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onFocus={(e)   => e.target.select()}
            onPaste={handlePaste}
          />
        );
      })}
    </div>
  );
}
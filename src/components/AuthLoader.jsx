/**
 * src/components/AuthLoader.jsx
 *
 * Full-screen loading spinner.
 * Used by App.jsx (session restore) and HomePageMobile.jsx (first load).
 *
 * Self-contained: it defines its own keyframes, so it spins correctly
 * on any page without depending on global CSS.
 */

import { memo } from "react";

const AuthLoader = memo(function AuthLoader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg, #f8f9fa)",
      }}
      role="status"
      aria-label="Restoring your session"
      aria-busy="true"
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: "3px solid var(--bd, #e9ecef)",
          borderTop: "3px solid var(--o, #ff6000)",
          borderRadius: "50%",
          animation: "lm-auth-spin .7s linear infinite",
        }}
      />

      <style>
        {`
          @keyframes lm-auth-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
});

export { AuthLoader };
export default AuthLoader;

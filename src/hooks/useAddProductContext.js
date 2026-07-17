/**
 * src/hooks/useAddProductContext.js
 * Context + Provider for sharing useAddProduct() result across shells & sections.
 *
 * Usage:
 *
 * // In wrapper (AddProductMobile / AddProductDesktop):
 *   const logic = useAddProduct({ user });
 *   return (
 *     <AddProductProvider value={logic}>
 *       <MobileShell />
 *     </AddProductProvider>
 *   );
 *
 * // In any child section:
 *   const { form, updateForm, handleSubmit } = useAddProductContext();
 */

import { createContext, useContext } from "react";

/* ═══════════════════════════════════════════════════════════════
   CONTEXT
═══════════════════════════════════════════════════════════════ */
const AddProductContext = createContext(null);

/* ═══════════════════════════════════════════════════════════════
   PROVIDER
═══════════════════════════════════════════════════════════════ */
export function AddProductProvider({ value, children }) {
  return (
    <AddProductContext.Provider value={value}>
      {children}
    </AddProductContext.Provider>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HOOK
═══════════════════════════════════════════════════════════════ */
export function useAddProductContext() {
  const ctx = useContext(AddProductContext);
  if (!ctx) {
    throw new Error(
      "useAddProductContext must be used inside <AddProductProvider>. " +
      "Wrap your shell (MobileShell / DesktopShell) with it."
    );
  }
  return ctx;
}
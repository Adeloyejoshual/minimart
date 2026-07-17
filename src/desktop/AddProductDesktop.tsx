/**
 * src/desktop/AddProductDesktop.tsx
 * Desktop wrapper — hook + provider + shell.
 */

import { useAddProduct }      from "../hooks/useAddProduct.js";
import { AddProductProvider } from "../hooks/useAddProductContext.jsx";
import DesktopShell           from "./DesktopShell";

/* ═══════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════ */
interface User {
  id?         : string | number;
  email?      : string;
  name?       : string;
  store_name? : string;
}

interface Props {
  user?: User;
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function AddProductDesktop({ user }: Props) {
  const logic = useAddProduct({ user });

  return (
    <AddProductProvider value={logic}>
      <DesktopShell />
    </AddProductProvider>
  );
}
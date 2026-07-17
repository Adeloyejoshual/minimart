/**
 * src/pages/AddProductDesktop.jsx
 * Desktop wrapper — connects useAddProduct hook → provider → DesktopShell
 */

import { useAddProduct }        from "../hooks/useAddProduct.js";
import { AddProductProvider }   from "../hooks/useAddProductContext.jsx";
import DesktopShell             from "../product/DesktopShell.jsx";

export default function AddProductDesktop({ user }) {
  const logic = useAddProduct({ user });

  return (
    <AddProductProvider value={logic}>
      <DesktopShell />
    </AddProductProvider>
  );
}
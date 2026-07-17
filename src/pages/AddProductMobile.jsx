/**
 * src/pages/AddProductMobile.jsx
 * Mobile wrapper — connects useAddProduct hook → provider → MobileShell
 */

import { useAddProduct }        from "../hooks/useAddProduct.js";
import { AddProductProvider }   from "../hooks/useAddProductContext.js";
import MobileShell              from "../product/MobileShell.jsx";

export default function AddProductMobile({ user }) {
  const logic = useAddProduct({ user });

  return (
    <AddProductProvider value={logic}>
      <MobileShell />
    </AddProductProvider>
  );
}
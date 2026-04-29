// src/pages/product/context/ProductContext.jsx
import { createContext, useContext } from "react";

export const ProductContext = createContext({
  form: {},
  updateForm: () => {},
  updateAttribute: () => {},
  updateContact: () => {},
  updateDelivery: () => {},
  updateDeliveryDuration: () => {},
  toggleFeature: () => {},
  selectedPlan: null,
  setSelectedPlan: () => {},
  handleSubmit: () => {},
  clearDraft: () => {},
  loading: false,
  error: "",
  success: "",
});

export function useProductContext() {
  return useContext(ProductContext);
}
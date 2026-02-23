import { useAddProductForm } from "./hooks/useAddProductForm";
import { useProductPublish } from "./hooks/useProductPublish";

import ProductDetailsSection from "./components/AddProduct/ProductDetailsSection";
import PricingSection from "./components/AddProduct/PricingSection";
import MediaSection from "./components/AddProduct/MediaSection";
import DeliverySection from "./components/AddProduct/DeliverySection";
import AdditionalOptionsSection from "./components/AddProduct/AdditionalOptionsSection";
import PreviewModal from "./components/AddProduct/PreviewModal";
import PaymentModal from "./components/AddProduct/PaymentModal";
import SelectorModal from "./components/AddProduct/SelectorModal";

export default function AddMarketplaceProduct() {
  const formLogic = useAddProductForm();
  const publishLogic = useProductPublish(formLogic);

  return (
    <>
      <form onSubmit={formLogic.handleSubmit}>
        <ProductDetailsSection {...formLogic} />
        <PricingSection {...formLogic} />
        <MediaSection {...formLogic} />
        <DeliverySection {...formLogic} />
        <AdditionalOptionsSection {...formLogic} />

        <button type="submit">Preview & Publish</button>
      </form>

      <SelectorModal {...formLogic} />
      <PreviewModal {...publishLogic} />
      <PaymentModal {...publishLogic} />
    </>
  );
}
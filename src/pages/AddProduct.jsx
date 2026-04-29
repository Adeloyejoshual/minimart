// src/pages/AddProduct.jsx
import AddProductHeader from "../components/AddProductHeader.jsx";
import {
  BasicInfoSection,
  ProductDetailsSection,
  ContactSection,
  LocationDeliverySection,
  ImagesSection,
  PromotionSection,
} from "../products/components/AddProductSections.jsx";
import { useAddProductLogic } from "../products/hooks/useAddProductLogic.js";

export default function AddProduct() {
  const {
    form,
    images,
    state,
    city,
    selectedPlan,
    loading,
    error,
    success,
    updateForm,
    updateAttribute,
    updateContact,
    updateDelivery,
    updateDeliveryDuration,
    toggleFeature,
    handleImages,
    removeImage,
    setSelectedPlan,
    handleSubmit,
    clearDraft,
  } = useAddProductLogic();

  return (
    <div className="add-product-container">
      <AddProductHeader
        title="Add Product"
        onClearDraft={clearDraft}
      />

      <section className="section form-card">
        <h3 className="section-title">Basic Information</h3>
        <BasicInfoSection
          form={form}
          updateForm={updateForm}
        />
      </section>

      <section className="section form-card">
        <h3 className="section-title">Product Details</h3>
        <ProductDetailsSection
          form={form}
          updateAttribute={updateAttribute}
          selectedCategory={selectedCategory}
          options={options}
          fields={fields}
          modelOptions={modelOptions}
          toggleFeature={toggleFeature}
        />
      </section>

      <section className="section form-card">
        <h3 className="section-title">Contact Information</h3>
        <ContactSection
          form={form}
          updateContact={updateContact}
        />
      </section>

      <section className="section form-card">
        <h3 className="section-title">Location & Delivery</h3>
        <LocationDeliverySection
          state={state}
          city={city}
          setState={setState}
          setCity={setCity}
          form={form}
          updateDelivery={updateDelivery}
          updateDeliveryDuration={updateDeliveryDuration}
        />
      </section>

      <section className="section form-card">
        <h3 className="section-title">Product Images</h3>
        <ImagesSection
          images={images}
          handleImages={handleImages}
          removeImage={removeImage}
        />
      </section>

      <section className="section form-card">
        <h3 className="section-title">Promotion Plan</h3>
        <PromotionSection
          selectedPlan={selectedPlan}
          setSelectedPlan={setSelectedPlan}
        />
      </section>

      <div className="button-section section form-card">
        <button
          className="primary-btn"
          type="button"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Processing..." : "🚀 Create Product"}
        </button>

        {paymentData && (
          <button
            className="secondary-btn"
            type="button"
            onClick={() => window.open(paymentData.authUrl, "_blank")}
          >
            💳 Pay Now
          </button>
        )}
      </div>

      {error && <div className="form-error">⚠️ {error}</div>}
      {success && <div className="form-success">✅ {success}</div>}
    </div>
  );
}
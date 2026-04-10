console.log("🧩 AddProduct is rendering");

return (
  <div className="add-product-container">
    <AddProductHeader title="Add Product" onClearDraft={clearDraft} />
    {/* ... rest of the form ... */}
  </div>
);
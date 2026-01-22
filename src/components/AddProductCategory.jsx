import categories from "../config/categories";

export default function AddProductCategory({
  form,
  handleCategoryChange,
  openSubCategorySelector,
}) {
  return (
    <>
      {/* Category */}
      <div className="field">
        <label>Category</label>
        <div className="category-scroll">
          {categories.map(cat => (
            <div
              key={cat.name}
              className={`category-item ${
                form.mainCategory === cat.name ? "active" : ""
              }`}
              onClick={() => handleCategoryChange(cat.name)}
            >
              <span className="category-icon">{cat.icon}</span>
              <span className="category-name">{cat.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Subcategory */}
      {form.mainCategory && (
        <div className="field">
          <label>Subcategory</label>
          <div
            className="option-item clickable"
            onClick={openSubCategorySelector}
          >
            {form.subCategory || "Select Subcategory"}
          </div>
        </div>
      )}
    </>
  );
}
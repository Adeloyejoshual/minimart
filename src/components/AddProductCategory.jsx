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
            <button
              key={cat.name}
              type="button"
              className={`category-item ${
                form.mainCategory === cat.name ? "active" : ""
              }`}
              onClick={() => handleCategoryChange(cat.name)}
            >
              <span className="category-icon">{cat.icon || "📦"}</span>
              <span className="category-name">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Subcategory */}
      {form.mainCategory && (
        <div className="field">
          <label>Subcategory</label>
          <button
            type="button"
            className="option-item clickable"
            onClick={openSubCategorySelector}
          >
            {form.subCategory || "Select Subcategory"}
          </button>
        </div>
      )}
    </>
  );
}
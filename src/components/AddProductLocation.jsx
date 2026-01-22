export default function AddProductLocation({
  form,
  openStateSelector,
  openCitySelector,
}) {
  return (
    <>
      {/* State */}
      <div className="field">
        <label>State</label>
        <button
          type="button"
          className="option-item clickable"
          onClick={openStateSelector}
        >
          {form.state || "Select State"}
        </button>
      </div>

      {/* City / LGA */}
      {form.state && (
        <div className="field">
          <label>City / LGA</label>
          <button
            type="button"
            className="option-item clickable"
            onClick={openCitySelector}
          >
            {form.city || "Select City / LGA"}
          </button>
        </div>
      )}
    </>
  );
}
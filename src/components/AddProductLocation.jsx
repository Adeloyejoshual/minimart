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
        <div
          className="option-item clickable"
          onClick={openStateSelector}
        >
          {form.state || "Select State"}
        </div>
      </div>

      {/* City / LGA */}
      {form.state && (
        <div className="field">
          <label>City / LGA</label>
          <div
            className="option-item clickable"
            onClick={openCitySelector}
          >
            {form.city || "Select City / LGA"}
          </div>
        </div>
      )}
    </>
  );
}
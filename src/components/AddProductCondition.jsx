import conditionConfig from "../config/conditions";

export default function AddProductCondition({
  form,
  openConditionSelector,
  openUsedDetailSelector,
}) {
  const categoryConditions = conditionConfig[form.mainCategory]?.main || [];
  const showCondition = categoryConditions.length > 0;
  const showUsedDetail = ["Used", "Refurbished"].includes(form.condition);

  if (!showCondition) return null;

  return (
    <>
      {/* Condition */}
      <div className="field">
        <label>Condition</label>
        <button
          type="button"
          className="option-item clickable"
          onClick={openConditionSelector}
        >
          {form.condition || "Select Condition"}
        </button>
      </div>

      {/* Used Detail */}
      {showUsedDetail && (
        <div className="field">
          <label>Used Detail</label>
          <button
            type="button"
            className="option-item clickable"
            onClick={openUsedDetailSelector}
          >
            {form.usedDetail || "Select Used Detail"}
          </button>
        </div>
      )}
    </>
  );
}
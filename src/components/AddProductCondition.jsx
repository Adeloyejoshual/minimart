import conditionConfig from "../config/conditions";

export default function AddProductCondition({
  form,
  openConditionSelector,
  openUsedDetailSelector,
}) {
  const showCondition =
    form.model && conditionConfig[form.mainCategory]?.main;

  const showUsedDetail =
    form.condition === "Used" || form.condition === "Refurbished";

  if (!showCondition) return null;

  return (
    <>
      {/* Condition */}
      <div className="field">
        <label>Condition</label>
        <div
          className="option-item clickable"
          onClick={openConditionSelector}
        >
          {form.condition || "Select Condition"}
        </div>
      </div>

      {/* Used Detail */}
      {showUsedDetail && (
        <div className="field">
          <label>Used Detail</label>
          <div
            className="option-item clickable"
            onClick={openUsedDetailSelector}
          >
            {form.usedDetail || "Select Used Detail"}
          </div>
        </div>
      )}
    </>
  );
}
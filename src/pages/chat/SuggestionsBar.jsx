import React, { useCallback } from "react";
import { Icon } from "./icons";

function SuggestionsBar({ suggestions, onSelect, onDismiss }) {
  if (!suggestions?.length) return null;
  return (
    <div className="suggestions-wrap">
      <div className="suggestions-row">
        {suggestions.map((s, i) => (
          <SuggestionChip key={i} text={s} onSelect={onSelect}/>
        ))}
      </div>
      <button className="suggestions-dismiss" onClick={onDismiss} title="Dismiss">
        {Icon.close}
      </button>
    </div>
  );
}

/* Memoized individual chip so only new ones rerender */
const SuggestionChip = React.memo(function SuggestionChip({ text, onSelect }) {
  const handleClick = useCallback(() => onSelect(text), [text, onSelect]);
  return (
    <button className="suggestion-chip" onClick={handleClick}>
      {text}
    </button>
  );
});

export default React.memo(SuggestionsBar);
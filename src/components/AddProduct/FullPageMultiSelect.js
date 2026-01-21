// src/components/AddProduct/FullPageMultiSelect.js
import { useState } from "react";

export default function FullPageMultiSelect({ title, options, valueKey, setSelectionStep, backStep, update, scrollPos }) {
  const [search, setSearch] = useState("");
  const filtered = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  const toggleOption = (opt) => {
    if (update[valueKey]?.includes(opt)) {
      update(valueKey, update[valueKey].filter(f => f !== opt));
    } else {
      update(valueKey, [...(update[valueKey] || []), opt]);
    }
  };

  const handleDone = () => {
    setSelectionStep(null);
    window.scrollTo(0, scrollPos.current);
  };

  return (
    <div className="fullpage-list">
      {backStep && (
        <div className="options-back" onClick={() => setSelectionStep(backStep)}>← Back</div>
      )}
      <h3>{title}</h3>
      <input
        type="text"
        placeholder="Search..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="fullpage-search"
      />
      <div className="options-scroll">
        {filtered.map(opt => (
          <div
            key={opt}
            className={`option-item ${update[valueKey]?.includes(opt) ? "active" : ""}`}
            onClick={() => toggleOption(opt)}
          >
            {opt} {update[valueKey]?.includes(opt) && "✓"}
          </div>
        ))}
      </div>
      <button className="btn" onClick={handleDone}>Done</button>
    </div>
  );
}
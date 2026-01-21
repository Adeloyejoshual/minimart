// src/components/AddProduct/FullPageList.js
import { useState } from "react";

export default function FullPageList({ title, options, valueKey, setSelectionStep, backStep, update, scrollPos }) {
  const [search, setSearch] = useState("");
  const [customValue, setCustomValue] = useState("");

  const filtered = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  const handleCustomSubmit = () => {
    if (customValue.trim() !== "") {
      update(valueKey, customValue.trim());
      setCustomValue("");
      setSelectionStep(null);
      window.scrollTo(0, scrollPos.current);
    }
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
            className={`option-item ${opt === update[valueKey] ? "active" : ""}`}
            onClick={() => {
              update(valueKey, opt);
              setSelectionStep(null);
              window.scrollTo(0, scrollPos.current);
            }}
          >
            {opt}
          </div>
        ))}

        {/* Custom input */}
        <div className="option-item custom-input">
          <input
            type="text"
            placeholder={`Enter ${valueKey}...`}
            value={customValue}
            onChange={e => setCustomValue(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCustomSubmit()}
          />
        </div>
      </div>
    </div>
  );
}
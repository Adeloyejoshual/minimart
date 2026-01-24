import { useState } from "react";

export default function SingleSelectList({ title, options, valueKey, form, updateForm, setSelectionStep, scrollPos }) {
  const [search, setSearch] = useState("");
  const [customValue, setCustomValue] = useState("");

  const filtered = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  const handleSelect = val => {
    updateForm(valueKey, val);
    setSelectionStep(null);
    // Scroll back to previous position
    window.scrollTo(0, scrollPos.current || 0);
  };

  const handleCustomSubmit = () => {
    if (customValue.trim()) {
      handleSelect(customValue.trim());
      setCustomValue("");
    }
  };

  return (
    <div className="fullpage-list">
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
            className={`option-item ${form[valueKey] === opt ? "active" : ""}`}
            onClick={() => handleSelect(opt)}
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
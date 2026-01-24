import { useState } from "react";

export default function MultiSelectList({ title, options, valueKey, form, updateForm, setSelectionStep, scrollPos }) {
  const [search, setSearch] = useState("");

  const filtered = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  const toggleOption = opt => {
    const current = form[valueKey] || [];
    if (current.includes(opt)) {
      updateForm(valueKey, current.filter(item => item !== opt));
    } else {
      updateForm(valueKey, [...current, opt]);
    }
  };

  const handleDone = () => {
    setSelectionStep(null);
    window.scrollTo(0, scrollPos.current || 0);
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
            className={`option-item ${form[valueKey]?.includes(opt) ? "active" : ""}`}
            onClick={() => toggleOption(opt)}
          >
            {opt} {form[valueKey]?.includes(opt) && "✓"}
          </div>
        ))}
      </div>
      <button className="btn" onClick={handleDone}>Done</button>
    </div>
  );
}
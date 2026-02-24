// 🔥 SetSelectionModal COMPONENT (INLINE - NO SEPARATE FILE)
function SetSelectionModal({ 
  isOpen, 
  title, 
  options = [], 
  value = "", 
  searchTerm, 
  onSearch, 
  onSelect, 
  onClose 
}) {
  const [localSearch, setLocalSearch] = useState(searchTerm || "");
  
  if (!isOpen) return null;

  const filteredOptions = options.filter(option =>
    !localSearch || option.toLowerCase().includes(localSearch.toLowerCase())
  );

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.7)", zIndex: 10000,
      display: "flex", justifyContent: "center", alignItems: "center"
    }}>
      <div style={{
        background: "white", width: "95%", maxWidth: "500px", maxHeight: "80vh",
        borderRadius: "12px", overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{
          padding: "20px", borderBottom: "1px solid #eee",
          display: "flex", justifyContent: "space-between"
        }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{
            border: "none", background: "none", fontSize: "24px", cursor: "pointer"
          }}>×</button>
        </div>

        {/* Search */}
        <div style={{ padding: "16px" }}>
          <input
            value={localSearch}
            onChange={(e) => {
              setLocalSearch(e.target.value);
              onSearch?.(e.target.value);
            }}
            placeholder={`Search ${title.toLowerCase()}...`}
            style={{
              width: "100%", padding: "12px", border: "1px solid #ddd",
              borderRadius: "8px", fontSize: "16px"
            }}
          />
        </div>

        {/* Options */}
        <div style={{ maxHeight: "400px", overflow: "auto", padding: "0 16px 20px" }}>
          {filteredOptions.map((option, i) => (
            <div
              key={i}
              onClick={() => onSelect(option)}
              style={{
                padding: "16px", marginBottom: "8px",
                background: option === value ? "#007BFF" : "#f8f9fa",
                color: option === value ? "white" : "#333",
                borderRadius: "8px", cursor: "pointer",
                border: option === value ? "none" : "1px solid #eee"
              }}
            >
              {option}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
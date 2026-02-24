// src/components/AddProduct/SetSelectionModal.jsx
// v32 DEBUG VERSION - Guaranteed to show

import { FaTimes } from "react-icons/fa";

export default function SetSelectionModal({ 
  isOpen, 
  title = "Select", 
  options = [], 
  value = "", 
  onSelect, 
  onClose 
}) {
  if (!isOpen) return null;

  console.log("🚀 MODAL RENDERED:", { title, options, value });

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.8)", zIndex: 9999,
      display: "flex", justifyContent: "center", alignItems: "center",
      padding: "20px"
    }}>
      <div style={{
        background: "white", width: "90%", maxWidth: "500px", maxHeight: "80vh",
        borderRadius: "12px", padding: "0"
      }}>
        {/* Header */}
        <div style={{
          padding: "20px", borderBottom: "1px solid #eee",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <h3 style={{ margin: 0, fontSize: "18px" }}>{title}</h3>
          <button onClick={onClose} style={{
            border: "none", background: "none", fontSize: "20px", cursor: "pointer"
          }}>
            <FaTimes />
          </button>
        </div>

        {/* Options */}
        <div style={{ maxHeight: "400px", overflow: "auto", padding: "20px" }}>
          {options.length === 0 ? (
            <div style={{ textAlign: "center", color: "#666", padding: "40px" }}>
              No options available
            </div>
          ) : (
            options.map((option, i) => (
              <div key={i} onClick={() => onSelect(option)}
                style={{
                  padding: "15px", marginBottom: "8px",
                  background: option === value ? "#007BFF" : "#f8f9fa",
                  color: option === value ? "white" : "#333",
                  borderRadius: "8px", cursor: "pointer",
                  border: option === value ? "none" : "1px solid #eee"
                }}
              >
                {option}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
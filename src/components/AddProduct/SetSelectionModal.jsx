// src/components/AddProduct/SetSelectionModal.jsx
// v32 ENTERPRISE - Searchable Selection Modal for Marketplace

import { useState, useEffect, useCallback, useRef } from "react";
import { FaSearch, FaTimes, FaCheck } from "react-icons/fa";

const STYLES = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10000,
    padding: "20px"
  },
  content: {
    background: "white",
    width: "95%",
    maxWidth: "500px",
    maxHeight: "85vh",
    borderRadius: "16px",
    boxShadow: "0 25px 50px rgba(0, 0, 0, 0.25)",
    overflow: "hidden"
  },
  header: {
    padding: "24px 24px 16px",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    margin: 0,
    fontSize: "20px",
    fontWeight: "600",
    color: "#111827"
  },
  closeBtn: {
    width: "36px",
    height: "36px",
    border: "none",
    background: "#f3f4f6",
    borderRadius: "50%",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#6b7280",
    fontSize: "16px",
    transition: "all 0.2s"
  },
  searchContainer: {
    padding: "0 24px 16px",
    position: "relative"
  },
  searchInput: {
    width: "100%",
    padding: "12px 16px 12px 44px",
    border: "2px solid #e5e7eb",
    borderRadius: "12px",
    fontSize: "16px",
    background: "white"
  },
  searchInputFocus: {
    borderColor: "#3b82f6",
    boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)"
  },
  searchIcon: {
    position: "absolute",
    left: "40px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#9ca3af",
    fontSize: "16px"
  },
  list: {
    maxHeight: "400px",
    overflowY: "auto",
    padding: "0 24px 24px"
  },
  option: {
    padding: "16px 12px",
    cursor: "pointer",
    borderRadius: "10px",
    marginBottom: "8px",
    display: "flex",
    alignItems: "center",
    fontSize: "16px",
    background: "white",
    transition: "all 0.2s"
  },
  optionHover: {
    background: "#f8fafc",
    transform: "translateX(4px)"
  },
  optionSelected: {
    background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    color: "white",
    fontWeight: "500"
  },
  optionCheck: {
    width: "24px",
    height: "24px",
    borderRadius: "6px",
    marginRight: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px"
  },
  noResults: {
    padding: "40px 24px",
    textAlign: "center",
    color: "#6b7280",
    fontSize: "16px"
  },
  clearSearchBtn: {
    position: "absolute",
    right: "40px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#9ca3af",
    fontSize: "14px"
  }
};

export default function SetSelectionModal({
  isOpen,
  title,
  options = [],
  value = "",
  searchTerm,
  onSearch,
  onSelect,
  onClose,
  searchPlaceholder = "Search..."
}) {
  const [localSearch, setLocalSearch] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const containerRef = useRef(null);

  // Sync with parent search
  useEffect(() => {
    setLocalSearch(searchTerm || "");
  }, [searchTerm]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [isOpen, onClose]);

  // Filter options
  const filteredOptions = options.filter(option =>
    !localSearch.trim() || 
    option.toLowerCase().includes(localSearch.toLowerCase())
  );

  const handleSearch = (e) => {
    const term = e.target.value;
    setLocalSearch(term);
    onSearch?.(term);
  };

  const handleSelectOption = (option) => {
    onSelect(option);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHoveredIndex(prev => 
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHoveredIndex(prev => 
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === "Enter" && hoveredIndex >= 0) {
      e.preventDefault();
      handleSelectOption(filteredOptions[hoveredIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={STYLES.overlay}>
      <div ref={containerRef} style={STYLES.content}>
        {/* Header */}
        <div style={STYLES.header}>
          <h3 style={STYLES.title}>{title}</h3>
          <button 
            onClick={onClose}
            style={STYLES.closeBtn}
          >
            <FaTimes />
          </button>
        </div>

        {/* Search */}
        <div style={STYLES.searchContainer}>
          <FaSearch style={STYLES.searchIcon} />
          <input
            type="text"
            value={localSearch}
            onChange={handleSearch}
            placeholder={searchPlaceholder}
            onKeyDown={handleKeyDown}
            style={{
              ...STYLES.searchInput,
              ...(localSearch && STYLES.searchInputFocus)
            }}
            autoFocus
          />
          {localSearch && (
            <button
              style={STYLES.clearSearchBtn}
              onClick={() => {
                setLocalSearch("");
                onSearch?.("");
              }}
            >
              <FaTimes />
            </button>
          )}
        </div>

        {/* Options */}
        <div style={STYLES.list}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => {
              const isSelected = option === value;
              const isHovered = index === hoveredIndex;
              
              return (
                <div
                  key={option}
                  style={{
                    ...STYLES.option,
                    ...(isSelected && STYLES.optionSelected),
                    ...(isHovered && !isSelected && STYLES.optionHover)
                  }}
                  onClick={() => handleSelectOption(option)}
                  onMouseEnter={() => setHoveredIndex(index)}
                >
                  <div style={STYLES.optionCheck}>
                    {isSelected && <FaCheck />}
                  </div>
                  {option}
                </div>
              );
            })
          ) : (
            <div style={STYLES.noResults}>
              {localSearch ? "No results found" : `No ${title.toLowerCase()} available`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
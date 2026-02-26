// src/components/CustomDropdown.jsx - ✅ FIXED STRING SUPPORT
import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import './CustomDropdown.css';

const CustomDropdown = forwardRef(({ 
  options = [], 
  value, 
  onChange, 
  placeholder, 
  className = '', 
  required = false,
  disabled = false 
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  useImperativeHandle(ref, () => ({
    value: value,
    focus: () => dropdownRef.current?.focus(),
    blur: () => dropdownRef.current?.blur()
  }));

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ✅ FIXED: Safe string/object filtering
  const filteredOptions = options.filter(option => {
    const label = option.label !== undefined ? option.label : option;
    return label.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // ✅ FIXED: Safe selected option lookup
  const selectedOption = options.find(opt => {
    const optValue = opt.value !== undefined ? opt.value : opt;
    return optValue === value;
  });

  const handleSelect = (option) => {
    const optionValue = option.value !== undefined ? option.value : option;
    if (onChange) onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHoveredIndex(prev => 
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHoveredIndex(prev => 
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    }
  };

  return (
    <div className={`custom-dropdown ${className} ${disabled ? 'disabled' : ''}`} ref={dropdownRef}>
      <div 
        className={`dropdown-trigger ${isOpen ? 'open' : ''} ${required ? 'required' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="combobox"
        aria-expanded={isOpen}
      >
        <span className="selected-value">
          {selectedOption ? (
            selectedOption.label !== undefined ? selectedOption.label : selectedOption
          ) : placeholder || 'Select...'}
        </span>
        <span className={`dropdown-arrow ${isOpen ? 'rotated' : ''}`}>
          ▼
        </span>
      </div>

      {isOpen && (
        <div className="dropdown-menu">
          <div className="dropdown-search">
            <input
              ref={searchRef}
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              autoFocus
            />
          </div>
          
          <div className="dropdown-options" role="listbox">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const optionValue = option.value !== undefined ? option.value : option;
                const optionLabel = option.label !== undefined ? option.label : option;
                const isHovered = hoveredIndex === index;
                const isSelected = optionValue === value;
                
                return (
                  <div
                    key={optionValue || optionLabel}
                    className={`dropdown-option ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setHoveredIndex(index)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span>{optionLabel}</span>
                    {isSelected && <span className="checkmark">✓</span>}
                  </div>
                );
              })
            ) : (
              <div className="no-options">No matching options</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

CustomDropdown.displayName = 'CustomDropdown';
export default CustomDropdown;
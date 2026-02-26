// src/components/CustomDropdown.jsx - ✅ PROFESSIONAL MARKETPLACE DROPDOWN
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

  // ✅ Expose methods for ref
  useImperativeHandle(ref, () => ({
    value: value,
    focus: () => dropdownRef.current?.focus(),
    blur: () => dropdownRef.current?.blur()
  }));

  // ✅ Close dropdown when clicking outside
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

  // ✅ Filter options
  const filteredOptions = options.filter(option => 
    option.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOption = options.find(opt => 
    opt.value === value || opt === value
  );

  const handleSelect = (option) => {
    const optionValue = option.value !== undefined ? option.value : option;
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      setIsOpen(true);
      setTimeout(() => searchRef.current?.focus(), 0);
      return;
    }

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        setIsOpen(!isOpen);
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHoveredIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHoveredIndex(prev => 
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      default:
        if (e.key.length === 1) {
          setSearchTerm(prev => prev + e.key);
        }
        break;
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
        aria-haspopup="listbox"
      >
        <span className="selected-value">
          {selectedOption ? (
            typeof selectedOption === 'object' ? selectedOption.label : selectedOption
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
                    key={optionValue}
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
              <div className="no-options">No options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

CustomDropdown.displayName = 'CustomDropdown';

export default CustomDropdown;
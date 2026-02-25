// src/components/CustomDropdownFullPage.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import './AddProduct.css';

export default function CustomDropdownFullPage({ 
  fieldId,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  searchPlaceholder = 'Search...'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const overlayRef = useRef(null);

  // Filtered options based on search
  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  // Close on outside click or ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') setIsOpen(false);
      if (e.key === 'ArrowDown') setHoveredIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
      if (e.key === 'ArrowUp') setHoveredIndex(prev => Math.max(prev - 1, 0));
      if (e.key === 'Enter' && hoveredIndex >= 0) selectOption(filteredOptions[hoveredIndex]);
    };

    const handleClickOutside = (e) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target)) setIsOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, hoveredIndex, filteredOptions]);

  const toggleDropdown = () => setIsOpen(prev => !prev);

  const selectOption = (option) => {
    onChange(fieldId, option);
    setIsOpen(false);
    setSearch('');
    setHoveredIndex(-1);
  };

  return (
    <div className="custom-dropdown-fullpage">
      <div 
        className="dropdown-display"
        role="button"
        tabIndex={0}
        onClick={toggleDropdown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{value || placeholder}</span>
        <svg className={`dropdown-arrow ${isOpen ? 'rotated' : ''}`} viewBox="0 0 24 24">
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </div>

      {isOpen && (
        <div className="dropdown-overlay" ref={overlayRef}>
          <div className="dropdown-panel">
            <input
              type="text"
              className="dropdown-search"
              placeholder={searchPlaceholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            <div className="dropdown-options">
              {filteredOptions.length === 0 ? (
                <div className="no-options">No matches</div>
              ) : (
                filteredOptions.map((option, index) => (
                  <div
                    key={option}
                    role="option"
                    aria-selected={value === option}
                    className={`dropdown-option ${value === option ? 'selected' : ''} ${hoveredIndex === index ? 'hovered' : ''}`}
                    onClick={() => selectOption(option)}
                    onMouseEnter={() => setHoveredIndex(index)}
                  >
                    {option}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
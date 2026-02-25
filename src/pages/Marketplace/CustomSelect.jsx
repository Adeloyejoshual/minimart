// CustomSelect.jsx - Professional 📷 Dropdown
// Mobile-friendly, accessible, production-ready

import React, { useState, useRef, useEffect } from 'react';

export default function CustomSelect({ 
  value, 
  onChange, 
  options = [], 
  placeholder = "Select", 
  error 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  return (
    <div className={`custom-select ${error ? 'error' : ''}`} ref={ref}>
      <div 
        className="select-trigger"
        onClick={() => setIsOpen(prev => !prev)}
        role="combobox"
        aria-expanded={isOpen}
        tabIndex={0}
      >
        <span className="select-icon">📷</span>
        <span className="select-value">{value || placeholder}</span>
        <span className={`select-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </div>

      {isOpen && (
        <div className="select-options" role="listbox">
          {options.map(option => (
            <div
              key={option.value}
              className="select-option"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              role="option"
            >
              {option.label}
            </div>
          ))}
        </div>
      )}

      {error && <span className="error-text">{error}</span>}
    </div>
  );
}
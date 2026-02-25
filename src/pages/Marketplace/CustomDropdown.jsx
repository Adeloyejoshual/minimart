// src/components/CustomDropdown.jsx
import React, { useState, useRef, useEffect } from 'react';
import './AddProduct.css';

const CustomDropdown = ({ 
  fieldId, 
  options, 
  value, 
  onChange, 
  placeholder 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = () => setIsOpen(!isOpen);

  const selectOption = (option) => {
    onChange(fieldId, option);
    setIsOpen(false);
    setHoveredIndex(-1);
  };

  return (
    <div className="custom-dropdown" ref={dropdownRef}>
      <div 
        className="dropdown-display" 
        tabIndex="0"
        onClick={toggleDropdown}
        onKeyDown={(e) => {
          if (e.key === 'Enter') toggleDropdown();
          if (e.key === 'Escape') setIsOpen(false);
        }}
      >
        <span>{value || placeholder}</span>
        <svg className={`dropdown-arrow ${isOpen ? 'rotated' : ''}`} viewBox="0 0 24 24">
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </div>
      
      {isOpen && (
        <div className="dropdown-options">
          {options.map((option, index) => (
            <div
              key={option}
              className={`dropdown-option ${value === option ? 'selected' : ''} ${hoveredIndex === index ? 'hovered' : ''}`}
              onClick={() => selectOption(option)}
              onMouseEnter={() => setHoveredIndex(index)}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomDropdown;
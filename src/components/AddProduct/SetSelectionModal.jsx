// src/components/AddProduct/SetSelectionModal.jsx
// v24 ✅ FIXED - Perfect parent sync
import { useEffect, useRef, useState, useCallback } from 'react';

export default function SetSelectionModal({ 
  isOpen, 
  onClose, 
  title, 
  options, 
  value, 
  searchTerm,        // 🔥 ADDED
  onSearch,          // 🔥 ADDED  
  onSelect
}) {
  const modalRef = useRef(null);
  const [localSearch, setLocalSearch] = useState('');

  // 🔥 FIXED: Sync search with parent
  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  const handleSearch = useCallback((e) => {
    const term = e.target.value;
    setLocalSearch(term);
    onSearch?.(term);  // 🔥 Sync with parent
  }, [onSearch]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // 🔥 FIXED: Safe key + handle string options
  const safeOptions = options.map(opt => 
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden animate-in slide-in-from-top-4 duration-300"
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-xl transition-all"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-4 max-h-96 overflow-auto">
          <input
            type="text"
            value={localSearch}
            onChange={handleSearch}
            placeholder="Search options..."
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          
          <div className="mt-4 space-y-2">
            {safeOptions.map((option) => (
              <button
                key={option.value || option}  // 🔥 FIXED: Safe key
                onClick={() => {
                  onSelect(option.value || option);  // 🔥 FIXED: Handle strings
                  onClose();
                }}
                className={`w-full p-3 text-left rounded-xl transition-all flex items-center gap-3 ${
                  value === (option.value || option)
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'hover:bg-gray-50 text-gray-900'
                }`}
              >
                {option.icon && <span>{option.icon}</span>}
                <span>{option.label || option}</span>
                {value === (option.value || option) && <span className="ml-auto">✓</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
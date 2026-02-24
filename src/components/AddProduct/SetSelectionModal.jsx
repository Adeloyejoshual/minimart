// src/components/AddProduct/SetSelectionModal.jsx
import { useEffect, useRef } from 'react';

export default function SetSelectionModal({ 
  isOpen, 
  onClose, 
  title, 
  options, 
  value, 
  onSelect,
  searchPlaceholder = "Search brands..."
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden animate-in slide-in-from-top-4 duration-300"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-xl transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Search + List */}
        <div className="p-4 max-h-96 overflow-auto">
          {/* Quick search */}
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            // Add search logic here
          />
          
          <div className="mt-4 space-y-2">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onSelect(option.value);
                  onClose();
                }}
                className={`w-full p-3 text-left rounded-xl transition-all flex items-center gap-3 ${
                  value === option.value
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'hover:bg-gray-50 text-gray-900'
                }`}
              >
                {option.icon && <span>{option.icon}</span>}
                <span>{option.label}</span>
                {value === option.value && <span className="ml-auto">✓</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
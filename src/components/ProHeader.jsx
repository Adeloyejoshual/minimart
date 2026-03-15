// src/components/ProHeader.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSettings, FiArrowLeft, FiHome } from 'react-icons/fi';
import BottomNav from './BottomNav';

const ProHeader = ({ title = "Settings", showBack = true, onBack = null }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (showBack) {
      navigate('/');
    }
  };

  return (
    <>
      {/* Professional Header */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 shadow-2xl border-b-4 border-indigo-500/50 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Left: Back Arrow + Logo */}
            <div className="flex items-center space-x-3">
              {showBack && (
                <button
                  onClick={handleBack}
                  className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl hover:bg-white/20 transition-all duration-200 hover:scale-110 shadow-lg flex items-center justify-center w-12 h-12"
                  aria-label="Go back home"
                >
                  <FiArrowLeft className="w-6 h-6 text-white" />
                </button>
              )}
              
              {/* Settings Logo */}
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-xl">
                  <FiSettings className="w-5 h-5 text-gray-900" />
                </div>
                <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent drop-shadow-lg">
                  {title}
                </h1>
              </div>
            </div>

            {/* Right: Home Button */}
            <button
              onClick={() => navigate('/')}
              className="p-3 bg-emerald-500/20 backdrop-blur-sm rounded-2xl hover:bg-emerald-500/40 transition-all duration-200 hover:scale-110 shadow-lg flex items-center justify-center w-12 h-12 group"
              aria-label="Go to home"
            >
              <FiHome className="w-6 h-6 text-emerald-300 group-hover:text-emerald-100 transition-colors" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </>
  );
};

export default ProHeader;
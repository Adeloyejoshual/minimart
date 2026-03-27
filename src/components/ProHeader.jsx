import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSettings, FiArrowLeft, FiHome } from 'react-icons/fi';

const ProHeader = ({
  title = "Settings",
  showBack = true,
  onBack,
  showHome = true,
  showSettingsIcon = false,
  onSettingsClick
}) => {
  const navigate = useNavigate();

  /* ---------------- HANDLERS ---------------- */
  const handleBack = useCallback(() => {
    if (onBack) return onBack();
    if (showBack) navigate(-1);
  }, [onBack, showBack, navigate]);

  const handleSettings = useCallback(() => {
    if (onSettingsClick) return onSettingsClick();
    navigate('/settings');
  }, [onSettingsClick, navigate]);

  const goHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  return (
    <header className="bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 shadow-2xl border-b-4 border-indigo-500/50 sticky top-0 z-50">

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">

          {/* LEFT SECTION */}
          <div className="flex items-center gap-3">

            {/* BACK BUTTON */}
            {showBack && (
              <button
                onClick={handleBack}
                aria-label="Go back"
                className="p-3 w-12 h-12 flex items-center justify-center bg-white/10 backdrop-blur-sm rounded-2xl hover:bg-white/20 transition-all duration-200 hover:scale-110 shadow-lg"
              >
                <FiArrowLeft className="w-6 h-6 text-white" />
              </button>
            )}

            {/* TITLE + SETTINGS */}
            <div className="flex items-center gap-2">
              {showSettingsIcon && (
                <button
                  onClick={handleSettings}
                  aria-label="Settings"
                  className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl shadow-xl hover:scale-105 transition-transform"
                >
                  <FiSettings className="w-5 h-5 text-gray-900" />
                </button>
              )}

              <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
                {title}
              </h1>
            </div>

          </div>

          {/* RIGHT SECTION */}
          {showHome && (
            <button
              onClick={goHome}
              aria-label="Go home"
              className="p-3 w-12 h-12 flex items-center justify-center bg-emerald-500/20 backdrop-blur-sm rounded-2xl hover:bg-emerald-500/40 transition-all duration-200 hover:scale-110 shadow-lg group"
            >
              <FiHome className="w-6 h-6 text-emerald-300 group-hover:text-emerald-100 transition-colors" />
            </button>
          )}

        </div>
      </div>
    </header>
  );
};

export default ProHeader;
import React, { useCallback, useEffect, useState } from 'react';

const CLOSE_DURATION = 210; // ms — just under the blur-out/fade-out animation duration

const ChroniclePanel = ({ title, onClose, children }) => {
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, CLOSE_DURATION);
  }, [onClose]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm ${closing ? 'animate-fade-out' : 'animate-fade-in'}`}
      onClick={handleClose}
    >
      <div
        className={`relative w-full max-w-md mx-4 max-h-[78vh] flex flex-col rounded-[24px] border border-white/10 bg-[#07070e]/97 shadow-[0_24px_80px_rgba(0,0,0,0.65)] ${closing ? 'animate-blur-out' : 'animate-blur-in'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-7 pt-6 pb-5 border-b border-white/8">
          <div>
            <p className="font-cardo text-[10px] uppercase tracking-[0.38em] text-white/30 mb-0.5">
              Chronicle
            </p>
            <h2 className="font-berkshire text-2xl text-white/90">{title}</h2>
          </div>
          <button
            onClick={handleClose}
            className="mt-1 font-cardo text-xs text-white/30 hover:text-white/70 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-7 py-5">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ChroniclePanel;

import { useState, useEffect, useRef } from 'react';

// phase: 'idle' → 'chosen' (selected glows, others fade) → 'loading' (magical text) → 'idle'
const ChoiceGrid = ({ choices, onChoice, disabled = false }) => {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [phase, setPhase] = useState('idle');
  const timerRef = useRef(null);

  const handleClick = (choice, index) => {
    if (disabled || phase !== 'idle') return;
    setSelectedIndex(index);
    setPhase('chosen');
    timerRef.current = setTimeout(() => setPhase('loading'), 520);
    onChoice(choice, index);
  };

  // When new choices arrive (scene loaded), reset to idle
  useEffect(() => {
    if (!disabled && choices.length > 0) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setPhase('idle');
      setSelectedIndex(null);
    }
  }, [choices, disabled]);

  // No choices yet (initial generation)
  if (choices.length === 0) {
    return (
      <div className="font-cardo h-[220px] flex items-center justify-center">
        <p className="text-white/40 mix-blend-difference italic animate-pulse-slow text-sm tracking-wide">
          Preparing your next decisions…
        </p>
      </div>
    );
  }

  // Loading phase — choices dissolved, waiting for next scene
  if (phase === 'loading') {
    return (
      <div className="font-cardo h-[220px] flex flex-col items-center justify-center gap-3">
        <p className="text-amber-100/40 italic tracking-[0.25em] animate-pulse-slow text-sm">
          ✦ &nbsp; The paths align… &nbsp; ✦
        </p>
      </div>
    );
  }

  // Idle or chosen — show buttons
  return (
    <div className="font-cardo grid grid-cols-2 gap-4 h-[220px] animate-blur-in">
      {choices.map((choice, index) => {
        const isSelected = index === selectedIndex;
        const isChosen = phase === 'chosen';

        let stateClasses = '';
        if (isChosen && isSelected) {
          stateClasses = 'border-amber-400 text-amber-200 scale-105 shadow-lg shadow-amber-500/25 opacity-100';
        } else if (isChosen && !isSelected) {
          stateClasses = 'border-gray-700 text-white/0 scale-95 opacity-0';
        } else {
          stateClasses = 'border-gray-300 text-white mix-blend-difference hover:border-amber-200/60 hover:scale-[1.02]';
        }

        return (
          <button
            key={index}
            disabled={disabled}
            onClick={() => handleClick(choice, index)}
            className={`border rounded-lg p-6 flex items-center justify-center text-center h-[100px] transition-all duration-500 cursor-pointer ${stateClasses}`}
          >
            {choice}
          </button>
        );
      })}
    </div>
  );
};

export default ChoiceGrid;

import { useState, useEffect, useRef } from 'react';

function gridClass(count) {
  if (count === 1) return 'grid-cols-1';
  return 'grid-cols-2';
}

// phase: 'idle' → 'chosen' → 'loading' → 'idle'
const ChoiceGrid = ({ choices, onChoice, onContinue, disabled = false, variant = 'default' }) => {
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

  const handleContinue = () => {
    if (disabled) return;
    setPhase('loading');
    onContinue?.();
  };

  useEffect(() => {
    if (!disabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setPhase('idle');
      setSelectedIndex(null);
    }
  }, [choices, disabled]);

  // Loading state
  if (phase === 'loading') {
    return (
      <div className="font-cardo min-h-[80px] flex flex-col items-center justify-center">
        <p className="text-amber-100/40 italic tracking-[0.25em] animate-pulse-slow text-sm">
          ✦ &nbsp; The paths align… &nbsp; ✦
        </p>
      </div>
    );
  }

  // Still generating (initial load, no onContinue means it's waiting for AI)
  if (choices.length === 0 && !onContinue) {
    return (
      <div className="font-cardo min-h-[80px] flex items-center justify-center">
        <p className="text-white/40 italic animate-pulse-slow text-sm tracking-wide">
          Preparing your next decisions…
        </p>
      </div>
    );
  }

  // No choices — Continue button
  if (choices.length === 0) {
    return (
      <div className="font-cardo flex justify-center animate-blur-in">
        <button
          disabled={disabled}
          onClick={handleContinue}
          className="border border-white/20 rounded-lg px-10 py-3 text-sm text-white/60 hover:border-amber-200/40 hover:text-white/80 transition-all duration-300 tracking-widest uppercase disabled:opacity-20"
        >
          Continue
        </button>
      </div>
    );
  }

  // Threshold — two choices stacked vertically with "or" separator
  if (variant === 'threshold' && choices.length === 2) {
    return (
      <div className="font-cardo flex flex-col items-center gap-0 animate-blur-in max-w-xs mx-auto w-full">
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
            <div key={index} className="w-full flex flex-col items-center">
              <button
                disabled={disabled}
                onClick={() => handleClick(choice, index)}
                className={`w-full border rounded-lg p-4 sm:p-5 text-center text-sm transition-all duration-500 cursor-pointer ${stateClasses}`}
              >
                {choice}
              </button>
              {index === 0 && (
                <span className="text-white/20 text-xs tracking-[0.3em] uppercase py-2">or</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Default grid (1–4 choices)
  return (
    <div className={`font-cardo grid ${gridClass(choices.length)} gap-2 sm:gap-4 animate-blur-in`}>
      {choices.map((choice, index) => {
        const isSelected = index === selectedIndex;
        const isChosen = phase === 'chosen';
        const isLastOdd = choices.length === 3 && index === 2;

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
            className={`border rounded-lg p-3 sm:p-5 flex items-center justify-center text-center min-h-[80px] sm:min-h-[100px] text-sm transition-all duration-500 cursor-pointer ${isLastOdd ? 'col-span-2' : ''} ${stateClasses}`}
          >
            {choice}
          </button>
        );
      })}
    </div>
  );
};

export default ChoiceGrid;

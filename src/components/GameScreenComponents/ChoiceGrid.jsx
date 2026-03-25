import { useState, useEffect, useRef } from 'react';

// Determines the grid class based on choice count
function gridClass(count) {
  if (count === 1) return 'grid-cols-1';
  if (count === 3) return 'grid-cols-2';
  return 'grid-cols-2'; // 2 or 4
}

// phase: 'idle' → 'chosen' (selected glows, others fade) → 'loading' → 'idle'
const ChoiceGrid = ({ choices, onChoice, onContinue, disabled = false }) => {
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

  // When new choices arrive (scene loaded), reset to idle
  useEffect(() => {
    if (!disabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setPhase('idle');
      setSelectedIndex(null);
    }
  }, [choices, disabled]);

  // Loading phase — waiting for next scene
  if (phase === 'loading') {
    return (
      <div className="font-cardo min-h-[80px] flex flex-col items-center justify-center gap-3">
        <p className="text-amber-100/40 italic tracking-[0.25em] animate-pulse-slow text-sm">
          ✦ &nbsp; The paths align… &nbsp; ✦
        </p>
      </div>
    );
  }

  // Still generating (initial scene load)
  if (choices.length === 0 && !onContinue) {
    return (
      <div className="font-cardo min-h-[80px] flex items-center justify-center">
        <p className="text-white/40 italic animate-pulse-slow text-sm tracking-wide">
          Preparing your next decisions…
        </p>
      </div>
    );
  }

  // No choices — show a Continue button
  if (choices.length === 0 && onContinue) {
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

  // Idle or chosen — show choice buttons
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

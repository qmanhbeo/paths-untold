import { useState } from 'react';

const NameInputOverlay = ({ onSubmit, promptText }) => {
  const [value, setValue] = useState('');

  const submit = () => {
    const name = value.trim();
    if (name) onSubmit(name);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="font-cardo w-full sm:max-w-sm mx-0 sm:mx-4 px-6 py-8 sm:rounded-lg border-t sm:border border-white/15 bg-black/95 text-white animate-fade-in">
        {promptText && (
          <p className="text-white/70 italic text-sm leading-relaxed mb-6 text-center">
            {promptText}
          </p>
        )}
        <input
          autoFocus
          type="text"
          value={value}
          maxLength={32}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          className="w-full bg-transparent border-b border-white/25 pb-2 text-center text-xl outline-none placeholder-white/20 tracking-wide mb-6 focus:border-amber-300/50 transition-colors"
          placeholder="…"
        />
        <button
          disabled={!value.trim()}
          onClick={submit}
          className="w-full border border-amber-300/40 rounded py-2 text-sm text-white/70 hover:bg-amber-900/30 disabled:opacity-20 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default NameInputOverlay;

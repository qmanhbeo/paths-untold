import { useState } from 'react';

const FreeTextInput = ({ prompt, onSubmit }) => {
  const [value, setValue] = useState('');

  const submit = () => {
    const text = value.trim();
    if (text) onSubmit(text);
  };

  return (
    <div className="font-cardo animate-blur-in">
      {prompt && (
        <p className="text-white/60 italic text-sm leading-relaxed mb-5 text-center">
          {prompt}
        </p>
      )}
      <textarea
        autoFocus
        value={value}
        maxLength={240}
        rows={3}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
        }}
        className="w-full bg-transparent border border-white/15 rounded-lg p-3 text-white/90 text-sm outline-none placeholder-white/20 resize-none focus:border-amber-300/30 transition-colors mb-4"
        placeholder="…"
      />
      <button
        disabled={!value.trim()}
        onClick={submit}
        className="w-full border border-amber-300/40 rounded py-2 text-sm text-white/70 hover:bg-amber-900/30 disabled:opacity-20 transition-colors"
      >
        Say it
      </button>
    </div>
  );
};

export default FreeTextInput;

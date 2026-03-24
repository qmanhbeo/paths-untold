// src/components/GameScreenComponents/HeaderBar.jsx
import React from 'react';

const TensionBar = ({ tension = 3 }) => {
  const color =
    tension <= 3 ? 'bg-emerald-400/75' :
    tension <= 6 ? 'bg-amber-400/75' :
                   'bg-red-400/80';

  return (
    <span className="inline-flex items-center gap-1">
      <span className="opacity-60">Tension</span>
      <span className="inline-flex gap-px ml-1">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={`inline-block w-1.5 h-2.5 rounded-sm transition-colors duration-500 ${
              i < tension ? color : 'bg-white/15'
            }`}
          />
        ))}
      </span>
    </span>
  );
};

const HeaderBar = ({ mem }) => {
  const hasWorld = Boolean(mem?.world && mem?.arc);

  const loc = mem?.world?.location?.name || 'Unknown Place';
  const tags = mem?.world?.location?.tags || [];
  const clock = mem?.world?.clock || { day: 1, time: 'day' };
  const arc = mem?.arc || { chapter: 1, beat: 0, tension: 3 };

  if (!hasWorld) return null;

  return (
    <div className="mb-4 flex flex-col gap-0.5 font-cardo text-white mix-blend-difference">
      <div className="flex items-baseline gap-2">
        <span className="font-berkshire text-xl leading-tight">{loc}</span>
        {tags.length > 0 && (
          <span className="text-xs opacity-45">[{tags.slice(0, 3).join(', ')}]</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs opacity-75">
        <span>Day {clock.day} · {clock.time}</span>
        <span className="opacity-30">|</span>
        <span>Ch {arc.chapter} · Beat {arc.beat}</span>
        <span className="opacity-30">|</span>
        <TensionBar tension={arc.tension} />
      </div>
    </div>
  );
};

export default HeaderBar;

// src/components/GameScreenComponents/HeaderBar.js
import React from 'react';

const HeaderBar = ({ mem, title, onToggleLog, showSidebar }) => {
  const hasWorld = Boolean(mem?.world && mem?.arc);

  const loc = mem?.world?.location?.name || 'Unknown Place';
  const tags = mem?.world?.location?.tags || [];
  const clock = mem?.world?.clock || { day: 1, time: 'day' };
  const arc = mem?.arc || { chapter: 1, beat: 0, tension: 3 };
  const active = (mem?.world?.objectives || []).filter(o => o.status === 'active');
  const firstObj = active[0]?.text;

  return (
    <div className="flex justify-between items-center mb-4">
      {hasWorld ? (
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 text-white mix-blend-difference">
          <div className="font-berkshire text-2xl font-bold">
            {loc}
            <span className="ml-2 text-base font-normal opacity-80">
              • Day {clock.day}, {clock.time}
            </span>
            {tags.length > 0 && (
              <span className="ml-2 text-sm opacity-60">[{tags.slice(0, 3).join(', ')}]</span>
            )}
          </div>
          <div className="sm:ml-4 text-sm opacity-90">
            Ch {arc.chapter} · Beat {arc.beat} · Tension {arc.tension}/10
          </div>
        </div>
      ) : (
        <h1 className="font-berkshire text-3xl font-bold text-white mix-blend-difference">
          {title}
        </h1>
      )}

      <div className="flex items-center gap-3">
        {hasWorld && (
          <div className="hidden md:block text-white text-sm opacity-90 max-w-[40ch] truncate">
            {firstObj ? `Objective: ${firstObj}` : 'No active objectives'}
          </div>
        )}
        <button
          onClick={onToggleLog}
          className="text-white border border-yellow-400 rounded px-4 py-2 hover:bg-yellow-800"
        >
          {showSidebar ? 'Hide Log' : 'Show Log'}
        </button>
      </div>
    </div>
  );
};

export default HeaderBar;

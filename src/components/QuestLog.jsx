import React from 'react';
import ChroniclePanel from './ChroniclePanel';

const STATUS_CONFIG = {
  active: { label: 'Active',    dot: 'bg-amber-400',   text: 'text-white/90' },
  done:   { label: 'Completed', dot: 'bg-emerald-400', text: 'text-white/40 line-through' },
  failed: { label: 'Failed',    dot: 'bg-red-400/70',  text: 'text-white/30 line-through' },
};

const QuestLog = ({ objectives = [], onClose }) => {
  const grouped = {
    active: objectives.filter(o => o.status === 'active'),
    done:   objectives.filter(o => o.status === 'done'),
    failed: objectives.filter(o => o.status === 'failed'),
  };
  const sections = Object.entries(grouped).filter(([, list]) => list.length > 0);

  return (
    <ChroniclePanel title="Quests" onClose={onClose}>
      {sections.length === 0 ? (
        <p className="font-cardo text-sm text-white/35 italic leading-7">
          The road ahead is unwritten. Your quests will reveal themselves in time.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {sections.map(([status, list]) => {
            const cfg = STATUS_CONFIG[status];
            return (
              <div key={status}>
                <p className="font-cardo text-[10px] uppercase tracking-[0.28em] text-white/35 mb-3">
                  {cfg.label}
                </p>
                <ul className="flex flex-col gap-2.5">
                  {list.map((obj) => (
                    <li key={obj.id} className="flex items-start gap-3">
                      <span className={`mt-2 flex-shrink-0 w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      <span className={`font-cardo text-sm leading-6 ${cfg.text}`}>
                        {obj.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </ChroniclePanel>
  );
};

export default QuestLog;

import React from 'react';
import { IS_DEV } from '../config/env';
import { getComputedEmotions } from '../utils/emotionCalculator';
import ChroniclePanel from './ChroniclePanel';

const CharacterLog = ({ companions, onClose, sceneIndex }) => {
  return (
    <ChroniclePanel title="Characters" onClose={onClose}>
      {(!companions || companions.length === 0) ? (
        <p className="font-cardo text-sm text-white/35 italic leading-7">
          No one has crossed your path yet.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {companions.map((char, idx) => {
            const emotions = getComputedEmotions(char);
            const prevEmotions = char.prevEmotions || {};

            const emotionDiff = (curr, prev) => {
              if (typeof prev !== 'number' || typeof curr !== 'number') return '';
              const delta = curr - prev;
              if (delta === 0) return '';
              return ` (${delta > 0 ? '+' : ''}${delta})`;
            };

            return (
              <div key={idx} className="border-b border-white/8 pb-5 last:border-0 last:pb-0">
                <h3 className="font-berkshire text-lg text-white/90 mb-1">{char.name}</h3>
                <p className="font-cardo text-xs text-white/45 mb-3">
                  {char.role}{char.role && char.personality ? ' · ' : ''}{char.personality}
                </p>

                {char.lastSpoken?.line && (
                  <p className="font-cardo text-sm text-white/60 italic mb-3 leading-6">
                    "{char.lastSpoken.line}"
                  </p>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                  {Object.entries(emotions).map(([key, value]) => (
                    <span key={key} className="font-cardo text-xs text-white/50">
                      <span className="capitalize">{key}</span>{' '}
                      <span className="text-white/75">{value}</span>
                      {emotionDiff(value, prevEmotions[key]) && (
                        <span className={value > (prevEmotions[key] ?? 0) ? 'text-emerald-400/70' : 'text-red-400/70'}>
                          {emotionDiff(value, prevEmotions[key])}
                        </span>
                      )}
                    </span>
                  ))}
                </div>

                {typeof char.lastUpdatedScene === 'number' && typeof sceneIndex === 'number' && (
                  <p className="font-cardo text-[11px] text-white/30">
                    Last seen {sceneIndex - char.lastUpdatedScene === 0
                      ? 'this scene'
                      : `${sceneIndex - char.lastUpdatedScene} scene${sceneIndex - char.lastUpdatedScene !== 1 ? 's' : ''} ago`}
                  </p>
                )}

                {IS_DEV && char.purpose && (
                  <div className="mt-3 pt-3 border-t border-white/8 text-[11px] text-amber-400/60 font-cardo">
                    <p><span className="opacity-60">Purpose:</span> {char.purpose.main}</p>
                    <p><span className="opacity-60">Progress:</span> {char.purpose.progress || 0}%</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ChroniclePanel>
  );
};

export default CharacterLog;

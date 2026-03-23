import React from 'react';
import { IS_DEV } from '../config/env';
import { getComputedEmotions } from '../utils/emotionCalculator';

const CharacterLog = ({ companions, onClose, currentScene }) => {
  return (
    <div className="w-96 h-full bg-black bg-opacity-80 text-white p-4 overflow-y-auto border-l border-yellow-400">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-yellow-300">🧑‍🤝‍🧑 Characters</h2>
        <button
          className="text-sm bg-yellow-700 hover:bg-yellow-800 px-2 py-1 rounded"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      {companions && companions.length > 0 ? (
        companions.map((char, idx) => {
          const emotions = getComputedEmotions(char);
          const prevEmotions = char.prevEmotions || {};

          const emotionDiff = (curr, prev) => {
            if (typeof prev !== 'number' || typeof curr !== 'number') return '';
            const delta = curr - prev;
            if (delta === 0) return '';
            return ` (${delta > 0 ? '+' : ''}${delta})`;
          };

          const formatImpact = (impact) => {
            if (!impact || typeof impact !== 'object') return '';
            return Object.entries(impact)
              .map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v}`)
              .join(', ');
          };

          return (
            <div key={idx} className="mb-4 border-b border-yellow-600 pb-2">
              <h3 className="text-lg font-semibold text-yellow-200">{char.name}</h3>
              <p><span className="font-semibold">Role:</span> {char.role}</p>
              <p><span className="font-semibold">Personality:</span> {char.personality}</p>
              <p><span className="font-semibold">Last Spoken:</span> {char.lastSpoken?.line || 'N/A'}</p>
              <p><span className="font-semibold">Last Seen:</span> {typeof char.lastUpdatedScene === 'number' && typeof currentScene === 'number' ? `${currentScene - char.lastUpdatedScene} scenes ago` : 'Unknown'}</p>

              <p className="mt-2"><span className="font-semibold">Emotions (derived from history):</span></p>
              <ul className="ml-4 list-disc">
                {Object.entries(emotions).map(([key, value]) => (
                  <li key={key}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}: {value}{emotionDiff(value, prevEmotions[key])}
                  </li>
                ))}
              </ul>

              {char.relationshipHistory && char.relationshipHistory.length > 0 && (
                <div className="mt-2">
                  <p className="font-semibold">Relationship History:</p>
                  <ul className="ml-4 list-disc">
                    {char.relationshipHistory.map((entry, i) => (
                      <li key={i}>{entry.event} ({formatImpact(entry.impact)})</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 🚧 Debug Info (dev only) */}
              {IS_DEV && (
                <div className="mt-3 text-yellow-400 text-xs border-t border-yellow-600 pt-2">
                  <p><strong>[DEBUG]</strong></p>
                  <p>Status: {char.status || 'unknown'}</p>
                  {char.purpose && (
                    <div>
                      <p><strong>Main Purpose:</strong> <em>{char.purpose.main}</em></p>
                      <p><strong>Progress:</strong> {char.purpose.progress || 0}%</p>
                      <p><strong>Subgoals:</strong></p>
                      <ul className="ml-4 list-disc">
                        {(char.purpose.subgoals || []).map((goal, i) => (
                          <li key={i}>{goal}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {typeof char.purposeAssignedScene === 'number' && (
                    <p>Assigned Scene: {char.purposeAssignedScene}</p>
                  )}
                  {char.purposeFulfilled && <p>✅ Purpose Fulfilled</p>}
                  {typeof char.phaseOutIn === 'number' && (
                    <p>⏳ Scenes to phase out: {char.phaseOutIn}</p>
                  )}
                  {char.phasedOutScene !== null && (
                    <p>📦 Phased Out At: Scene {char.phasedOutScene}</p>
                  )}
                </div>
              )}
            </div>
          );
        })
      ) : (
        <p className="text-gray-400">No characters detected yet.</p>
      )}
    </div>
  );
};

export default CharacterLog;

///src/components/sceneLog.js
import React, { useState } from 'react';

const SceneLog = ({ scenes, onClose }) => {
  const [expandedScene, setExpandedScene] = useState(null);

  const toggleScene = (index) => {
    setExpandedScene(expandedScene === index ? null : index);
  };

  return (
    <div className="transition-all duration-300 w-1/3 bg-black bg-opacity-70 overflow-y-auto text-white p-4 animate-slide-in-left">
      <h2 className="text-xl font-bold mb-2">📜 Scene Log</h2>
      <button
        onClick={onClose}
        className="text-sm text-yellow-300 underline mb-4"
      >
        Close
      </button>
      <ul className="space-y-2">
        {scenes.map((scene, index) => (
          <li key={index} className="border border-yellow-500 rounded">
            <button
              onClick={() => toggleScene(index)}
              className="w-full text-left p-2 bg-yellow-800 bg-opacity-20 hover:bg-opacity-40 rounded-t text-yellow-200 font-semibold"
            >
              Scene {index} — {scene.choice || 'No choice'}
            </button>
            {expandedScene === index && (
              <div className="p-2 text-sm bg-yellow-900 bg-opacity-10 rounded-b">
                <p className="mb-2"><strong>Story:</strong><br />{scene.story}</p>
                <p><strong>Choice Made:</strong> {scene.choice || '—'}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SceneLog;
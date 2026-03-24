import React, { useState } from 'react';

const SceneLog = ({ scenes, onClose }) => {
  const [expandedScene, setExpandedScene] = useState(null);

  const toggleScene = (sceneId) => {
    setExpandedScene(expandedScene === sceneId ? null : sceneId);
  };

  return (
    <div className="w-1/3 animate-slide-in-left overflow-y-auto bg-black bg-opacity-70 p-4 text-white transition-all duration-300">
      <h2 className="mb-2 text-xl font-bold">Scene Log</h2>
      <button onClick={onClose} className="mb-4 text-sm text-yellow-300 underline">
        Close
      </button>

      {scenes.length === 0 ? (
        <p className="text-sm text-white/60">No scenes yet.</p>
      ) : (
        <ul className="space-y-2">
          {scenes.map((scene) => (
            <li key={scene.id} className="rounded border border-yellow-500">
              <button
                onClick={() => toggleScene(scene.id)}
                className="w-full rounded-t bg-yellow-800 bg-opacity-20 p-2 text-left font-semibold text-yellow-200 hover:bg-opacity-40"
              >
                Scene {scene.depth}
                {scene.choiceFromParent ? ` - ${scene.choiceFromParent}` : ''}
              </button>

              {expandedScene === scene.id && (
                <div className="rounded-b bg-yellow-900 bg-opacity-10 p-3 text-sm">
                  {scene.title && (
                    <p className="mb-2">
                      <strong>Title:</strong> {scene.title}
                    </p>
                  )}
                  {scene.choiceFromParent && (
                    <p className="mb-2">
                      <strong>Arrived Via:</strong> {scene.choiceFromParent}
                    </p>
                  )}
                  <p className="mb-2 whitespace-pre-wrap">
                    <strong>Prose:</strong>
                    <br />
                    {scene.prose || scene.story || 'No prose stored for this scene.'}
                  </p>
                  {scene.summary && (
                    <p className="whitespace-pre-wrap">
                      <strong>Summary:</strong>
                      <br />
                      {scene.summary}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SceneLog;

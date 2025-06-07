// LoadGameScreen.js (with element-level slow fade-in animations)

import React, { useEffect, useState } from 'react';
import { getAllSaveSlots, loadGameFromSlot } from '../utils/saveSystem';

const LoadGameScreen = ({ onLoadSelectedGame, onBack }) => {
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    const saves = getAllSaveSlots();
    setSlots(saves);
  }, []);

  const handleSlotClick = (slot) => {
    const save = loadGameFromSlot(slot);
    if (!save) {
      alert('❌ Failed to load save. The file may be missing or corrupted.');
      return;
    }
    if (!save.memory || !save.ui) {
      alert('⚠️ Save file incomplete: missing memory or UI.');
      console.warn('⚠️ Save file incomplete:', save);
      return;
    }
    onLoadSelectedGame(save);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-4">
      <h1 className="text-2xl font-bold mb-6 animate-fade-in-slow">📂 Load Saved Game</h1>

      {slots.length === 0 ? (
        <p className="animate-fade-in-slow">No saved games found.</p>
      ) : (
        <ul className="w-full max-w-md space-y-4 animate-fade-in-slow">
          {slots.map((slot) => (
            <li key={slot.key} className="bg-gray-800 rounded p-4 shadow animate-fade-in-slow">
              <p className="text-sm">Slot: {slot.key.replace('savedGame_', '')}</p>
              <p className="text-xs">Saved: {new Date(slot.timestamp).toLocaleString()}</p>
              <button
                onClick={() => handleSlotClick(slot.key.replace('savedGame_', ''))}
                className="shimmer-hover mt-2 px-4 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-sm animate-fade-in-slow"
              >
                ▶ Load
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={onBack}
        className="shimmer-hover mt-6 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm animate-fade-in-slow"
      >
        🔙 Back to Menu
      </button>
    </div>
  );
};

export default LoadGameScreen;
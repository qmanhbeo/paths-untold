// MainMenu.js

import React from 'react';

const MainMenu = ({ onStartNewGame, onLoadGame, onQuit }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white gap-6 p-4">
      {/* Logo + Game Name */}
      <div className="flex flex-col items-center mb-6 animate-fade-in-slow">
        <img
          src={`${process.env.PUBLIC_URL}/logo192.png`}
          alt="Paths Untold Logo"
          className="w-24 h-24 mb-4"
        />
        <h1 className="text-4xl font-bold">Paths Untold</h1>
      </div>

      {/* Buttons */}
      <button
        onClick={onStartNewGame}
        className="shimmer-hover px-6 py-3 bg-green-600 hover:bg-green-700 rounded text-lg animate-fade-in-slow"
      >
        ▶ Start New Game
      </button>

      <button
        onClick={onLoadGame}
        className="shimmer-hover px-6 py-3 bg-yellow-600 hover:bg-yellow-700 rounded text-lg animate-fade-in-slow"
      >
        📂 Load Saved Game
      </button>

      <button
        onClick={onQuit}
        className="shimmer-hover px-6 py-3 bg-red-600 hover:bg-red-700 rounded text-lg animate-fade-in-slow"
      >
        ❌ Quit
      </button>
    </div>
  );
};

export default MainMenu;

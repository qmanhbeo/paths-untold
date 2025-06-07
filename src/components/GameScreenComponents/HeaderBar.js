import React from 'react';

const HeaderBar = ({ title, onToggleLog, showSidebar }) => (
  <div className="flex justify-between items-center mb-4">
    <h1 className="font-berkshire text-3xl font-bold text-white mix-blend-difference">{title}</h1>
    <button
      onClick={onToggleLog}
      className="text-white border border-yellow-400 rounded px-4 py-2 hover:bg-yellow-800"
    >
      {showSidebar ? 'Hide Log' : 'Show Log'}
    </button>
  </div>
);

export default HeaderBar;

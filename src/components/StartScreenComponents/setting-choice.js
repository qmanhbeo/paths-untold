import React, { useState, useEffect } from 'react';

const SettingChoice = ({ selectedSetting, setSelectedSetting, customSetting, setCustomSetting }) => {
  const [shuffledSettings, setShuffledSettings] = useState([]);

  useEffect(() => {
    const baseSettings = [
      'Medieval Kingdom', 'Futuristic City', 'Remote Wilderness', 'Small Town', 'Space Station',
      'Ancient Ruins', 'Modern Metropolis', 'Suburban Neighborhood', 'Desert Oasis', 'Tropical Island',
      'Haunted Mansion', 'Enchanted Forest', 'Distant Planet', 'Underwater City', 'Dreamscape',
      'Virtual Reality', 'Historical Setting (e.g., Ancient Rome, Victorian England)'
    ];
    const shuffled = [...baseSettings];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setShuffledSettings(shuffled);
  }, []);

  const handleSettingChange = (setting) => {
    setSelectedSetting((prev) =>
      prev.includes(setting) ? prev.filter((s) => s !== setting) : [...prev, setting]
    );
  };

  return (
    <div className="mb-4">
      <br />
      <div className="flex flex-wrap gap-4">
        {shuffledSettings.map((setting) => (
          <label key={setting} className="flex items-center border-2 border-gray-300 rounded-lg p-3 hover:border-blue-400 transition-colors cursor-pointer bg-white bg-opacity-50">
            <input
              type="checkbox"
              name="setting"
              value={setting}
              checked={selectedSetting.includes(setting)}
              onChange={() => handleSettingChange(setting)}
              className="mr-3 w-5 h-5 flex-shrink-0"
            />
            <span className="text-gray-800 whitespace-nowrap">{setting}</span>
          </label>
        ))}
      </div>
      <div className="mt-4">
        <input
          type="text"
          value={customSetting}
          onChange={(e) => setCustomSetting(e.target.value)}
          placeholder="The Setting of Your Imagination"
          className="border-2 border-gray-300 rounded-lg p-3 w-full bg-white bg-opacity-50 focus:border-blue-400 transition-colors"
        />
      </div>
    </div>
  );
};

export default SettingChoice;
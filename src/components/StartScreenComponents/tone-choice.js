import React, { useState, useEffect } from 'react';

const ToneChoice = ({ selectedTone, setSelectedTone, customTone, setCustomTone }) => {
  const [shuffledTones, setShuffledTones] = useState([]);

  useEffect(() => {
    const baseTones = [
      'Lighthearted and Humorous', 'Serious and Dramatic', 'Dark and Gritty',
      'Optimistic and Uplifting', 'Whimsical', 'Suspenseful', 'Melancholy',
      'Action-Packed', 'Introspective', 'Epic', 'Cozy', 'Satirical', 'Nostalgic', 'Romantic'
    ];
    const shuffled = [...baseTones];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setShuffledTones(shuffled);
  }, []);

  const handleToneChange = (tone) => {
    setSelectedTone((prev) =>
      prev.includes(tone) ? prev.filter((t) => t !== tone) : [...prev, tone]
    );
  };

  return (
    <div className="mb-4">
      <br />
      <div className="flex flex-wrap gap-4">
        {shuffledTones.map((tone) => (
          <label key={tone} className="flex items-center border-2 border-gray-300 rounded-lg p-3 hover:border-blue-400 transition-colors cursor-pointer bg-white bg-opacity-50">
            <input
              type="checkbox"
              name="tone"
              value={tone}
              checked={selectedTone.includes(tone)}
              onChange={() => handleToneChange(tone)}
              className="mr-3 w-5 h-5 flex-shrink-0"
            />
            <span className="text-gray-800 whitespace-nowrap">{tone}</span>
          </label>
        ))}
      </div>
      <div className="mt-4">
        <input
          type="text"
          value={customTone}
          onChange={(e) => setCustomTone(e.target.value)}
          placeholder="Define the Aura of Your Legend"
          className="border-2 border-gray-300 rounded-lg p-3 w-full bg-white bg-opacity-50 focus:border-blue-400 transition-colors"
        />
      </div>
    </div>
  );
};

export default ToneChoice;
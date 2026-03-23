import React, { useState, useEffect } from 'react';

const GenderChoice = ({ selectedGender, setSelectedGender, customGender, setCustomGender }) => {
  const [shuffledGenders, setShuffledGenders] = useState([]);

  useEffect(() => {
    const baseGenders = ['Male', 'Female'];
    const shuffled = [...baseGenders];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setShuffledGenders(shuffled);
  }, []);

  const handleGenderChange = (gender) => {
    setSelectedGender((prev) =>
      prev.includes(gender) ? prev.filter((g) => g !== gender) : [...prev, gender]
    );
  };

  return (
    <div className="mb-4">
      <br />
      <div className="flex flex-wrap gap-4">
        {shuffledGenders.map((gender) => (
          <label key={gender} className="flex items-center border-2 border-gray-300 rounded-lg p-3 hover:border-blue-400 transition-colors cursor-pointer bg-white bg-opacity-50">
            <input
              type="checkbox"
              name="gender"
              value={gender}
              checked={selectedGender.includes(gender)}
              onChange={() => handleGenderChange(gender)}
              className="mr-3 w-5 h-5 flex-shrink-0"
            />
            <span className="text-gray-800 whitespace-nowrap">{gender}</span>
          </label>
        ))}
      </div>
      <div className="mt-4">
        <input
          type="text"
          value={customGender}
          onChange={(e) => setCustomGender(e.target.value)}
          placeholder="Express Your Identity"
          className="border-2 border-gray-300 rounded-lg p-3 w-full bg-white bg-opacity-50 focus:border-blue-400 transition-colors"
        />
      </div>
    </div>
  );
};

export default GenderChoice;
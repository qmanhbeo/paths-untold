import React, { useState, useEffect } from 'react';

const GenreChoice = ({ selectedGenres, setSelectedGenres, customGenre, setCustomGenre }) => {
  const [shuffledGenres, setShuffledGenres] = useState([]);

  useEffect(() => {
    const baseGenres = [
      'Fantasy', 'Sci-Fi', 'Mystery/Thriller', 'Horror', 'Romance', 'Adventure',
      'Historical Fiction', 'Slice of Life', 'Comedy', 'Cyberpunk',
      'Post-Apocalyptic', 'Superhero', 'Young Adult', "Children's", 'Mythology',
      'Fairy Tale', 'Dystopian', 'Steampunk', 'Western', 'Crime',
      'Psychological Thriller', 'Paranormal',
    ];
    const shuffled = [...baseGenres];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setShuffledGenres(shuffled);
  }, []);

  const handleGenreChange = (genre) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  return (
    <div>
      <div className="mb-4">
        <br />
        <div className="flex flex-wrap gap-4">
          {shuffledGenres.map((genre) => (
            <label key={genre} className="flex items-center border-2 border-gray-300 rounded-lg p-3 hover:border-blue-400 transition-colors cursor-pointer bg-white bg-opacity-50">
              <input
                type="checkbox"
                value={genre}
                checked={selectedGenres.includes(genre)}
                onChange={() => handleGenreChange(genre)}
                className="mr-3 w-5 h-5 flex-shrink-0"
              />
              <span className="text-gray-800 whitespace-nowrap">{genre}</span>
            </label>
          ))}
        </div>
        <div className="mt-4">
          <input
            type="text"
            value={customGenre}
            onChange={(e) => setCustomGenre(e.target.value)}
            placeholder="Specify Beyond the Known Genres"
            className="border-2 border-gray-300 rounded-lg p-3 w-full bg-white bg-opacity-50 focus:border-blue-400 transition-colors"
          />
        </div>
      </div>
    </div>
  );
};

export default GenreChoice;
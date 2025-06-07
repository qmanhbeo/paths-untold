// StartScreen.js with a dedicated final Start page after GenderChoice

import React, { useState } from 'react';
import {
  GenreChoice,
  ToneChoice,
  SettingChoice,
  ProtagonistChoice,
  GenderChoice
} from './StartScreenComponents';
import backgroundImage from '../images/background-black.jpg';

const StartScreen = ({ onStart, onBackToMenu }) => {
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedTone, setSelectedTone] = useState([]);
  const [selectedProtagonists, setSelectedProtagonists] = useState([]);
  const [selectedSetting, setSelectedSetting] = useState([]);
  const [selectedGender, setSelectedGender] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [customGenre, setCustomGenre] = useState('');
  const [customTone, setCustomTone] = useState('');
  const [customProtagonist, setCustomProtagonist] = useState('');
  const [customGender, setCustomGender] = useState('');
  const [customSetting, setCustomSetting] = useState('');

  const pages = [
    {
      title: "Select Genres",
      content: (
        <GenreChoice 
          selectedGenres={selectedGenres}
          setSelectedGenres={setSelectedGenres}
          customGenre={customGenre}
          setCustomGenre={setCustomGenre}
        />
      ),
    },
    {
      title: "Select Tone/Mood",
      content: (
        <ToneChoice 
          selectedTone={selectedTone}
          setSelectedTone={setSelectedTone}
          customTone={customTone}
          setCustomTone={setCustomTone}
        />
      ),
    },
    {
      title: "Select Setting",
      content: (
        <SettingChoice 
          selectedSetting={selectedSetting}
          setSelectedSetting={setSelectedSetting}
          customSetting={customSetting}
          setCustomSetting={setCustomSetting}
        />
      ),
    },
    {
      title: "Select Protagonist Role",
      content: (
        <ProtagonistChoice 
          selectedProtagonists={selectedProtagonists}
          setSelectedProtagonists={setSelectedProtagonists}
          customProtagonist={customProtagonist}
          setCustomProtagonist={setCustomProtagonist}
        />
      ),
    },
    {
      title: "Select Gender",
      content: (
        <GenderChoice 
          selectedGender={selectedGender}
          setSelectedGender={setSelectedGender}
          customGender={customGender}
          setCustomGender={setCustomGender}
        />
      ),
    },
    {
      title: "Ready to Begin?",
      content: (
        <div className="text-white text-lg space-y-2">
          <p>You're all set. Here's a summary of your choices:</p>
          <p><strong>Genre:</strong> {selectedGenres.join(', ') || 'unspecified'}</p>
          <p><strong>Tone:</strong> {selectedTone.join(', ') || 'unspecified'}</p>
          <p><strong>Setting:</strong> {selectedSetting.join(', ') || 'unspecified'}</p>
          <p><strong>Protagonist Role:</strong> {selectedProtagonists.join(', ') || 'unspecified'}</p>
          <p><strong>Protagonist Gender:</strong> {selectedGender.join(', ') || 'unspecified'}</p>
          <p>Click the button below to begin your story adventure.</p>
        </div>
      )
    }
  ];

  const handleStartClick = () => {
    const genreValue = selectedGenres.length > 0 ? selectedGenres.join(', ') : 'unspecified';
    const toneValue = selectedTone.length > 0 ? selectedTone.join(', ') : 'unspecified';
    const protagonistValue = selectedProtagonists.length > 0 ? selectedProtagonists.join(', ') : 'unspecified';
    const settingValue = selectedSetting.length > 0 ? selectedSetting.join(', ') : 'unspecified';
    const genderValue = selectedGender.length > 0 ? selectedGender.join(', ') : 'unspecified';

    const prompt = `You are an interactive story generator. Your task is to create an engaging, second-person narrative experience shaped entirely by the following player-defined values:

- Genre: ${genreValue}  
- Protagonist Role: ${protagonistValue}  
- Protagonist Gender: ${genderValue}  
- Tone: ${toneValue}  
- Setting: ${settingValue}

These values are **core to the story**. Every detail—setting, characters, tone, pacing, and conflict—must reflect and reinforce them throughout the narrative.

The player should **not already know the world**. The story must unfold through **exploration, inspection, and dialogue**. Let the world reveal itself gradually through what the protagonist notices, questions, or hears from others. Avoid exposition dumps—show, don’t tell.

Start with a captivating and imaginative story **title** that reflects the essence of the journey ahead.

Then, immediately dive into the narrative, written in the second person ("you"). Begin with a **strong hook**—a moment of intrigue, danger, beauty, or confusion. Make the player curious. Describe the setting vividly and let the tone come through naturally in how the world feels and how people behave.
Introduce an NPC friend
After building this short opening scene (2-3 SHORT PARAGRAPHS), present the player with **four distinct choices**. Each choice must:
- Reflect different ways of thinking, feeling, or acting  
- Invite further discovery or shift the story meaningfully  
- Not be obvious or easy—force the player to make a **difficult, interesting decision**  
- Avoid clichés or “safe” options. Make each choice matter.

Use **frequent line breaks** for dynamic pacing and enhanced readability. Keep the story immersive, surprising, and grounded in the player's evolving perspective.

📦 RETURN FORMAT:
Respond with **ONLY valid JSON** in this structure:

{
  "title": "title",

  "story": "Start with a rewrite of the player’s last choice (dialogue or action). Then continue with vivid prose in 2–3 short paragraphs.",

  "choices": [
    "....",
    "....",
    "....",
    "...."
  ],
  // Each choice must reflect a different emotional or strategic direction (e.g. confront, avoid, persuade, observe).
  // Avoid redundancy. Make each one consequential and thought-provoking.

  "characters": [
    {
      "name": "Character name" (except the player who you refered to as "you"),
      "personality": "Brief description",
      "role": "Their role in the story",
      "purpose": "Why they are currently in the story (max 1 sentence). Extra-specific, no subtlety. Maybe foreshadowing the story",
      "fulfilled": [1 if the character actively and conclusively fulfills their stated purpose in this specific scene (not just contributes), 0 if not],
      "knownFacts": ["Any key facts learned"],
      "lastSpoken": { "line": "Quoted speech from this scene" },
      "relationshipHistory": [
        {
          "event": "What happened in this scene",
          "impact": {
            "trust": 5,
            "affection": -2,
            "respect": 10
          }
        }
      ]
    }
  ],

  "summary": "A 150–200 word summary of this scene only (not the full story)"
}

🚫 Do NOT include any explanation, commentary, or formatting outside the JSON.`;

    onStart({ prompt, selectedGenres, selectedTone, selectedProtagonists, selectedSetting, selectedGender });
  };

  const handleNext = () => {
    if (currentPage === 0 && customGenre) {
      setSelectedGenres((prev) => [...prev, customGenre]);
      setCustomGenre('');
    } else if (currentPage === 1 && customTone) {
      setSelectedTone((prev) => [...prev, customTone]);
      setCustomTone('');
    } else if (currentPage === 2 && customSetting) {
      setSelectedSetting((prev) => [...prev, customSetting]);
      setCustomSetting('');
    } else if (currentPage === 3 && customProtagonist) {
      setSelectedProtagonists((prev) => [...prev, customProtagonist]);
      setCustomProtagonist('');
    } else if (currentPage === 4 && customGender) {
      setSelectedGender((prev) => [...prev, customGender]);
      setCustomGender('');
    }

    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleBack = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    } else if (onBackToMenu) {
      onBackToMenu();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-cover bg-center bg-no-repeat relative" style={{ backgroundImage: `url(${backgroundImage})` }}>
      <div className="bg-white bg-opacity-20 rounded-lg shadow-lg p-6 w-full max-w-4xl h-[600px] flex flex-col animate-fade-in-slow">
        <h2 className="text-2xl font-bold mb-4 text-center text-white mix-blend-difference animate-fade-in-slow">{pages[currentPage].title}</h2>

        <div
          key={currentPage}
          className="flex-grow overflow-y-auto mb-4 transition-opacity duration-[1500ms] ease-in-out animate-fade-in-slow"
        >
          {pages[currentPage].content}
        </div>

        <div className="flex justify-between mt-auto space-x-4 animate-fade-in-slow">
          <button
            className="shimmer-hover bg-gray-400 text-white rounded-lg px-6 py-2 hover:bg-gray-500 transition text-lg animate-fade-in-slow"
            onClick={handleBack}
          >
            {currentPage === 0 ? 'Return to Menu' : 'Back'}
          </button>

          {currentPage < pages.length - 1 && (
            <button
              className="shimmer-hover bg-blue-600 text-white rounded-lg px-6 py-2 hover:bg-blue-700 transition text-lg animate-fade-in-slow"
              onClick={handleNext}
            >
              Next
            </button>
          )}

          {currentPage === pages.length - 1 && (
            <button
              className="shimmer-hover bg-blue-600 text-white rounded-lg px-6 py-2 hover:bg-blue-700 transition text-lg font-semibold animate-fade-in-slow"
              onClick={handleStartClick}
            >
              Start Your Adventure
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StartScreen;
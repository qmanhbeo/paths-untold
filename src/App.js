// App.js (with full save/load logic patched correctly)
import React, { useState, useEffect } from 'react';
import MainMenu from './components/MainMenu';
import StartScreen from './components/StartScreen';
import LoadGameScreen from './components/LoadGameScreen';
import GameScreen from './components/GameScreen';


function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [showStartScreen, setShowStartScreen] = useState(false);
  const [showLoadScreen, setShowLoadScreen] = useState(false);
  const [storyOptions, setStoryOptions] = useState({});

  const handleStartNewGame = () => {
    setShowStartScreen(true);
    setShowLoadScreen(false);
  };

  const handleStartFromOptions = (options) => {
    setStoryOptions(options);
    setGameStarted(true);
  };

  const handleLoadSelectedGame = (save) => {
    if (save?.memory && save?.ui) {
      setStoryOptions({
        ...save.options,
        memory: save.memory,
        ui: save.ui,
        resumeFromSave: true
      });
      setGameStarted(true);
    } else {
      console.warn("⚠️ Save file incomplete:", save);
    }
  };

  const handleQuit = () => {
    window.location.reload();
  };

  const handleBackToMenu = () => {
    setShowStartScreen(false);
    setShowLoadScreen(false);
    setGameStarted(false); // <-- THIS is the fix
  };

  const handleLoad = () => {
    setShowLoadScreen(true);
    setShowStartScreen(false);
  };

  return (
    <div className="App">
      {!gameStarted ? (
        showStartScreen ? (
          <StartScreen onStart={handleStartFromOptions} onBackToMenu={handleBackToMenu} />
        ) : showLoadScreen ? (
          <LoadGameScreen onLoadSelectedGame={handleLoadSelectedGame} onBack={handleBackToMenu} />
        ) : (
          <MainMenu 
            onStartNewGame={handleStartNewGame} 
            onLoadGame={handleLoad} 
            onQuit={handleQuit} 
          />
        )
      ) : (
        <GameScreen 
          storyOptions={storyOptions} 
          prompt={storyOptions.prompt}
          onBackToMenu={handleBackToMenu}
        />
      )}
    </div>
  );
}

export default App;
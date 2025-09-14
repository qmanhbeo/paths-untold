// GameScreen.js

import React, { useEffect, useState, useRef } from 'react';
import { generateStory } from '../utils/AI-chat';
import { updateCharacterTraits } from '../utils/updateCharacter';
import { getComputedEmotions } from '../utils/emotionCalculator';
import { updateGameMemory } from '../utils/memoryManager';
import { saveGameToSlot } from '../utils/saveSystem';
import { buildUnifiedPrompt } from '../utils/buildUnifiedPrompt';
import { applyDeltas } from '../state/applyDeltas';
import {
  assignPurposeIfNeeded,
  updatePhaseOutCountdowns
} from '../utils/phaseOutManager';

import SceneLog from './sceneLog';
import CharacterLog from './characterLog';
import {
  HeaderBar,
  ChoiceGrid,
} from './GameScreenComponents';

import './styles.css';
import backgroundImage from '../images/background-black.jpg';

// -- helper to patch old saves that don't have world/arc yet
const ensureWorldArc = (mem) => ({
  ...mem,
  world: mem?.world ?? {
    clock: { day: 1, time: 'day' },
    location: { name: 'Unknown Place', tags: [] },
    sceneTags: [],
    objectives: [],
    flags: {}
  },
  arc: mem?.arc ?? { chapter: 1, beat: 0, tension: 3 }
});

const GameScreen = ({ prompt, storyOptions, onBackToMenu }) => {
  const [displayedTitle, setDisplayedTitle] = useState('Your Adventure Awaits...');
  const [fadeInTitle, setFadeInTitle] = useState(true);
  const [storySegments, setStorySegments] = useState([]);
  const [displayedChoices, setDisplayedChoices] = useState([]);
  const [rawOutput, setRawOutput] = useState('');
  const [titleSet, setTitleSet] = useState(false);
  const [storySummary, setStorySummary] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showCharacterPanel, setShowCharacterPanel] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('slot1');
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const storyBoxRef = useRef(null);
  const storyGenerated = useRef(false);

  const [gameMemory, setGameMemory] = useState(() => {
    if (storyOptions?.resumeFromSave && storyOptions.memory) {
      return ensureWorldArc(storyOptions.memory);
    }
    sessionStorage.removeItem('gameMemory');
    return {
      summary: [], choices: [], companions: [], story: [], currentScene: 0,
      world: {
        clock: { day: 1, time: 'day' },
        location: { name: 'Unknown Place', tags: [] },
        sceneTags: [],
        objectives: [],
        flags: {}
      },
      arc: { chapter: 1, beat: 0, tension: 3 }
    };
  });

  useEffect(() => {
    if (storyOptions?.resumeFromSave && storyOptions?.ui && storyOptions.memory) {
      const { displayedTitle, rawOutput } = storyOptions.ui;
      setDisplayedTitle(displayedTitle);
      setRawOutput(rawOutput);
      setTitleSet(true);
      setStorySegments([{ html: storyOptions.ui.displayedStory, animate: false }]);
      setDisplayedChoices(storyOptions.ui.displayedChoices);
      storyGenerated.current = true;
      return;
    }

    if (!storyGenerated.current && !storyOptions?.resumeFromSave && prompt) {
      setIsLoading(true);
      const initialMemory = {
        summary: [], choices: [], companions: [], story: [], currentScene: 0,
        world: {
          clock: { day: 1, time: 'day' },
          location: { name: 'Unknown Place', tags: [] },
          sceneTags: [],
          objectives: [],
          flags: {}
        },
        arc: { chapter: 1, beat: 0, tension: 3 }
      };
      setGameMemory(initialMemory);

      const newPrompt = buildUnifiedPrompt(initialMemory, '', storyOptions);
      generateStory(newPrompt, async (rawAI0) => {
        console.log('[PROMPT 0]', newPrompt);
        await handleRawAIX(rawAI0, '');
        setIsLoading(false);
      });

      storyGenerated.current = true;
    }
  }, [prompt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    sessionStorage.setItem('gameMemory', JSON.stringify(gameMemory));
  }, [gameMemory]);

  const handleRawAIX = async (rawAIX, choice = '', retry = false) => {
    console.log(`[RAW AI OUTPUT - Scene ${gameMemory.story.length}]`, rawAIX);
    setDisplayedChoices([]);
    setRawOutput(typeof rawAIX === 'string' ? rawAIX : JSON.stringify(rawAIX));

    try {
      const parsed = (rawAIX && typeof rawAIX === 'object') ? rawAIX : JSON.parse(rawAIX);
      const {
        title, story, choices, characters, summary,
        sceneTags, objectivesDelta, locationDelta, companionsDelta, arcDelta
      } = parsed;

      if (!titleSet && title) {
        setFadeInTitle(false);
        setTimeout(() => {
          setDisplayedTitle(title);
          setFadeInTitle(true);
        }, 100);
        setTitleSet(true);
      }

      const htmlSegment = story.replace(/\n/g, '<br />');
      setStorySegments(prev => [...prev, { html: htmlSegment, animate: true }]);
      setDisplayedChoices(choices || []);

      // Apply deltas BEFORE pushing arrays so the updated state is used for merges/UI
      const updatedMemory = (() => {
        const draft = JSON.parse(JSON.stringify(gameMemory)); // simple immutable update
        applyDeltas(draft, { sceneTags, objectivesDelta, locationDelta, companionsDelta, arcDelta });
        return updateGameMemory(draft, story, summary, choice);
      })();

      const trueSceneIdx = updatedMemory.story.length - 1;

      // Use the delta-applied companions as the base for merging
      const companionMap = new Map((updatedMemory.companions || []).map(c => [c.name.toLowerCase(), c]));

      (characters || []).forEach(incoming => {
        const key = String(incoming.name || '').toLowerCase();
        if (!key) return;
        const existing = companionMap.get(key);
        const merged = existing ? updateCharacterTraits(existing, incoming) : incoming;
        const computed = getComputedEmotions(merged);
        companionMap.set(key, {
          ...merged,
          lastUpdatedScene: trueSceneIdx,
          ...computed,
          prevEmotions: existing ? getComputedEmotions(existing) : computed
        });
      });

      const updatedCompanions = Array.from(companionMap.values());

      const withLifecycle = assignPurposeIfNeeded(updatedCompanions, trueSceneIdx);
      const lifecycleUpdated = updatePhaseOutCountdowns(withLifecycle, trueSceneIdx);

      setStorySummary(summary || '');
      setGameMemory(prev => ({
        ...updatedMemory,
        companions: lifecycleUpdated,
        currentScene: trueSceneIdx
      }));

      return { storyX: story, sceneIdx: trueSceneIdx, fourChoicesX: choices };
    } catch (e) {
      console.error('❌ Failed to parse JSON response.', e);

      if (!retry) {
        console.warn('🔁 Retrying generation due to malformed output...');
        const retryPrompt = buildUnifiedPrompt(gameMemory, choice, storyOptions);
        return new Promise(resolve => {
          generateStory(retryPrompt, async (newResponse) => {
            const result = await handleRawAIX(newResponse, choice, true);
            resolve(result);
          });
        });
      }

      setDisplayedChoices([]);
      setStorySegments(prev => [...prev, {
        html: '<i class="text-red-300">⚠️ Failed to load story after retry. Please choose again or reload.</i>',
        animate: true
      }]);

      return { storyX: '', sceneIdx: gameMemory.currentScene, fourChoicesX: [] };
    }
  };

  const handleChoiceClick = async (choice) => {
    if (isLoading) return;
    setIsLoading(true);

    const choiceText = `<br /><br /><strong>The player chooses:</strong> ${choice}<br /><br />`;
    setStorySegments(prev => [...prev, { html: choiceText, animate: false }]);
    setDisplayedChoices([]);

    const newPrompt = buildUnifiedPrompt(gameMemory, choice, storyOptions);
    const nextSceneIndex = gameMemory.currentScene + 1;
    console.log(`[PROMPT FOR SCENE ${nextSceneIndex}]`, newPrompt);

    await generateStory(newPrompt, async (nextScene) => {
      await handleRawAIX(nextScene, choice);
      setIsLoading(false);
    });

    if (storyBoxRef.current) {
      storyBoxRef.current.scrollTop = storyBoxRef.current.scrollHeight;
    }
  };

  const handleSave = () => {
    if (isLoading) return;
    setShowSaveOptions(true);
  };

  const confirmSave = () => {
    saveGameToSlot(selectedSlot, {
      options: { ...storyOptions, prompt, resumeFromSave: true },
      memory: gameMemory,
      ui: {
        displayedStory: storySegments.map(s => s.html).join(''),
        displayedChoices,
        displayedTitle,
        rawOutput
      }
    });
    setSaveMessage(`✅ Game saved to ${selectedSlot}`);
    setTimeout(() => setSaveMessage(''), 2000);
    setShowSaveOptions(false);
  };

  return (
    <div
      className="flex flex-row h-screen bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      {showSidebar && (
        <SceneLog
          scenes={gameMemory.story}
          onClose={() => setShowSidebar(false)}
        />
      )}
      {showCharacterPanel && (
        <div className="flex flex-row animate-slide-in-left">
          <CharacterLog
            companions={gameMemory.companions || []}
            currentScene={gameMemory.currentScene}
            onClose={() => setShowCharacterPanel(false)}
          />
        </div>
      )}

      <div className="flex flex-col flex-grow p-10 pt-10 animate-fade-in-slow">
        <h1
          className={`text-2xl font-bold text-white font-berkshire mb-4 transition-opacity duration-1000 ${fadeInTitle ? 'opacity-100' : 'opacity-0'}`}
        >
          {displayedTitle}
        </h1>

        <HeaderBar mem={gameMemory} onToggleLog={() => setShowSidebar(!showSidebar)} showSidebar={showSidebar} />

        <div className="flex justify-end mb-2 gap-2 items-center animate-fade-in-slow">
          <button
            disabled={isLoading}
            onClick={handleSave}
            className="text-white border border-yellow-300 rounded px-4 py-1 hover:bg-yellow-800 disabled:opacity-50 animate-fade-in-slow"
          >
            Save Game
          </button>
          <button
            onClick={() => setShowCharacterPanel(!showCharacterPanel)}
            className="text-white border border-green-300 rounded px-4 py-1 hover:bg-green-800 animate-fade-in-slow"
          >
            {showCharacterPanel ? 'Hide Characters' : 'Show Characters'}
          </button>
          <button
            onClick={onBackToMenu}
            className="text-white border border-red-300 rounded px-4 py-1 hover:bg-red-800 text-sm animate-fade-in-slow"
          >
            ⏎ Back to Menu
          </button>
        </div>

        {showSaveOptions && (
          <div className="bg-yellow-800 bg-opacity-90 p-4 rounded shadow-lg text-white mb-4 w-fit animate-fade-in-slow">
            <label htmlFor="slot" className="text-sm mr-2">Choose Save Slot:</label>
            <select
              id="slot"
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value)}
              className="text-black px-2 py-1 rounded mr-4"
            >
              <option value="slot1">Slot 1</option>
              <option value="slot2">Slot 2</option>
              <option value="slot3">Slot 3</option>
            </select>
            <button onClick={confirmSave} className="bg-green-600 hover:bg-green-700 px-4 py-1 rounded text-sm">
              Confirm Save
            </button>
          </div>
        )}

        {saveMessage && (
          <div className="text-green-400 text-sm mb-2 animate-fade-in-slow">{saveMessage}</div>
        )}

        <div className="flex-grow rounded-lg p-4 mb-4 overflow-y-auto" ref={storyBoxRef}>
          <div className="w-full h-full border-none outline-none resize-none">
            {storySegments.length === 0 ? (
              <p className="font-cardo text-white mix-blend-difference italic opacity-80 animate-pulse-slow">
                Almost There... Your World is Forming...
              </p>
            ) : (
              storySegments.map((segment, index) => (
                <p
                  key={index}
                  className={`font-cardo text-white mix-blend-difference ${segment.animate ? 'animate-blur-in' : ''}`}
                  dangerouslySetInnerHTML={{ __html: segment.html }}
                />
              ))
            )}
          </div>
        </div>

        <div className="flex-shrink-0 animate-fade-in-slow">
          <ChoiceGrid choices={displayedChoices} onChoice={handleChoiceClick} disabled={isLoading} />
          <p className="text-white mix-blend-difference mt-4">Scene #: {gameMemory.currentScene}</p>
        </div>
      </div>
    </div>
  );
};

export default GameScreen;

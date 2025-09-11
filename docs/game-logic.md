## Game Logic Overview

This document summarizes the core game logic and flow for the AI-driven narrative game.

---

### 🎮 Game Flow

1. **Main Menu (App.js)**
   - Offers options to start a new game, load a saved game, or quit.
   - Transitions to `StartScreen`, `LoadGameScreen`, or `GameScreen` accordingly.

2. **Start Screen (StartScreen.js)**
   - Multi-page input UI where player selects:
     - Genre(s)
     - Tone/Mood
     - Setting
     - Protagonist Role
     - Gender
     - Custom values for all of the above are supported.
   - Final page shows a summary of choices.
   - Builds a detailed story prompt and starts the game.

3. **Game Screen (GameScreen.js)**
   - Displays the story title and first AI-generated scene.
   - Player is presented with four AI-generated choices.
   - Upon selecting a choice:
     - A new prompt is built using memory + the choice.
     - AI generates the next scene.
     - A **cumulative summary** is generated and added to memory.
     - Companion/NPC traits are updated based on character extraction.
     - The new scene and choices are displayed.

---

### 🧠 Memory System (`gameMemory`)

Memory tracks the game state across scenes. It is an object structured as:
```js
{
  summary: [string],      // cumulative summaries by index
  choices: [string],      // choices made at each scene index
  companions: [object],   // NPC data: name, traits, etc.
  story: [string],        // raw story scene content
  currentScene: number    // index of the most recent scene
}
```

Each scene is indexed consistently across these arrays:
- Scene 0: Initial story
  - `summary[0]`: Summary of scene 0 only
  - `choices[0]`: Choice made after scene 0
  - `story[0]`: Full text of scene 0

- Scene 1: Follows choice[0]
  - `summary[1]`: Summary of scene 0 + scene 1
  - `choices[1]`: Choice made after scene 1
  - `story[1]`: Full text of scene 1

- Scene 2:
  - `summary[2]`: Summary of scene 0–2 (cumulative)
  - ...

This continues: `summary[i]` accumulates all prior story content and choices up to and including scene `i`.

NPC data in `companions` is updated at each scene based on new information extracted from `story[i]`, including evolving traits and last seen scene.

NPC emotional states (trust, fear, etc.) are **not directly stored**. Instead, each character's `relationshipHistory` contains past emotional events and their effects. Emotions are **computed on-demand** by evaluating the sum of `effects` from all past events.

This memory is passed into the prompt builder at each step to maintain narrative continuity and character consistency.

---

### 💾 Save/Load System
- Game state can be saved into one of three slots.
- Saves include:
  - Prompt and UI state
  - Full memory object (`gameMemory`)
- Saved data can be reloaded and passed into `GameScreen`, resuming the exact scene and state.

---

### 🤖 AI-Powered Modules (utils/*)

- `generateStory(prompt, callback)` – Main LLM interaction
- `buildStoryPrompt(memory, choice)` – Assembles new scene prompt from memory
- `parseGeneratedStory(rawOutput)` – Extracts story, title, and four choices
- `summarizeStory(text)` – Generates a cumulative summary
- `extractCharacters(story, prevChars)` – Identifies and tracks characters
- `updateCharacterTraits(prev, new)` – Merges character metadata and relationship events
- `updateGameMemory(memory, scene, summary, choice)` – Appends scene data to memory
- `getComputedEmotions(companion)` – Derives current trust, anger, etc. from relationship history only

---

### 🧩 UI Components
- `ChoiceGrid` – Renders four dynamic story choices
- `SceneLog` – Side panel showing accumulated story segments
- `CharacterLog` – Side panel showing NPCs and traits over time
- `HeaderBar` – Top bar with toggles and title display

---

### 🔄 Animation & Visuals
- Title fade-in/out for smooth transitions
- Scene text blur-in animation for immersive effect
- Loading placeholder during world generation
- Themed, styled UI with hover and fade-in interactions

---

### 🌙 Character Phasing-Out Logic (Future Implementation)

To improve performance and narrative flow, a soft "phasing-out" system for inactive characters is proposed:

1. **Track Last Appearance**
   - Already implemented via `character.lastUpdatedScene`
   - Compare against `gameMemory.currentScene`

2. **Define Threshold Logic**
   ```js
   const scenesSinceSeen = currentScene - char.lastUpdatedScene;
   const shouldPhaseOut = scenesSinceSeen > randomBetween(4, 10);
   ```

3. **Prompt Builder Check**
   - If `shouldPhaseOut`, insert:
     ```text
     If appropriate, write a natural farewell, disappearance, or temporary departure for [Character].
     ```

4. **Mark as Inactive**
   ```js
   character.isActive = false;
   character.exitScene = currentScene;
   character.exitReason = 'departed to find answers';
   ```

5. **(Optional) Reappearance**
   - Use `Math.random() < 0.1` check to reintroduce inactive characters unexpectedly.
   - Include reason/prompt for return.

This system minimizes memory bloat and maintains narrative believability without requiring complex conditionals or character logic tracking.

---

This structure allows modular, evolving, memory-based storytelling shaped by player input and dynamic AI generation, with future-proof character lifecycle control.

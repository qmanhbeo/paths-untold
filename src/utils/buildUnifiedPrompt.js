import { injectPhaseOutLogicIntoPrompt } from './phaseOutManager';

export const buildUnifiedPrompt = (gameMemory, latestChoice, playerIntro = null) => {
  const { summary = [], story = [], companions = [], currentScene = 0 } = gameMemory;

  const latestSummary = summary.at(-1) || '';
  const latestScene = story.at(-1) || '';
  const companionString = companions.length > 0
    ? companions.map(c =>
        `- ${c.name}: ${c.personality || 'unknown'}, role: ${c.role || 'unknown'}`
      ).join('\n')
    : 'None yet';

  const phaseOutPromptExtras = injectPhaseOutLogicIntoPrompt(companions, currentScene);

  const isFirstScene = story.length === 0;

  const taskBlock = isFirstScene
    ? `1. Start a brand new story based on the player’s preferences:
- Genre: ${playerIntro?.selectedGenres?.join(', ') || 'unspecified'}
- Protagonist Role: ${playerIntro?.selectedProtagonists?.join(', ') || 'unspecified'}
- Gender: ${playerIntro?.selectedGender?.join(', ') || 'unspecified'}
- Tone: ${playerIntro?.selectedTone?.join(', ') || 'unspecified'}
- Setting: ${playerIntro?.selectedSetting?.join(', ') || 'unspecified'}

2. Open with a vivid, immersive introduction. The player should **not already know the world**. The story must unfold through **exploration, inspection, and dialogue**. Let the world reveal itself gradually through what the protagonist notices, questions, or hears from others. Avoid exposition dumps—show, don’t tell.`
    : `1. Continue the story with strong pacing and emotional nuance.
2. Begin with a rewrite of the player's last choice as natural dialogue or action.`;

  const storyPrompt = isFirstScene
    ? `"story": "Start the story. Then continue with vivid prose in 2–3 short paragraphs.",`
    : '"story": "Start with a rewrite of the player’s last choice (dialogue or action). Then continue with vivid prose in 2–3 short paragraphs.",';

  const titleYes = isFirstScene
    ? `"title": "A captivating title like an actual book or novel",`
    : '';

  return `
You are a storytelling AI for an interactive fiction game.

🎯 TASK:
${taskBlock}
3. Generate four short but meaningful player choices
4. Extract and update character information
5. Provide a short summary of the new scene

📦 RETURN FORMAT:
Respond with **ONLY valid JSON** in this structure:

{
  ${titleYes}

  ${storyPrompt}

  "choices": [
    "....",
    "....",
    "....",
    "...."
  ],
  // Each choice should push the story in a different emotional or strategic direction.
  // Avoid redundancy, clichés, or easy answers. Make the player *think*.


  "characters" (leave blank if none): [
    {
      "name": "Character name" (except the player who you refered to as "you"),
      "personality": "Brief description",
      "role": "Their role in the story",
      "purpose": {
        "main": "What specific multi-step or emotional function this character serves in the story arc. Avoid one-line tasks. Make the purpose matter—e.g., 'guide the player toward realizing their fear of betrayal', 'uncover a hidden secret that challenges the protagonist’s beliefs'. Must take more than one interaction to fulfill.",
        "subgoals": [
          "A list of subgoals (3-10) that the character needs to achieve to fulfill their main purpose.",
          "Each subgoal should be a specific action or event that the character needs to complete.",
          "The subgoals should be related to the main purpose and should help the character achieve their goal."
        ],
        "fulfilled": 0  // 0 to 100 based on how many subgoals are fulfilled
      },
      "knownFacts": ["Any key facts learned"],
      "lastSpoken": { "line": "Quoted speech from this scene" },
      "relationshipHistory": [
        {
          "event": "What happened in this scene",
          "impact": {
            "emotion A": integer,
            "emotion B": integer,
            "emotion C": integer,
            ...
            (emotions: trust, affection, fear, curiosity, anger, respect, shame, hope, jealousy; 1–5 types max)
          }
        }
      ]
    }
  ],

  "summary": "A 150–200 word summary of this scene only (not the full story)"
}

🚫 Do NOT include any explanation, commentary, or formatting outside the JSON.

---
🧠 CONTEXT:

Summary So Far:
${latestSummary}

Last Scene:
${latestScene}

Player's Latest Choice:
${latestChoice}

Known Companions:
${companionString}

${phaseOutPromptExtras}
`.trim();
};
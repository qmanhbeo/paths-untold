// src/utils/buildUnifiedPrompt.js
import { injectPhaseOutLogicIntoPrompt } from './phaseOutManager';

/**
 * Build the LLM prompt with World/Arc state + compact companions.
 * Returns { system, user } for use as separate OpenAI message roles.
 *
 * @param {object} gameMemory
 * @param {string} latestChoice
 * @param {object|null} playerIntro
 */
export const buildScenePrompt = (gameMemory, latestChoice, playerIntro = null) => {
  const {
    summary = [],
    prose = [],
    companions = [],
    sceneIndex = 0,
    world = {
      clock: { day: 1, time: 'day' },
      location: { name: 'Unknown Place', tags: [] },
      sceneTags: [],
      objectives: [],
      flags: {}
    },
    arc = { chapter: 1, beat: 0, tension: 3 }
  } = gameMemory;

  const latestSummary = summary.at(-1) || '';
  const latestProse = prose.at(-1) || '';

  // Only list ACTIVE companions in the prompt (keeps context focused)
  const activeCompanions = (companions || []).filter(c => (c.status ?? 'active') === 'active');
  const companionString = activeCompanions.length > 0
    ? activeCompanions.map(c =>
        `- ${c.name}: ${c.personality || 'unknown'}, role: ${c.role || 'unknown'}`
      ).join('\n')
    : 'None yet';

  const phaseOutPromptExtras = injectPhaseOutLogicIntoPrompt(companions, sceneIndex);
  const isFirstScene = prose.length === 0;

  const worldBlock = `
World:
- Location: ${world?.location?.name ?? 'Unknown Place'} [${(world?.location?.tags || []).join(', ')}]
- Time: Day ${world?.clock?.day ?? 1}, ${world?.clock?.time ?? 'day'}
- SceneTags: ${(world?.sceneTags || []).join(', ') || '—'}
- Objectives: ${(world?.objectives || []).map(o => `${o.status === 'active' ? '[•]' : '[ ]'} ${o.text}`).join(' | ') || '—'}
- Arc: Chapter ${arc?.chapter ?? 1}, Beat ${arc?.beat ?? 0}, Tension ${arc?.tension ?? 3}/10
`.trim();

  const taskBlock = isFirstScene
    ? `Start a brand new story using the player's preferences:
- Genre: ${playerIntro?.selectedGenres?.join(', ') || 'unspecified'}
- Protagonist Role: ${playerIntro?.selectedProtagonists?.join(', ') || 'unspecified'}
- Gender: ${playerIntro?.selectedGender?.join(', ') || 'unspecified'}
- Tone: ${playerIntro?.selectedTone?.join(', ') || 'unspecified'}
- Setting: ${playerIntro?.selectedSetting?.join(', ') || 'unspecified'}

Open with a vivid, immersive introduction in second person ("you"). The world should reveal itself through exploration, inspection, and dialogue — avoid exposition dumps. Do not invent a name for the player character.`
    : `Continue the story with strong pacing and emotional nuance.
Begin naturally by reflecting the player's last choice as dialogue or action.`;

  const system = `You are the narrative engine for a branching story game. Write in clear, vivid prose.

RULES:
- Return ONLY valid JSON (no markdown, no comments, no trailing commas).
- Scene length: ~200–350 words.
- SECOND PERSON ONLY. The protagonist is the player. Always narrate in second person ("you step", "you notice", "you feel") — never assign a proper name to the protagonist, never use third-person ("he", "she", "they", or any named character) for the player character. Other NPCs may have names. The player is always "you".
- Paths MUST be concrete actions the player can take RIGHT NOW, rooted in the specific people, objects, and moments from the closing line of the prose just written. Never invent new locations or characters for the paths — only reference what already exists in the scene. Write each path as a direct second-person or imperative action (e.g. "Ask the old man about the riddle", "Pick up the flyer and read it closely") — never as an outcome description or spoiler. All 4 paths must feel like the 4 most natural next moves from where the prose ends.
- Keep character updates compact but useful.

OUTPUT SHAPE (STRICT JSON):
{
  "title": "string",
  "prose": "string",
  "paths": ["string", "string", "string", "string"],
  "characters": [
    {
      "name": "string",
      "personality": "string",
      "role": "string",
      "purpose": {
        "main": "multi-step/emotional function across scenes",
        "subgoals": ["string", "string", "string"],
        "fulfilled": 0
      },
      "knownFacts": ["string"],
      "lastSpoken": { "line": "string" },
      "relationshipHistory": [
        { "event": "string", "impact": { "trust": 0, "affection": 0 } }
      ]
    }
  ],
  "summary": "string",
  "sceneTags": ["string"],
  "objectivesDelta": [
    { "add": "string" },
    { "complete": "string" },
    { "fail": "string" }
  ],
  "locationDelta": {
    "name": "string",
    "addTags": ["string"],
    "removeTags": ["string"]
  },
  "companionsDelta": [
    {
      "idOrName": "string",
      "say": "string",
      "history": [{ "event": "string", "impact": 1 }],
      "status": "active"
    }
  ],
  "arcDelta": { "tension": 0, "beat": 0, "chapter": 0 }
}`.trim();

  const user = `${worldBlock}

Companions (active):
${companionString}

Summary So Far:
${latestSummary}

Last Scene:
${latestProse}

Player's Latest Choice:
${latestChoice}

${phaseOutPromptExtras}

TASK:
${taskBlock}`.trim();

  return { system, user };
};

// Backward-compat alias
export const buildUnifiedPrompt = buildScenePrompt;

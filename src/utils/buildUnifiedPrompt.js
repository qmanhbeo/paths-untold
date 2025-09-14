// src/utils/buildUnifiedPrompt.js
import { injectPhaseOutLogicIntoPrompt } from './phaseOutManager';

/**
 * Build the LLM prompt with World/Arc state + compact companions
 * while keeping your existing JSON fields (title, story, choices, characters, summary).
 * Also asks for optional deltas: sceneTags, objectivesDelta, locationDelta, companionsDelta, arcDelta.
 *
 * @param {object} gameMemory
 * @param {string} latestChoice
 * @param {object|null} playerIntro
 */
export const buildUnifiedPrompt = (gameMemory, latestChoice, playerIntro = null) => {
  const {
    summary = [],
    story = [],
    companions = [],
    currentScene = 0,
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
  const latestScene = story.at(-1) || '';

  // Only list ACTIVE companions in the prompt (keeps context focused)
  const activeCompanions = (companions || []).filter(c => (c.status ?? 'active') === 'active');
  const companionString = activeCompanions.length > 0
    ? activeCompanions.map(c =>
        `- ${c.name}: ${c.personality || 'unknown'}, role: ${c.role || 'unknown'}`
      ).join('\n')
    : 'None yet';

  const phaseOutPromptExtras = injectPhaseOutLogicIntoPrompt(companions, currentScene);
  const isFirstScene = story.length === 0;

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

Open with a vivid, immersive introduction (show, don’t tell). The world should reveal itself through exploration, inspection, and dialogue — avoid exposition dumps.`
    : `Continue the story with strong pacing and emotional nuance.
Begin naturally by reflecting the player's last choice as dialogue or action.`;

  // We’ll always allow "title" in output; your UI only uses it once if not set.
  return `
You are the narrative engine for a branching story game. Write in clear, vivid prose.

${worldBlock}

Companions (active):
${companionString}

Summary So Far:
${latestSummary}

Last Scene:
${latestScene}

Player's Latest Choice:
${latestChoice}

${phaseOutPromptExtras}

TASK:
${taskBlock}

RULES:
- Return ONLY valid JSON (no markdown, no comments, no trailing commas).
- Scene length: ~200–350 words.
- Provide 4 distinct, meaningful choices that push different emotions/strategies.
- Keep character updates compact but useful.

OUTPUT SHAPE (STRICT JSON):
{
  "title": "string",
  "story": "string",
  "choices": ["string", "string", "string", "string"],
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
}
`.trim();
};

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
    sceneLog = [],
    companions = [],
    sceneIndex = 0,
    world = {
      clock: { day: 1, time: 'day' },
      location: { name: 'Unknown Place', tags: [] },
      sceneTags: [],
      objectives: [],
      flags: {}
    },
    arc = { chapter: 1, beat: 0, tension: 3, coreQuestion: '', activeThreads: [] }
  } = gameMemory;

  // Derive narrative phase from tension (0–10 scale)
  const tension = arc?.tension ?? 3;
  const arcPhase = tension <= 3 ? 'opening' : tension <= 7 ? 'pressure' : 'convergence';

  // Only list ACTIVE companions in the prompt (keeps context focused)
  const activeCompanions = (companions || []).filter(c => (c.status ?? 'active') === 'active');
  const companionString = activeCompanions.length > 0
    ? activeCompanions.map(c =>
        `- ${c.name}: ${c.personality || 'unknown'}, role: ${c.role || 'unknown'}`
      ).join('\n')
    : 'None yet';

  const phaseOutPromptExtras = injectPhaseOutLogicIntoPrompt(companions, sceneIndex);
  const isFirstScene = prose.length === 0;

  // Structured scene log — replaces raw prose as context.
  // Shows what concretely happened, what changed, and what was revealed (last 5 scenes).
  const recentLog = sceneLog.length > 0
    ? sceneLog.map(r =>
        [
          `Scene ${r.sceneIndex} | choice: "${r.playerChoice || '—'}"`,
          r.event      ? `  happened: ${r.event}` : null,
          r.stateChange ? `  changed: ${r.stateChange}` : null,
          r.reveals?.length ? `  revealed: ${r.reveals.join('; ')}` : null,
          r.resolvedThreads?.length ? `  resolved: ${r.resolvedThreads.join(', ')}` : null,
        ].filter(Boolean).join('\n')
      ).join('\n\n')
    : '(story just started)';

  const worldBlock = `
World:
- Location: ${world?.location?.name ?? 'Unknown Place'} [${(world?.location?.tags || []).join(', ')}]
- Time: Day ${world?.clock?.day ?? 1}, ${world?.clock?.time ?? 'day'}
- SceneTags: ${(world?.sceneTags || []).join(', ') || '—'}
- Objectives: ${(world?.objectives || []).map(o => `${o.status === 'active' ? '[•]' : '[ ]'} ${o.text}`).join(' | ') || '—'}
- Arc: Chapter ${arc?.chapter ?? 1}, Beat ${arc?.beat ?? 0}, Tension ${tension}/10, Phase: ${arcPhase}
- Core Question: ${arc?.coreQuestion || '(not yet established — set via arcDelta.coreQuestion on the first scene)'}
- Active Threads: ${(arc?.activeThreads || []).join(' | ') || '(none yet)'}
`.trim();

  const playerName = playerIntro?.playerName || '';

  const taskBlock = isFirstScene
    ? `Start a brand new story using the player's preferences:
- Genre: ${playerIntro?.selectedGenres?.join(', ') || 'unspecified'}
- Protagonist Role: ${playerIntro?.selectedProtagonists?.join(', ') || 'unspecified'}
- Gender: ${playerIntro?.selectedGender?.join(', ') || 'unspecified'}
- Tone: ${playerIntro?.selectedTone?.join(', ') || 'unspecified'}
- Setting: ${playerIntro?.selectedSetting?.join(', ') || 'unspecified'}

Open with a vivid, immersive introduction in second person ("you"). The world should reveal itself through exploration, inspection, and dialogue — avoid exposition dumps. Do not invent a name for the player character.`
    : `Continue the story. The player chose: "${latestChoice}".
Advance the plot — reflect the choice as a concrete consequence (dialogue, action, or revelation), not atmosphere.${playerName ? `\nThe protagonist's name is "${playerName}". Use it sparingly — only in NPC dialogue, direct address, or emotionally significant moments. Default narration stays second-person "you".` : ''}`;

  const system = `You are a state-driven narrative engine for a branching story game. Write in clear, vivid prose.

RULES:
- Return ONLY valid JSON (no markdown, no comments, no trailing commas).
- Scene length: ~200–350 words.
- SECOND PERSON ONLY. The protagonist is the player. Always narrate in second person ("you step", "you notice", "you feel") — never assign a proper name to the protagonist, never use third-person ("he", "she", "they", or any named character) for the player character. Other NPCs may have names. The player is always "you".
- CHOICE TEXT LAW — The scene may be poetic. The choice must be decisive. Write paths as immediate actions, stances, or value expressions — not as mini-scene summaries or atmospheric blurbs. Target 2–8 words; 12 at most. Strong verbs preferred. Do not include decorative prose, predicted consequences, or atmospheric padding — the scene body already carries that weight; choice text carries decision clarity only. Preserve distinctiveness between options by varying action/value/risk, not by adding more words. Good: "Ask what she remembers" / "Touch the edge" / "Wait for a sign" / "Tell her the truth" / "Walk away". Bad: "Turn toward the baker and invite them to read a memory aloud, inviting soft candor to mingle with lilac and bread scent."
- Paths MUST be rooted in the specific people, objects, and moments from the closing line of the prose. Never invent new locations or characters — only reference what already exists in the scene. Never describe an outcome or spoil a consequence.
- CHOICE DIRECTOR: Before writing paths, evaluate whether this scene warrants player input at all, and what form it should take. Types: "paths" = the player picks from concrete options (1–4, prefer 2–3 over 4); "threshold" = a binary fork between two mutually exclusive stances — use when the moment demands a commitment (stay/leave, confess/deny, accept/refuse); "freetext" = the player speaks in their own words — use when they are answering a direct question, confessing something, writing a message, or expressing themselves to another character (set choiceDirector.prompt to the in-world question/invitation, leave paths=[]); "none" = no input needed — use for atmosphere, consequence, and transition scenes. Set choiceDirector.needed=false for "none". Never manufacture options just to fill a grid.
- ARC PHASE: The story is currently in the "${arcPhase}" phase. Shape this scene accordingly:
  opening (tension 0–3): establish tone, introduce threads, keep stakes low and curiosity high. Choices should feel exploratory (2–4 paths). Tension should gently rise or hold.
  pressure (tension 4–7): escalate conflict, complicate relationships, force trade-offs. Choices should feel value-driven or binary (2–3 paths or threshold). At least one active thread should deepen.
  convergence (tension 8–10): move toward resolution or revelation. Reduce branching, increase inevitability. Choices should feel decisive and weighty (1–2 paths, threshold, or none). Threads should resolve.
  Every scene must either raise tension (arcDelta.tension: 1) or clarify the core question. Use arcDelta.tension: -1 only for earned relief after high-stakes moments.
  Use arcDelta.addThreads to introduce new narrative threads (keep total under 5), arcDelta.removeThreads to resolve or drop them.
  On the FIRST scene only (if coreQuestion is empty): set arcDelta.coreQuestion to the central dramatic question of this story — one sentence, framed as "Will you…" or "Can you…" or "What does it mean to…".
- PROGRESSION RULES — every scene must advance the story or it is filler:
  1. Introduce at least ONE concrete development: new information revealed, a relationship that shifts, a constraint added, or something that cannot be undone.
  2. Player choices MUST cause a state change — never offer paths that lead to identical outcomes.
  3. Do NOT re-describe the same atmosphere, location, or character that hasn't changed since the last scene.
  4. Do NOT repeat scene structure from recent scenes (pattern to avoid: description → companion mention → vague tension → choice with no consequence).
  5. At pressure phase: at least one active thread must deepen or shift meaningfully this scene.
  6. At convergence phase: force a decisive event — no more setup loops or ambiguous holds.
  7. sceneRecord.stateChange must describe something concrete that is now different. If nothing changed, rule 1 was violated.
- PLAYER IDENTITY: Do not ask for the player's name unless the scene creates a genuine narrative need — signing a document, being formally introduced, making a vow, giving testimony, being accused, or a relationship deepening to the point where a name is earned. If such a moment occurs AND the player name is unknown, set identityRequirement.required = true with a short in-world promptText (the NPC's exact words, written as spoken dialogue, not a game instruction). Do NOT trigger this in ordinary scenes or early in the story.
- Keep character updates compact but useful.

OUTPUT SHAPE (STRICT JSON):
{
  "title": "string",
  "prose": "string",
  "paths": ["string — 0 to 4 items; count must match choiceDirector.count; empty array [] when choiceDirector.type is 'none' or 'freetext'"],
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
  "arcDelta": {
    "tension": 0,
    "beat": 0,
    "chapter": 0,
    "coreQuestion": "",
    "addThreads": [],
    "removeThreads": []
  },
  "sceneRecord": {
    "event": "one sentence: what concretely happened this scene",
    "stateChange": "one sentence: what is now different in the world (not atmosphere — a real change)",
    "reveals": ["new information the player learned"],
    "resolvedThreads": ["thread names closed this scene"]
  },
  "choiceDirector": {
    "needed": true,
    "type": "paths | threshold | freetext | none",
    "tension": "one sentence: what is under pressure in this moment",
    "count": 4,
    "prompt": "for freetext only: the in-world question or invitation the player is responding to — empty string otherwise"
  },
  "identityRequirement": {
    "required": false,
    "reason": "signature | introduction | accusation | vow | record | recognition | emotional | other",
    "promptText": "the NPC's exact spoken words creating the name moment — empty string if required is false"
  }
}`.trim();

  const user = `${worldBlock}

Companions (active):
${companionString}

Scene Log (last ${sceneLog.length || 0} scenes):
${recentLog}

Player's Choice:
${latestChoice || '(story begins)'}

${phaseOutPromptExtras}

TASK:
${taskBlock}`.trim();

  return { system, user };
};

// Backward-compat alias
export const buildUnifiedPrompt = buildScenePrompt;

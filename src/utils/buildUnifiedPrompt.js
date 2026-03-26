// src/utils/buildUnifiedPrompt.js
import { injectPhaseOutLogicIntoPrompt } from './phaseOutManager';
import {
  getCurrentArcNode,
  getCurrentChapterNode,
  getCurrentSceneWaveRole,
  blueprintEffectiveMode,
  deriveTemplateFamily,
} from './storyBlueprintPlanner';

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
    arc = { chapter: 1, beat: 0, tension: 3, coreQuestion: '', activeThreads: [], arcPlan: null, chapterPlan: null }
  } = gameMemory;

  const isFirstScene = prose.length === 0;

  // ── Tension mode (from numeric tension 0–10) ───────────────────────────────
  const tension = arc?.tension ?? 3;
  const tensionMode =
    tension <= 2 ? 'quiet'
    : tension <= 4 ? 'unease'
    : tension <= 6 ? 'pressure'
    : tension <= 8 ? 'breaking_point'
    : 'catastrophe';

  // ── Story Blueprint (new) vs legacy ArcPlan/ChapterPlan (fallback) ─────────
  const storyBlueprint = arc?.storyBlueprint ?? null;
  const blueprintArcNode     = getCurrentArcNode(storyBlueprint);
  const blueprintChapterNode = getCurrentChapterNode(storyBlueprint);
  const sceneWaveRole        = getCurrentSceneWaveRole(storyBlueprint);

  // ── Legacy arc / chapter stage (used when no blueprint) ───────────────────
  const arcPlan = arc?.arcPlan ?? null;
  const arcStage = arcPlan
    ? (arcPlan.arcStageSequence[arcPlan.currentStageIndex] ?? 'open')
    : null;

  const chapterPlan = arc?.chapterPlan ?? null;
  const chapterStage = chapterPlan
    ? (chapterPlan.chapterStageSequence[chapterPlan.currentStageIndex] ?? 'open')
    : null;

  // ── Effective mode ─────────────────────────────────────────────────────────
  // Blueprint takes priority: scene waveRole → effective prompt mode.
  // Fallback to legacy tension/chapter-stage logic when no blueprint.
  let effectiveMode;
  if (storyBlueprint && sceneWaveRole) {
    effectiveMode = blueprintEffectiveMode(sceneWaveRole, blueprintChapterNode?.targets ?? null);
  } else {
    const isCooldown = chapterStage === 'cooldown';
    const recentStall = sceneLog.length >= 2 &&
      sceneLog.slice(-2).every(r => (r.resolvedThreads?.length ?? 0) === 0 && r.stateChange === '');
    const isResolutionMode = !isFirstScene && !isCooldown && (
      chapterStage === 'resolve' ||
      (tension >= 9 && recentStall)
    );
    effectiveMode = isCooldown ? 'cooldown' : isResolutionMode ? 'resolution' : tensionMode;
  }

  // ── Companions ─────────────────────────────────────────────────────────────
  const activeCompanions = (companions || []).filter(c => (c.status ?? 'active') === 'active');
  const companionString = activeCompanions.length > 0
    ? activeCompanions.map(c =>
        `- ${c.name}: ${c.personality || 'unknown'}, role: ${c.role || 'unknown'}`
      ).join('\n')
    : 'None yet';

  const phaseOutPromptExtras = injectPhaseOutLogicIntoPrompt(companions, sceneIndex);

  // ── Scene log ──────────────────────────────────────────────────────────────
  const recentLog = sceneLog.length > 0
    ? sceneLog.map(r =>
        [
          `Scene ${r.sceneIndex} | choice: "${r.playerChoice || '—'}"`,
          r.event       ? `  happened: ${r.event}` : null,
          r.stateChange ? `  changed: ${r.stateChange}` : null,
          r.reveals?.length ? `  revealed: ${r.reveals.join('; ')}` : null,
          r.resolvedThreads?.length ? `  resolved: ${r.resolvedThreads.join(', ')}` : null,
        ].filter(Boolean).join('\n')
      ).join('\n\n')
    : '(story just started)';

  // ── World block (injected into user message) ───────────────────────────────

  // Position labels — prefer blueprint, fall back to legacy plan labels
  let arcStageLabel, chapterStageLabel, planBlock;
  if (storyBlueprint && blueprintArcNode && blueprintChapterNode) {
    const sceneIdx = blueprintChapterNode.currentSceneIndex;
    const sceneTotal = blueprintChapterNode.sceneWave.length;
    const chIdx = blueprintArcNode.currentChapterIndex;
    const chTotal = blueprintArcNode.chapters.length;
    const arcIdx = storyBlueprint.currentArcIndex;
    const arcTotal = storyBlueprint.arcs.length;
    const templateFamily = deriveTemplateFamily(sceneWaveRole, blueprintChapterNode.waveRole);
    const tgt = blueprintChapterNode.targets;

    arcStageLabel = `${blueprintArcNode.waveRole} [arc ${arcIdx + 1}/${arcTotal}]`;
    chapterStageLabel = `${blueprintChapterNode.waveRole} [ch ${chIdx + 1}/${chTotal}]`;

    planBlock = `
Blueprint Position:
- Arc: ${arcStageLabel} — ${blueprintArcNode.purpose || '—'}
- Chapter: ${chapterStageLabel} — ${blueprintChapterNode.purpose || '—'}
- Scene: ${sceneWaveRole} [scene ${sceneIdx + 1}/${sceneTotal}] | template: ${templateFamily}
- Must Resolve: ${blueprintChapterNode.mustResolve || '—'}
- Core Question: ${storyBlueprint.coreQuestion || '—'}
- Targets: tension ${tgt.tension}/10, intimacy ${tgt.intimacy}/10, mystery ${tgt.mystery}/10, pacing: ${tgt.pacing}, choice harshness: ${tgt.choiceHarshness}/10`.trim();
  } else {
    arcStageLabel = arcStage
      ? `${arcStage}${arcPlan ? ` [arc ${arcPlan.currentStageIndex + 1}/${arcPlan.arcStageSequence.length}]` : ''}`
      : '(planning)';
    chapterStageLabel = chapterStage
      ? `${chapterStage}${chapterPlan ? ` [ch ${chapterPlan.currentStageIndex + 1}/${chapterPlan.chapterStageSequence.length}]` : ''}`
      : '(planning)';
    planBlock = chapterPlan
      ? `Chapter Plan:\n- Goal: ${chapterPlan.chapterGoal || '—'}\n- Must Resolve: ${chapterPlan.mustResolve || '—'}\n- Must Advance: ${chapterPlan.mustAdvanceArcThread || '—'}\n- Completion Condition: ${chapterPlan.chapterCompletionCondition || '—'}`
      : '- Chapter Plan: (being established)';
  }

  const worldBlock = `
World:
- Location: ${world?.location?.name ?? 'Unknown Place'} [${(world?.location?.tags || []).join(', ')}]
- Time: Day ${world?.clock?.day ?? 1}, ${world?.clock?.time ?? 'day'}
- SceneTags: ${(world?.sceneTags || []).join(', ') || '—'}
- Objectives: ${(world?.objectives || []).map(o => `${o.status === 'active' ? '[•]' : '[ ]'} ${o.text}`).join(' | ') || '—'}
- Arc: Chapter ${arc?.chapter ?? 1}, Beat ${arc?.beat ?? 0}, Tension ${tension}/10, Mode: ${effectiveMode}
${storyBlueprint ? '' : `- Arc Stage: ${arcStageLabel} | Chapter Stage: ${chapterStageLabel}
`}- Core Question: ${arc?.coreQuestion || storyBlueprint?.coreQuestion || '(not yet established)'}
- Active Threads: ${(arc?.activeThreads || []).join(' | ') || '(none yet)'}
${planBlock}
`.trim();

  // ── Task block ─────────────────────────────────────────────────────────────
  const playerName = playerIntro?.playerName || '';

  const taskBlock = isFirstScene
    ? `OPENING SCENE — write the very first moment of this story.

Player setup:
- Genre: ${playerIntro?.selectedGenres?.join(', ') || 'unspecified'}
- Protagonist: ${playerIntro?.selectedProtagonists?.join(', ') || 'unspecified'}
- Gender: ${playerIntro?.selectedGender?.join(', ') || 'unspecified'}
- Tone: ${playerIntro?.selectedTone?.join(', ') || 'unspecified'}
- Setting: ${playerIntro?.selectedSetting?.join(', ') || 'unspecified'}

OPENING RULES (all mandatory):

GROUNDING — the first sentence must tell the player exactly where they are (a specific, named place type — e.g. "a narrow shop", "a crossroads at dusk", "the back of a moving cart"). Mention 2–3 physical elements that logically belong there. State clearly whether the player is indoors or outdoors.

COHERENCE — every element in the scene must belong to the same place. No disconnected objects. No unexplained symbols. No surreal juxtapositions.

SITUATION — something is happening right now, not vaguely. A person is approaching. A sound just started. A door is open when it shouldn't be. One concrete event, simple and understandable.

CHOICES — present 2–3 options. Each must be a physical action the player can take immediately based only on what was described. No guessing. No abstract options.
  Good: "Open the door" / "Call out to the figure" / "Back away quietly"
  Bad: "Inspect something unknown" / "Question the silence" / "Follow the mystery"

LENGTH — 80–120 words maximum. 2–3 paragraphs, ≤ 2 sentences each. Do not name the player character.`
    : `Continue. Player chose: "${latestChoice}".
Show the consequence immediately — action, dialogue, or revelation. No atmospheric preamble. Something must change. Max 120 words.${playerName ? `\nProtagonist name: "${playerName}" — use only in NPC dialogue or direct address. Narration stays second-person.` : ''}`;

  // ── System prompt ──────────────────────────────────────────────────────────
  let arcDirectionBlock;
  if (storyBlueprint && blueprintArcNode && blueprintChapterNode) {
    const tgt = blueprintChapterNode.targets;
    arcDirectionBlock = `
  Story Blueprint is active. Follow the pre-planned wave structure — do not re-invent the macro shape.
  Arc: ${blueprintArcNode.waveRole} — ${blueprintArcNode.purpose || '—'} (focus: ${blueprintArcNode.focusAxis || '—'})
  Chapter: ${blueprintChapterNode.waveRole} — ${blueprintChapterNode.purpose || '—'}
  Scene wave role: ${sceneWaveRole} — shape this scene to match that role exactly.
  Must Resolve this chapter: ${blueprintChapterNode.mustResolve || '—'}
  Core Question: ${storyBlueprint.coreQuestion || '—'}
  Chapter targets: tension ${tgt.tension}/10, intimacy ${tgt.intimacy}/10, pacing ${tgt.pacing}.
  This scene must serve the wave role. Do NOT invent new structural arcs or sub-planners.
  On the first scene: set arcDelta.coreQuestion to the blueprint's core question. Introduce narrative threads via arcDelta.addThreads.`;
  } else if (chapterPlan) {
    arcDirectionBlock = `
  Arc Stage: ${arcStageLabel}${arcPlan ? `\n  Arc Goal: ${arcPlan.arcGoal}\n  Arc Theme: ${arcPlan.arcTheme}` : ''}
  Chapter Stage: ${chapterStageLabel}
  Chapter Goal: ${chapterPlan.chapterGoal || '—'}
  Must Resolve: ${chapterPlan.mustResolve || '—'}
  Must Advance: ${chapterPlan.mustAdvanceArcThread || '—'}
  Chapter Completion Condition: ${chapterPlan.chapterCompletionCondition || '—'}
  This scene must either deepen the must-resolve tension OR push toward the chapter completion condition.
  If chapter completion is reached, set arcDelta.advanceChapterStage: true to move to the next stage.
  If the arc resolution condition is met, set arcDelta.advanceArcStage: true.`;
  } else {
    arcDirectionBlock = `
  No chapter plan yet. On the first scene: set arcDelta.coreQuestion to the central dramatic question of this story ("Will you…" / "Can you…" / "What does it mean to…"). Introduce one or two narrative threads via arcDelta.addThreads.`;
  }

  const system = `You are a state-driven narrative engine for a branching story game. Write like a game, not a novel — direct, clear, fast.

RULES:
- Return ONLY valid JSON (no markdown, no comments, no trailing commas).
- SCENE LENGTH: hard maximum 120 words. 2–3 short paragraphs, each ≤ 2 sentences. Reach the decision point fast — no long descriptive buildup.
- SCENE STRUCTURE: within those 2–3 paragraphs follow a mini arc — ¶1: ground the moment (where, who, what's surface-visible); ¶2: something shifts or is revealed (pressure, contradiction, new information); ¶3: reach the decision point. Keep it implicit and natural, not mechanical.
- STYLE: simple and direct. Minimal metaphors. Every sentence must either move the situation forward or give the player information they need to choose. Do not linger. Do not repeat what the last scene already established.
- SECOND PERSON ONLY. The protagonist is "you" — always. Other NPCs may have names. Never use third-person ("he", "she", "they") for the player character.
- CHOICE TEXT LAW — Choices are verbs, not blurbs. 2–8 words. Immediate action, stance, or value. No decorative prose, no outcome descriptions. Each option must be clearly distinct. Good: "Ask what she remembers" / "Touch the edge" / "Walk away". Bad: "Turn toward the baker and invite them to read a memory aloud, inviting soft candor to mingle with lilac and bread scent."
- Paths MUST be rooted in the specific people, objects, and moments from the closing line of the prose. Never invent new locations or characters. Never spoil a consequence.
- CHOICE DIRECTOR: Before writing paths, evaluate whether this scene warrants player input at all. Types: "paths" = concrete options (1–4, prefer 2–3); "threshold" = binary commitment (stay/leave, confess/deny, accept/refuse); "freetext" = player speaks in their own words — for answering a direct question, confessing, writing a message (set choiceDirector.prompt to the in-world question, leave paths=[]); "none" = no input needed — atmosphere, consequence, transition. Set choiceDirector.needed=false for "none". Never manufacture options just to fill a grid.
- TENSION MODE: This scene is in "${effectiveMode}" mode. Shape the scene accordingly:
  quiet: establish world and tone, introduce one thread gently. Conflict minimal. Something is noticed but not confronted.
  unease: introduce friction or wrongness. No explosion — the feeling that something is off. One thing becomes uncertain.
  pressure: escalate. Force a trade-off, reveal something unwelcome, or complicate a relationship. The player must respond to something real.
  breaking_point: irreversible. This scene demands a major decision or commitment. The player cannot stay neutral. Choices: threshold or 1–2 weighted paths.
  catastrophe: maximum consequence. Something fails, collapses, or is lost. The story will not recover easily from this. Choices: none or threshold only.
  resolution: PAYOFF. The story has earned this. Do NOT introduce new clues, threads, or mysteries. Do NOT stall or escalate further. You MUST do at least one of: reveal a key truth, confront a character directly, force a decisive and irreversible choice, or close a major thread. The situation must change permanently. Choices lead to outcomes, not investigation. Good: "Confront them" / "Accept the deal" / "Destroy the evidence" / "Walk away for good". Bad: "Inspect further" / "Look around" / "Follow another lead". Set arcDelta.advanceChapterStage: true if chapter completion condition is met.
  cooldown: decompression. The chapter's core conflict just closed. Breathe — let consequences land quietly. Establish new normal. No new conflicts, no escalation. Reflect on what was lost or gained. Choices: simple preference (where to go, who to talk to). Tension direction: drop (-1). Prepare threads for the next chapter.
  - Tension direction: raise (+1) at quiet/unease/pressure; hold (0) or raise at breaking_point; drop (-1) only for earned relief after catastrophe, resolution, or cooldown.
- ARC DIRECTION:${arcDirectionBlock}
- PROGRESSION RULES — every scene must advance the story or it is filler:
  1. Introduce at least ONE concrete development: new information, a relationship that shifts, a constraint added, or something irreversible.
  2. Player choices MUST cause state changes — never offer paths with identical outcomes.
  3. Do NOT re-describe unchanged atmosphere, location, or companions.
  4. Do NOT repeat recent scene structure (avoid: description → companion mention → vague tension → choice with no consequence).
  5. At pressure/breaking_point: at least one active thread must deepen or shift.
  6. At catastrophe: force a consequence — no more setup or ambiguous holds.
  7. sceneRecord.stateChange must describe something concrete. If nothing changed, rule 1 was violated.
- PLAYER IDENTITY: Do not ask for the player's name unless the scene creates a genuine narrative need — signing a document, being formally introduced, making a vow, giving testimony, being accused, or a relationship deepening to the point where a name is earned. If such a moment occurs AND the player name is unknown, set identityRequirement.required = true with a short in-world promptText (the NPC's exact words, as spoken dialogue). Do NOT trigger this in ordinary scenes or early in the story.
- Keep character updates compact but useful.

OUTPUT SHAPE (STRICT JSON):
{
  "title": "string",
  "prose": "string",
  "paths": ["string — 0 to 4 items; count must match choiceDirector.count; empty array [] when type is 'none' or 'freetext'"],
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
    "removeThreads": [],
    "completedBeat": "",
    "advanceArc": false,
    "advanceChapterStage": false,
    "advanceArcStage": false
  },
  "sceneRecord": {
    "event": "one sentence: what concretely happened this scene",
    "stateChange": "one sentence: what is now different in the world (a real change, not atmosphere)",
    "reveals": ["new information the player learned"],
    "resolvedThreads": ["thread names closed this scene"]
  },
  "choiceDirector": {
    "needed": true,
    "type": "paths | threshold | freetext | none",
    "tension": "one sentence: what is under pressure in this moment",
    "count": 2,
    "prompt": "for freetext only: the in-world question or invitation — empty string otherwise"
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

Scene Log (last ${sceneLog.length} scenes):
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

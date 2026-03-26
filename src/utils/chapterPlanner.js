// src/utils/chapterPlanner.js
//
// Two planning functions:
//   planArc()     — runs ONCE at story start; generates macro ArcPlan spanning all chapters
//   planChapter() — runs once per chapter (before first scene); generates micro ChapterPlan

const PLANNER_SYSTEM = `You are a narrative architect for an interactive story game. Return ONLY valid JSON — no markdown, no comments, no trailing commas.`;

// ─── Arc planner ────────────────────────────────────────────────────────────

function buildArcPlannerPrompt(playerIntro, storyBlueprint) {
  const blueprintBlock = storyBlueprint
    ? `\nStory Blueprint (the philosophical core this arc must serve):
- Core Question: ${storyBlueprint.coreQuestion}
- Tension Axes: ${storyBlueprint.tensionAxes.map(a => `${a.left} ↔ ${a.right}`).join(' | ')}
- World Ethos: ${storyBlueprint.storyIdentity.worldEthos}
- Choice Ethos: ${storyBlueprint.storyIdentity.choiceEthos}
${storyBlueprint.arcPrinciples.length ? `- Arc Principles: ${storyBlueprint.arcPrinciples.join('; ')}` : ''}
- True Resolution: ${storyBlueprint.endingLogic.ideal}

This arc must stress at least one tension axis, serve the core question, and follow the arc principles.`
    : '';

  return `Player setup:
- Genre: ${playerIntro?.selectedGenres?.join(', ') || 'unspecified'}
- Protagonist: ${playerIntro?.selectedProtagonists?.join(', ') || 'unspecified'}
- Tone: ${playerIntro?.selectedTone?.join(', ') || 'unspecified'}
- Setting: ${playerIntro?.selectedSetting?.join(', ') || 'unspecified'}
${blueprintBlock}

Design the macro arc for this story. This structure spans multiple chapters and gives the whole story its shape.

OUTPUT (strict JSON):
{
  "arcGoal": "what the full story ultimately achieves or confronts — concrete, not thematic",
  "arcTheme": "one sentence: the core theme (identity, belonging, power, cost of survival, etc.)",
  "arcQuestion": "the central dramatic question — 'Will you…' / 'Can you…' / 'What does it cost to…'",
  "arcStageSequence": ["open", "build", "build", "peak", "resolve"],
  "arcResolutionCondition": "specific observable outcome that closes the full story arc",
  "currentStageIndex": 0
}

Rules:
- arcStageSequence: 3–6 entries drawn from [open, build, peak, resolve]. Must start with "open", end with "resolve".
- arcGoal must be a thing to be achieved, revealed, or decided — not a vague theme.
- arcResolutionCondition must be specific and observable (a concrete event, not a feeling).`;
}

function normalizeArcPlan(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const valid = ['open', 'build', 'peak', 'resolve'];
  const seq = Array.isArray(raw.arcStageSequence)
    ? raw.arcStageSequence.filter(s => valid.includes(s))
    : ['open', 'build', 'peak', 'resolve'];
  if (seq.length < 2) return null;
  return {
    arcGoal: typeof raw.arcGoal === 'string' ? raw.arcGoal.trim() : '',
    arcTheme: typeof raw.arcTheme === 'string' ? raw.arcTheme.trim() : '',
    arcQuestion: typeof raw.arcQuestion === 'string' ? raw.arcQuestion.trim() : '',
    arcStageSequence: seq,
    arcResolutionCondition: typeof raw.arcResolutionCondition === 'string' ? raw.arcResolutionCondition.trim() : '',
    currentStageIndex: 0,
  };
}

/**
 * Run the arc planner LLM call once at story start and return a normalized ArcPlan.
 * Returns null on failure (story proceeds without a macro arc plan).
 *
 * @param {object} playerIntro - storyOptions
 * @param {Function} generateFn - generateScene from AI-chat (accepts messages array)
 * @param {import('../state/types').StoryBlueprint|null} storyBlueprint - optional philosophical frame
 * @returns {Promise<import('../state/types').ArcPlan|null>}
 */
export async function planArc(playerIntro, generateFn, storyBlueprint = null) {
  try {
    const user = buildArcPlannerPrompt(playerIntro, storyBlueprint);
    const raw = await generateFn([
      { role: 'system', content: PLANNER_SYSTEM },
      { role: 'user', content: user },
    ]);
    const content = raw?.choices?.[0]?.message?.content
      ?? raw?.message?.content
      ?? raw?.content
      ?? (typeof raw === 'string' ? raw : null);
    if (!content) return null;
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    return normalizeArcPlan(JSON.parse(text.trim()));
  } catch (e) {
    console.error('[planArc] failed — proceeding without arc plan', e);
    return null;
  }
}

// ─── Chapter planner ─────────────────────────────────────────────────────────

/**
 * Build { system, user } for the chapter planner LLM call.
 * @param {object} playerIntro
 * @param {object} arc - current arc state (may include arcPlan)
 * @param {import('../state/types').StoryBlueprint|null} storyBlueprint
 */
export function buildPlannerPrompt(playerIntro, arc, storyBlueprint = null) {
  const chapter = arc?.chapter ?? 1;
  const arcPlan = arc?.arcPlan ?? null;
  const arcStage = arcPlan
    ? (arcPlan.arcStageSequence[arcPlan.currentStageIndex] ?? 'open')
    : 'open';
  const coreQuestion = arc?.coreQuestion || arcPlan?.arcQuestion || storyBlueprint?.coreQuestion || '';

  const blueprintBlock = storyBlueprint
    ? `\nStory Blueprint:
- Core Question: ${storyBlueprint.coreQuestion}
- Primary Tension: ${storyBlueprint.tensionAxes[0] ? `${storyBlueprint.tensionAxes[0].left} ↔ ${storyBlueprint.tensionAxes[0].right}` : '—'}
- World Ethos: ${storyBlueprint.storyIdentity.worldEthos}
- Choice Ethos: ${storyBlueprint.storyIdentity.choiceEthos}
${storyBlueprint.arcPrinciples.length ? `- Arc Principles: ${storyBlueprint.arcPrinciples.join('; ')}` : ''}`
    : '';

  const user = `Player setup:
- Genre: ${playerIntro?.selectedGenres?.join(', ') || 'unspecified'}
- Protagonist: ${playerIntro?.selectedProtagonists?.join(', ') || 'unspecified'}
- Tone: ${playerIntro?.selectedTone?.join(', ') || 'unspecified'}
- Setting: ${playerIntro?.selectedSetting?.join(', ') || 'unspecified'}
${coreQuestion ? `- Core Question: ${coreQuestion}` : ''}
${arcPlan ? `- Arc Goal: ${arcPlan.arcGoal}
- Arc Theme: ${arcPlan.arcTheme}
- Arc Stage: ${arcStage} (stage ${arcPlan.currentStageIndex + 1} of ${arcPlan.arcStageSequence.length})` : ''}
${blueprintBlock}

Plan Chapter ${chapter} of this story.

OUTPUT (strict JSON):
{
  "chapterGoal": "what this chapter achieves or reveals within the arc — concrete, not thematic",
  "chapterStageSequence": ["open", "build", "resolve", "cooldown"],
  "mustResolve": "the specific conflict or tension that must close by chapter's end",
  "mustAdvanceArcThread": "which arc thread this chapter must push forward",
  "chapterCompletionCondition": "specific observable outcome that closes this chapter",
  "currentStageIndex": 0,
  "completedBeats": []
}

Rules:
- chapterStageSequence: 3–5 entries from [open, build, resolve, cooldown]. Must end with "cooldown".
- chapterGoal must be concrete (a thing to be done, revealed, or decided — not a theme).
- mustResolve must name a specific conflict or tension (not a vague feeling).
- chapterCompletionCondition must be specific and observable.`;

  return { system: PLANNER_SYSTEM, user };
}

function normalizeChapterPlan(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const valid = ['open', 'build', 'resolve', 'cooldown'];
  const seq = Array.isArray(raw.chapterStageSequence)
    ? raw.chapterStageSequence.filter(s => valid.includes(s))
    : ['open', 'build', 'resolve', 'cooldown'];
  if (seq.length < 2) return null;
  return {
    chapterGoal: typeof raw.chapterGoal === 'string' ? raw.chapterGoal.trim() : '',
    chapterStageSequence: seq,
    mustResolve: typeof raw.mustResolve === 'string' ? raw.mustResolve.trim() : '',
    mustAdvanceArcThread: typeof raw.mustAdvanceArcThread === 'string' ? raw.mustAdvanceArcThread.trim() : '',
    chapterCompletionCondition: typeof raw.chapterCompletionCondition === 'string' ? raw.chapterCompletionCondition.trim() : '',
    currentStageIndex: 0,
    completedBeats: [],
  };
}

/**
 * Run the chapter planner LLM call and return a normalized ChapterPlan.
 * Returns null on failure (scene generation proceeds without a plan).
 *
 * @param {object} playerIntro - storyOptions
 * @param {object} arc - current arc state
 * @param {Function} generateFn - generateScene from AI-chat (accepts messages array)
 * @param {import('../state/types').StoryBlueprint|null} storyBlueprint - optional philosophical frame
 * @returns {Promise<import('../state/types').ChapterPlan|null>}
 */
export async function planChapter(playerIntro, arc, generateFn, storyBlueprint = null) {
  try {
    const { system, user } = buildPlannerPrompt(playerIntro, arc, storyBlueprint);
    const raw = await generateFn([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);
    const content = raw?.choices?.[0]?.message?.content
      ?? raw?.message?.content
      ?? raw?.content
      ?? (typeof raw === 'string' ? raw : null);
    if (!content) return null;
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    return normalizeChapterPlan(JSON.parse(text.trim()));
  } catch (e) {
    console.error('[planChapter] failed — proceeding without chapter plan', e);
    return null;
  }
}

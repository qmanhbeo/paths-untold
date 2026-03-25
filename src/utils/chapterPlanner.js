// src/utils/chapterPlanner.js
//
// Runs once per chapter (before the first scene) to establish a structured arc plan.
// The plan gives scene generation a gravitational field: concrete beats, an arc goal,
// a lesson, and a resolution condition — so scenes build toward something.

const PLANNER_SYSTEM = `You are a narrative architect for an interactive story game. Return ONLY valid JSON — no markdown, no comments, no trailing commas.`;

/**
 * Build { system, user } for the chapter planner LLM call.
 * @param {object} playerIntro - storyOptions (genre, tone, setting, etc.)
 * @param {object} arc - current arc state
 */
export function buildPlannerPrompt(playerIntro, arc) {
  const chapter = arc?.chapter ?? 1;
  const coreQuestion = arc?.coreQuestion || '';

  const user = `Player setup:
- Genre: ${playerIntro?.selectedGenres?.join(', ') || 'unspecified'}
- Protagonist: ${playerIntro?.selectedProtagonists?.join(', ') || 'unspecified'}
- Tone: ${playerIntro?.selectedTone?.join(', ') || 'unspecified'}
- Setting: ${playerIntro?.selectedSetting?.join(', ') || 'unspecified'}
${coreQuestion ? `- Core Question: ${coreQuestion}` : ''}

Plan Chapter ${chapter} of this story.

OUTPUT (strict JSON):
{
  "chapterTheme": "one sentence: what this chapter is fundamentally about",
  "arcs": [
    {
      "arcGoal": "what must be achieved or confronted in this arc",
      "lesson": "what the player is forced to face or understand",
      "tensionModes": ["quiet", "unease", "pressure", "breaking_point"],
      "requiredBeats": ["concrete event 1", "concrete event 2", "concrete event 3"],
      "resolutionCondition": "specific observable outcome that closes this arc"
    }
  ],
  "currentArcIndex": 0,
  "completedBeats": []
}

Rules:
- 2–4 arcs per chapter.
- Each arc must have 2–4 requiredBeats. Beats must be concrete events (not abstract themes): things that happen, are revealed, or are decided.
- tensionModes must be a rising sequence from: quiet, unease, pressure, breaking_point, catastrophe.
- resolutionCondition must be specific and observable — a thing that happens, not a feeling.`;

  return { system: PLANNER_SYSTEM, user };
}

/**
 * Run the chapter planner LLM call and return a normalized ChapterPlan.
 * Returns null on failure (scene generation proceeds without a plan).
 *
 * @param {object} playerIntro - storyOptions
 * @param {object} arc - current arc state
 * @param {Function} generateFn - generateScene from AI-chat (accepts messages array, returns promise)
 */
export async function planChapter(playerIntro, arc, generateFn) {
  try {
    const { system, user } = buildPlannerPrompt(playerIntro, arc);
    const raw = await generateFn([
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]);

    // Normalize the response shape (llmChat returns various shapes)
    const content = raw?.choices?.[0]?.message?.content
      ?? raw?.message?.content
      ?? raw?.content
      ?? (typeof raw === 'string' ? raw : null);

    if (!content) return null;

    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const parsed = JSON.parse(text.trim());
    return normalizePlan(parsed);
  } catch (e) {
    console.error('[planChapter] failed — proceeding without chapter plan', e);
    return null;
  }
}

function normalizePlan(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const arcs = Array.isArray(raw.arcs)
    ? raw.arcs.map(a => ({
        arcGoal: typeof a.arcGoal === 'string' ? a.arcGoal.trim() : '',
        lesson: typeof a.lesson === 'string' ? a.lesson.trim() : '',
        tensionModes: Array.isArray(a.tensionModes) ? a.tensionModes.filter(m => typeof m === 'string') : ['quiet', 'pressure'],
        requiredBeats: Array.isArray(a.requiredBeats) ? a.requiredBeats.filter(b => typeof b === 'string').map(b => b.trim()) : [],
        resolutionCondition: typeof a.resolutionCondition === 'string' ? a.resolutionCondition.trim() : ''
      }))
    : [];

  if (arcs.length === 0) return null;

  return {
    chapterTheme: typeof raw.chapterTheme === 'string' ? raw.chapterTheme.trim() : '',
    arcs,
    currentArcIndex: Number.isInteger(raw.currentArcIndex) && raw.currentArcIndex >= 0 ? raw.currentArcIndex : 0,
    completedBeats: Array.isArray(raw.completedBeats) ? raw.completedBeats.filter(b => typeof b === 'string') : []
  };
}

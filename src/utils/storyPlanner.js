// src/utils/storyPlanner.js
//
// Story Planner — the top layer of the planning hierarchy.
// Runs ONCE before arc planning. Produces a StoryBlueprint: the philosophical
// spine that all arcs, chapters, and scenes should serve.
//
// Hierarchy:
//   storyPlanner  →  planArc  →  planChapter  →  NarrativeMaster  →  scene
//   (meaning)        (direction)  (events)         (scene pressure)   (prose)

const PLANNER_SYSTEM = `You are a narrative architect for an interactive story game. Return ONLY valid JSON — no markdown, no comments, no trailing commas.`;

// ── Prompt ────────────────────────────────────────────────────────────────────

function describeNarrativeSetting(key, val) {
  if (val === null || val === undefined) return null;
  const maps = {
    pacing: { slow: 'deliberate', medium: 'balanced', fast: 'driven' },
    emotionalIntensity: v => v >= 4 ? 'intense' : v <= 2 ? 'gentle' : 'moderate',
    mysteryLevel: v => v >= 4 ? 'cryptic' : v <= 2 ? 'clear' : 'layered',
    romanceSoftness: v => v >= 4 ? 'romance-forward' : v <= 2 ? 'minimal' : 'moderate',
    choiceHarshness: v => v >= 4 ? 'unforgiving' : v <= 2 ? 'forgiving' : 'balanced',
    introspectionLevel: v => v >= 4 ? 'introspective' : v <= 2 ? 'action-focused' : 'balanced',
    ambiguityTolerance: v => v >= 4 ? 'open-ended' : v <= 2 ? 'resolved' : 'balanced',
    convergenceSharpness: v => v >= 4 ? 'sharp endings' : v <= 2 ? 'gradual' : 'balanced',
  };
  const m = maps[key];
  if (!m) return null;
  const label = typeof m === 'function' ? m(val) : (m[val] ?? null);
  if (!label) return null;
  return `- ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${label}`;
}

function buildStoryPlannerPrompt(playerIntro) {
  const settingKeys = ['pacing','emotionalIntensity','mysteryLevel','romanceSoftness',
                       'choiceHarshness','introspectionLevel','ambiguityTolerance','convergenceSharpness'];
  const settingsLines = settingKeys
    .map(k => describeNarrativeSetting(k, playerIntro?.[k]))
    .filter(Boolean)
    .join('\n');

  return `Player setup:
- Genre: ${playerIntro?.selectedGenres?.join(', ') || 'unspecified'}
- Protagonist: ${playerIntro?.selectedProtagonists?.join(', ') || 'unspecified'}
- Tone: ${playerIntro?.selectedTone?.join(', ') || 'unspecified'}
- Setting: ${playerIntro?.selectedSetting?.join(', ') || 'unspecified'}
${settingsLines ? `\nNarrative preferences:\n${settingsLines}` : ''}

Design the story blueprint — the philosophical core that every arc, chapter, and scene should serve.
This is structural, not prose. Define the tensions, identity, and laws this story operates under.

OUTPUT (strict JSON):
{
  "coreQuestion": "the central question the whole story wrestles with — 'Can you…' / 'What does it cost to…'. Must be answerable yes/no but not obviously so from the setup.",
  "tensionAxes": [
    { "id": "short_id", "left": "one pole", "right": "opposing pole" }
  ],
  "storyIdentity": {
    "dominantTone": "the single most defining emotional register of this story",
    "worldEthos": "one sentence: the emotional or moral logic this world operates by",
    "choiceEthos": "one sentence: what it means to choose in this world — the shape and cost of decisions"
  },
  "arcPrinciples": [
    "a design rule each arc should follow — specific to this story, not generic writing advice"
  ],
  "endingLogic": {
    "ideal": "what counts as genuine resolution in this story — specific and observable",
    "failure": "what counts as defeat or hollow compromise — specific and observable"
  }
}

Rules:
- tensionAxes: exactly 2–3. Each is a real felt opposition. Use brief, sharp labels (e.g. "Freedom" / "Belonging").
- arcPrinciples: 2–4 rules grounded in this story's genre, tone, and player preferences.
- coreQuestion must reflect the tension axes and be genuinely unresolved by the premise.
- All fields must be specific to this story — not generic narrative advice.`;
}

// ── Normalization ─────────────────────────────────────────────────────────────

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '').slice(0, 30);
}

/**
 * Normalize and validate a raw LLM response into a StoryBlueprint.
 * Returns null if the response is too malformed to use.
 *
 * @param {object} raw
 * @returns {import('../state/types').StoryBlueprint|null}
 */
export function normalizeStoryBlueprint(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const coreQuestion = typeof raw.coreQuestion === 'string' ? raw.coreQuestion.trim() : '';
  if (!coreQuestion) return null;

  const axes = Array.isArray(raw.tensionAxes)
    ? raw.tensionAxes
        .filter(a => a && typeof a.left === 'string' && typeof a.right === 'string')
        .slice(0, 3)
        .map(a => ({
          id: typeof a.id === 'string' && a.id.trim() ? a.id.trim() : slugify(a.left),
          left: a.left.trim(),
          right: a.right.trim(),
        }))
    : [];

  if (axes.length === 0) return null;

  const principles = Array.isArray(raw.arcPrinciples)
    ? raw.arcPrinciples.filter(p => typeof p === 'string' && p.trim()).map(p => p.trim()).slice(0, 4)
    : [];

  return {
    coreQuestion,
    tensionAxes: axes,
    storyIdentity: {
      dominantTone: typeof raw.storyIdentity?.dominantTone === 'string' ? raw.storyIdentity.dominantTone.trim() : '',
      worldEthos: typeof raw.storyIdentity?.worldEthos === 'string' ? raw.storyIdentity.worldEthos.trim() : '',
      choiceEthos: typeof raw.storyIdentity?.choiceEthos === 'string' ? raw.storyIdentity.choiceEthos.trim() : '',
    },
    arcPrinciples: principles,
    endingLogic: {
      ideal: typeof raw.endingLogic?.ideal === 'string' ? raw.endingLogic.ideal.trim() : '',
      failure: typeof raw.endingLogic?.failure === 'string' ? raw.endingLogic.failure.trim() : '',
    },
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Run the story planner LLM call and return a normalized StoryBlueprint.
 *
 * This runs ONCE before planArc(), establishing the philosophical spine of the
 * whole story. Returns null on failure — all downstream planners degrade gracefully.
 *
 * @param {object} playerIntro - storyOptions
 * @param {Function} generateFn - generateScene (accepts messages array)
 * @returns {Promise<import('../state/types').StoryBlueprint|null>}
 */
export async function planStory(playerIntro, generateFn) {
  try {
    const user = buildStoryPlannerPrompt(playerIntro);
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
    return normalizeStoryBlueprint(JSON.parse(text.trim()));
  } catch (e) {
    console.error('[planStory] failed — proceeding without story blueprint', e);
    return null;
  }
}

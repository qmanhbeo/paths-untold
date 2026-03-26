// src/utils/storyBlueprintPlanner.js
//
// Single initialization call that generates the full Story Blueprint for a run.
// The blueprint is a nested wave structure:
//   story = wave of arcs → arc = wave of chapters → chapter = wave of scenes
//
// Each node carries an explicit waveRole (open|build|resolve|cooldown) and
// target narrative values. Scene generation reads current position and follows
// the pre-planned structure rather than re-planning each chapter.
//
// Returns StoryBlueprint | null (null = proceed without blueprint; existing
// arcPlan/chapterPlan logic serves as fallback).

const BLUEPRINT_SYSTEM = `You are a master narrative architect for an interactive story game. Return ONLY valid JSON — no markdown, no comments, no trailing commas.`;

function buildBlueprintPrompt(playerIntro) {
  const genres = playerIntro?.selectedGenres?.join(', ') || 'unspecified';
  const protagonists = playerIntro?.selectedProtagonists?.join(', ') || 'unspecified';
  const tone = playerIntro?.selectedTone?.join(', ') || 'unspecified';
  const setting = playerIntro?.selectedSetting?.join(', ') || 'unspecified';

  return `Player setup:
- Genre: ${genres}
- Protagonist: ${protagonists}
- Tone: ${tone}
- Setting: ${setting}

Design the complete Story Blueprint for this interactive narrative. The blueprint uses a nested wave model:
  STORY = a wave of arcs
  ARC   = a wave of chapters
  CHAPTER = a wave of scenes (encoded as sceneWave array)

Wave grammar for every level: open → build (×1–2) → resolve → cooldown

OUTPUT (strict JSON, all string values ≤ 15 words, no extra prose):

{
  "coreQuestion": "the single central dramatic question that the whole story answers",
  "storyIdentity": "tone + core conflict in one concise phrase",
  "tensionAxes": [
    { "id": "snake_case_id", "left": "one_pole", "right": "opposite_pole" },
    { "id": "snake_case_id", "left": "one_pole", "right": "opposite_pole" }
  ],
  "currentArcIndex": 0,
  "arcs": [
    {
      "id": "arc_1",
      "waveRole": "open",
      "purpose": "what this arc achieves in 12 words or fewer",
      "focusAxis": "id from tensionAxes",
      "targets": { "tension": 3, "intimacy": 5, "mystery": 4, "choiceHarshness": 2, "pacing": "slow", "revelation": 2 },
      "currentChapterIndex": 0,
      "chapters": [
        {
          "id": "arc_1_ch_1",
          "waveRole": "open",
          "purpose": "what this chapter achieves in 12 words or fewer",
          "mustResolve": "the specific tension or conflict that closes this chapter",
          "targets": { "tension": 2, "intimacy": 4, "mystery": 3, "choiceHarshness": 2, "pacing": "slow", "revelation": 1 },
          "sceneWave": ["open", "build", "resolve", "cooldown"],
          "currentSceneIndex": 0
        }
      ]
    }
  ]
}

STRUCTURE RULES:
- Use 3–5 arcs. Story wave: first arc waveRole = "open", last = "cooldown".
- Each arc has 3–4 chapters. Arc wave: first chapter waveRole = "open", last = "cooldown".
- Each sceneWave: 3–5 entries, must start "open", end "cooldown".
- tensionAxes: exactly 2–3 axes. id must be snake_case.
- targets.tension/intimacy/mystery/choiceHarshness/revelation: integers 1–10.
- targets.pacing: "slow" | "medium" | "fast".
- All purpose/mustResolve strings: concise, under 15 words.
- currentArcIndex, currentChapterIndex, currentSceneIndex must all be 0.`;
}

// ── Normalisation helpers ──────────────────────────────────────────────────

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

const VALID_WAVE_ROLES = ['open', 'build', 'resolve', 'cooldown'];
const VALID_PACING = ['slow', 'medium', 'fast'];

function normalizeTargets(raw) {
  if (!raw || typeof raw !== 'object') {
    return { tension: 5, intimacy: 5, mystery: 5, choiceHarshness: 5, pacing: 'medium', revelation: 5 };
  }
  return {
    tension: clamp(Number(raw.tension) || 5, 1, 10),
    intimacy: clamp(Number(raw.intimacy) || 5, 1, 10),
    mystery: clamp(Number(raw.mystery) || 5, 1, 10),
    choiceHarshness: clamp(Number(raw.choiceHarshness) || 5, 1, 10),
    pacing: VALID_PACING.includes(raw.pacing) ? raw.pacing : 'medium',
    revelation: clamp(Number(raw.revelation) || 5, 1, 10),
  };
}

function normalizeChapter(raw, fallbackId) {
  if (!raw || typeof raw !== 'object') return null;
  const sceneWave = Array.isArray(raw.sceneWave)
    ? raw.sceneWave.filter(r => VALID_WAVE_ROLES.includes(r))
    : ['open', 'build', 'resolve', 'cooldown'];
  if (sceneWave.length < 2) return null;
  return {
    id: String(raw.id || fallbackId),
    waveRole: VALID_WAVE_ROLES.includes(raw.waveRole) ? raw.waveRole : 'open',
    purpose: String(raw.purpose || '').trim(),
    mustResolve: String(raw.mustResolve || '').trim(),
    targets: normalizeTargets(raw.targets),
    sceneWave,
    currentSceneIndex: 0,
  };
}

function normalizeArc(raw, fallbackId) {
  if (!raw || typeof raw !== 'object') return null;
  const rawChapters = Array.isArray(raw.chapters) ? raw.chapters : [];
  const chapters = rawChapters
    .map((ch, i) => normalizeChapter(ch, `${fallbackId}_ch_${i + 1}`))
    .filter(Boolean);
  if (chapters.length < 1) return null;
  return {
    id: String(raw.id || fallbackId),
    waveRole: VALID_WAVE_ROLES.includes(raw.waveRole) ? raw.waveRole : 'open',
    purpose: String(raw.purpose || '').trim(),
    focusAxis: String(raw.focusAxis || '').trim(),
    targets: normalizeTargets(raw.targets),
    currentChapterIndex: 0,
    chapters,
  };
}

function normalizeBlueprint(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const rawArcs = Array.isArray(raw.arcs) ? raw.arcs : [];
  const arcs = rawArcs
    .map((a, i) => normalizeArc(a, `arc_${i + 1}`))
    .filter(Boolean);
  if (arcs.length < 1) return null;

  const tensionAxes = Array.isArray(raw.tensionAxes)
    ? raw.tensionAxes
        .filter(a => a && typeof a.id === 'string')
        .map(a => ({ id: String(a.id), left: String(a.left || ''), right: String(a.right || '') }))
    : [];

  return {
    coreQuestion: String(raw.coreQuestion || '').trim(),
    storyIdentity: String(raw.storyIdentity || '').trim(),
    tensionAxes,
    currentArcIndex: 0,
    arcs,
  };
}

// ── Content extraction (mirrors chapterPlanner pattern) ────────────────────

function extractContent(raw) {
  return raw?.choices?.[0]?.message?.content
    ?? raw?.message?.content
    ?? raw?.content
    ?? (typeof raw === 'string' ? raw : null);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Run the single Master Planner LLM call at game initialization.
 * Returns a normalized StoryBlueprint or null on failure.
 *
 * @param {object} playerIntro - storyOptions from StartScreen
 * @param {Function} generateFn - generateScene (accepts messages array)
 * @returns {Promise<import('../state/types').StoryBlueprint|null>}
 */
export async function planStoryBlueprint(playerIntro, generateFn) {
  try {
    const user = buildBlueprintPrompt(playerIntro);
    const raw = await generateFn([
      { role: 'system', content: BLUEPRINT_SYSTEM },
      { role: 'user', content: user },
    ]);
    const content = extractContent(raw);
    if (!content) return null;
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const parsed = JSON.parse(text.trim());
    const blueprint = normalizeBlueprint(parsed);
    if (blueprint) {
      console.log(
        `[planStoryBlueprint] success — ${blueprint.arcs.length} arcs, ` +
        `${blueprint.arcs.reduce((n, a) => n + a.chapters.length, 0)} chapters total`
      );
    }
    return blueprint;
  } catch (e) {
    console.error('[planStoryBlueprint] failed — proceeding without blueprint', e);
    return null;
  }
}

// ── Blueprint navigation helpers (used by applyDeltas and buildUnifiedPrompt) ──

/**
 * Return the current arc node from the blueprint, or null.
 * @param {import('../state/types').StoryBlueprint|null} blueprint
 */
export function getCurrentArcNode(blueprint) {
  if (!blueprint) return null;
  return blueprint.arcs[blueprint.currentArcIndex] ?? null;
}

/**
 * Return the current chapter node from the blueprint, or null.
 * @param {import('../state/types').StoryBlueprint|null} blueprint
 */
export function getCurrentChapterNode(blueprint) {
  const arc = getCurrentArcNode(blueprint);
  if (!arc) return null;
  return arc.chapters[arc.currentChapterIndex] ?? null;
}

/**
 * Return the current scene waveRole from the blueprint, or null.
 * @param {import('../state/types').StoryBlueprint|null} blueprint
 * @returns {"open"|"build"|"resolve"|"cooldown"|null}
 */
export function getCurrentSceneWaveRole(blueprint) {
  const ch = getCurrentChapterNode(blueprint);
  if (!ch) return null;
  return ch.sceneWave[ch.currentSceneIndex] ?? null;
}

/**
 * Derive the scene's effective prompt mode from its wave role and chapter targets.
 * Mirrors the tension-mode vocabulary used in buildUnifiedPrompt.
 *
 * @param {"open"|"build"|"resolve"|"cooldown"|null} sceneWaveRole
 * @param {import('../state/types').NarrativeTargets|null} targets
 * @returns {string}
 */
export function blueprintEffectiveMode(sceneWaveRole, targets) {
  if (sceneWaveRole === 'cooldown') return 'cooldown';
  if (sceneWaveRole === 'resolve') return 'resolution';
  // open / build — tension target sets the intensity level
  const t = targets?.tension ?? 5;
  if (t <= 2) return 'quiet';
  if (t <= 4) return 'unease';
  if (t <= 6) return 'pressure';
  if (t <= 8) return 'breaking_point';
  return 'catastrophe';
}

/**
 * Derive a short templateFamily hint for the system prompt.
 * e.g. "open_invitation", "build_pressure", "resolve_collision", "cooldown_aftermath"
 *
 * @param {"open"|"build"|"resolve"|"cooldown"|null} sceneWaveRole
 * @param {"open"|"build"|"resolve"|"cooldown"|null} chapterWaveRole
 * @returns {string}
 */
export function deriveTemplateFamily(sceneWaveRole, chapterWaveRole) {
  const suffixMap = {
    open:    'invitation',
    build:   chapterWaveRole === 'resolve' ? 'pressure' : 'complication',
    resolve: 'collision',
    cooldown: 'aftermath',
  };
  const role = sceneWaveRole ?? 'open';
  return `${role}_${suffixMap[role] ?? role}`;
}

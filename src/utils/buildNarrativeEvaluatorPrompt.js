// src/utils/buildNarrativeEvaluatorPrompt.js
// Builds evaluator prompt for post-generation narrative evaluation

const EVALUATOR_SYSTEM = `You are a JSON-only scoring function.

Return ONLY one JSON object.
Do not explain.
Do not wrap in markdown.
Do not create nested objects.
Do not create booleans.
Do not create extra keys.

REQUIRED EXACT TOP-LEVEL KEYS:
{
  "waveMatch": number,
  "continuity": number,
  "stakesProgression": number,
  "choiceFit": number,
  "mysteryControl": number,
  "notes": string
}

All numeric values MUST be integers between 0 and 10.
"notes" MUST be one short sentence.

Do NOT return:
- "evaluation"
- "feedback"
- booleans
- checklist fields
- nested objects
- decimal values

Valid example:
{"waveMatch":8,"continuity":9,"stakesProgression":7,"choiceFit":8,"mysteryControl":6,"notes":"The scene establishes curiosity while keeping escalation controlled."}`;

const WAVE_EXPECTATIONS = {
  open: {
    description: "Establish situation, create curiosity, avoid major escalation",
    waveMatchGuidance: "Scene should establish the location/situation clearly, introduce initial thread, and create curiosity. Should NOT have major escalation or full resolution."
  },
  build: {
    description: "Escalate tension, complicate situation, avoid full resolution",
    waveMatchGuidance: "Scene should raise tension, complicate the situation, or deepen a thread. Should NOT fully resolve the core mystery or drop tension unexpectedly."
  },
  resolve: {
    description: "Pay off tension, create irreversible change, answer something meaningful",
    waveMatchGuidance: "Scene should deliver payoff - answer something meaningful, force irreversible choice, or close a major thread. Should NOT introduce new mysteries or stall."
  },
  cooldown: {
    description: "Reduce pressure, process consequences, avoid major new conflict",
    waveMatchGuidance: "Scene should decompress after major events, process consequences quietly. Should NOT escalate or introduce new major conflicts."
  }
};

export function buildNarrativeEvaluatorPrompt({
  memory,
  generatedScene,
  sceneWaveRole,
  blueprintChapterNode,
  latestChoice
}) {
  const arc = memory?.arc ?? {};
  const world = memory?.world ?? {};
  const prose = generatedScene?.prose ?? '';
  const paths = generatedScene?.paths ?? [];
  const summary = memory?.summary ?? [];

  const previousProse = summary.length > 0
    ? summary[summary.length - 1]
    : (memory?.prose?.[memory.prose.length - 1] ?? '').slice(0, 200);

  const waveExpectations = WAVE_EXPECTATIONS[sceneWaveRole] ?? WAVE_EXPECTATIONS.open;
  const chapterPurpose = blueprintChapterNode?.purpose ?? arc?.chapterPlan?.chapterGoal ?? 'progress story';
  const mustResolve = blueprintChapterNode?.mustResolve ?? arc?.chapterPlan?.mustResolve ?? '';
  const targets = blueprintChapterNode?.targets ?? { tension: 3, intimacy: 3, pacing: 3 };

  const system = EVALUATOR_SYSTEM;

  const user = "Score the generated scene against these dimensions.\n\n" +
    "Current wave: " + sceneWaveRole + " (" + waveExpectations.description + ")\n" +
    "Chapter purpose: " + chapterPurpose + "\n" +
    "Must resolve: " + (mustResolve || 'none') + "\n" +
    "Targets: tension " + targets.tension + ", intimacy " + targets.intimacy + ", pacing " + targets.pacing + "/10\n\n" +
    "Previous: " + previousProse.slice(0, 150) + "\n" +
    "Player choice: " + (latestChoice || 'opening') + "\n\n" +
    "Scene: " + (generatedScene?.title || '') + " | " + prose.slice(0, 100) + "...\n" +
    "Paths: " + (paths.join(' | ') || 'none') + "\n\n" +
    "Dimensions:\n" +
    "waveMatch - how well the scene matches the intended wave role\n" +
    "continuity - how logically it follows the previous scene and player choice\n" +
    "stakesProgression - whether tension/pressure moved appropriately for the wave\n" +
    "choiceFit - whether player choices are immediate, grounded, and distinct\n" +
    "mysteryControl - whether information was revealed/withheld appropriately\n\n" +
    "Return exactly the required six-key JSON object. No other keys.";

  return { system, user };
}

export default buildNarrativeEvaluatorPrompt;
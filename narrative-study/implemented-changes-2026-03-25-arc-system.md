# Implemented Changes — 2026-03-25 (Arc & Pacing System)

This document covers the second wave of changes from the March 25 session. The first wave (Choice Director, Choice Text Law) is in `implemented-changes-2026-03-25.md`.

These changes address a different category of problem: not how choices look, but whether the story goes anywhere.

---

## The core problem this session solved

The engine was generating scenes, not stories.

Each scene was locally competent — well-written, grounded, consequence-aware — but the sequence had no shape. Tension could plateau indefinitely. The climax would never come unless the LLM happened to invent one. The player could play for twenty scenes and feel like nothing had changed because, structurally, nothing had.

The changes below give the engine a spine.

---

## 1. Structured scene log (causal rolling record)

### Problem

The LLM was receiving raw prose as its history — the last few paragraphs of generated text. This is descriptive, not causal. It tells the model what the world looked like, not what changed, what was revealed, or what the player did.

The result: scenes that re-established atmosphere instead of advancing from it.

### What was built

A `SceneRecord[]` rolling log replaces raw prose in the prompt. Each record captures:

```js
{
  sceneIndex: number,
  playerChoice: string,    // what the player did
  event: string,           // what concretely happened
  stateChange: string,     // what is now different
  reveals: string[],       // new information the player learned
  resolvedThreads: string[] // threads closed this scene
}
```

The last 5 scene records are injected into the user message. The LLM sees the causal chain, not the texture.

The LLM is required to populate `sceneRecord` in its output. If `stateChange` is empty, the progression rules treat it as a violation.

### Why this matters

A scene log is a commitment ledger. It forces the model to name what happened, what changed, and what was revealed — which means it can't pretend to advance while standing still.

---

## 2. Five tension modes (discrete, named)

### Problem

A single numeric `tension` field (0–10) was being passed to the prompt. The LLM had no guidance on what different tension levels should feel like, so it treated every level as "a little more dramatic than the last."

### What was built

Five named tension modes derived from the numeric value:

| Mode | Range | Shape |
|------|-------|-------|
| `quiet` | 0–2 | Establish world and tone. Something is noticed, not confronted. |
| `unease` | 3–4 | Introduce friction. One thing becomes uncertain. |
| `pressure` | 5–6 | Force a trade-off or reveal something unwelcome. The player must respond. |
| `breaking_point` | 7–8 | Irreversible. A major decision or commitment. Player cannot stay neutral. |
| `catastrophe` | 9–10 | Maximum consequence. Something fails or collapses. Choices: threshold only. |

Each mode receives a specific instruction in the system prompt about scene structure, consequence weight, and valid choice types. The effective mode is shown in the world block so it's visible in debug logs.

---

## 3. Progression rules (7 hard requirements per scene)

### Problem

Even with a scene log and tension modes, nothing stopped the LLM from generating a scene that described atmosphere, mentioned a companion, implied vague tension, then offered four paths with identical emotional weight. Scenes that moved nothing.

### What was added

Seven mandatory progression rules injected into the system prompt:

1. Introduce at least ONE concrete development: new information, a relationship that shifts, a constraint added, or something irreversible.
2. Player choices MUST cause state changes — never offer paths with identical outcomes.
3. Do NOT re-describe unchanged atmosphere, location, or companions.
4. Do NOT repeat recent scene structure.
5. At pressure/breaking_point: at least one active thread must deepen or shift.
6. At catastrophe: force a consequence — no more setup.
7. `sceneRecord.stateChange` must describe something concrete. Empty = rule 1 violated.

These rules are enforced at the prompt level (LLM contract) rather than post-hoc validation.

---

## 4. Arc direction (core question + active threads)

### Problem

The story had no persistent dramatic stakes. Without a central question threading through scenes, each scene invented its own micro-conflict, creating a sequence that felt episodic rather than cumulative.

### What was added

Two persistent arc fields:

- `coreQuestion` — the central dramatic question of the story ("Will you…" / "Can you…" / "What does it cost to…"). Set on the first scene, injected into every subsequent prompt.
- `activeThreads[]` — up to 5 named narrative threads running in parallel. The LLM adds threads via `arcDelta.addThreads` and removes them via `arcDelta.removeThreads`.

The `arcDelta` output field was extended to carry these signals, and `applyDeltas.js` was updated to apply them to persistent arc state.

---

## 5. Chapter planner (`planChapter`)

### Problem

The LLM was generating scenes one at a time with no knowledge of where the chapter was going. The tension curve had no destination. Beats could be skipped, repeated, or avoided entirely.

### What was built

`chapterPlanner.js` — a separate LLM call that runs before the first scene of each chapter (and again when a chapter advances). It generates a `ChapterPlan`:

```js
{
  chapterGoal: string,           // what this chapter achieves
  chapterStageSequence: ChapterStage[], // ["open","build","resolve","cooldown"]
  mustResolve: string,           // the conflict that must close
  mustAdvanceArcThread: string,  // which arc thread must move
  chapterCompletionCondition: string, // observable end condition
  currentStageIndex: number,
  completedBeats: string[]
}
```

The plan is stored in `arc.chapterPlan` and injected into every scene prompt as gravitational context: the LLM knows what the chapter is trying to accomplish and what stage it's in.

---

## 6. 120-word scene cap + game-not-novel style

### Problem

Scenes were too long. The LLM was writing in novel mode — establishing atmosphere across multiple paragraphs before reaching the moment the player needed to act on. By the time choices appeared, the reader had lost the thread.

### What was changed

Hard maximum of 120 words per scene. 2–3 short paragraphs, each ≤ 2 sentences. The system prompt was rewritten to enforce this: "Write like a game, not a novel — direct, clear, fast."

The style rule reinforces this: every sentence must either move the situation forward or give the player information they need to choose.

---

## 7. Dedicated opening scene template

### Problem

Opening scenes were inconsistent and often disorienting. Without specific guidance, the LLM would introduce multiple disconnected elements, provide abstract choices, or fail to ground the player in a coherent space.

### What was added

A separate task block for the first scene only, enforcing five mandatory rules:

- **GROUNDING** — the first sentence must name a specific place type, list 2–3 physical elements that logically belong there, and state clearly whether indoors or outdoors.
- **COHERENCE** — every element must belong to the same space. No disconnected objects, unexplained symbols, or surreal juxtapositions.
- **SITUATION** — something is happening now. One concrete event, simple and understandable.
- **CHOICES** — 2–3 physically actionable options based only on what was described. No guessing, no abstraction.
- **LENGTH** — 80–120 words, 2–3 paragraphs, ≤ 2 sentences each.

The continuation prompt (all subsequent scenes) is unchanged.

---

## 8. Resolution mode (automatic payoff trigger)

### Problem

Stories were stalling at high tension. The LLM could generate catastrophe-level scenes indefinitely — hinting, escalating, adding clues — without ever committing to a payoff. The tension ceiling became a plateau.

### What was built

A 6th effective mode — `resolution` — that is NOT a tension level. It is a state-derived override that fires automatically when the system detects the story has earned a payoff but isn't delivering one.

**Trigger conditions (either):**
- Tension ≥ 7 AND all chapter beats complete AND a chapter plan exists
- Tension ≥ 9 AND the last 2 scenes have no resolved threads and no state change (detectable stall)

**What resolution mode does:**
- Bans: new clues, new threads, further escalation, investigative choices
- Requires: reveal a key truth / confront a character directly / force an irreversible choice / close a major thread
- Choice style: outcomes only ("Confront them" / "Accept the deal" / "Walk away for good")
- Sets `arcDelta.advanceChapterStage: true` when the completion condition is met

The pattern enforced: *follow → hint → follow → hint → corner → reveal → decision → consequence*. Not: *follow → hint → follow → hint → madness*.

---

## 9. Nested pacing — Arc + Chapter + Scene

### The design

Three pacing levels, each nested inside the next:

```
Arc (macro)
  open → build → peak → resolve
  Spans multiple chapters. Generated once at story start by planArc().

  Chapter (micro)
    open → build → resolve → cooldown
    One chapter. Generated per chapter by planChapter().

    Scene (mini)
      ¶1: ground the moment
      ¶2: something shifts or is revealed
      ¶3: reach the decision point
      Implicit structure within each 120-word scene.
```

### Arc Planner (`planArc`)

A new LLM call that runs **once at story start**, before the chapter planner. It generates an `ArcPlan`:

```js
{
  arcGoal: string,               // what the full story achieves
  arcTheme: string,              // the core theme
  arcQuestion: string,           // the central dramatic question
  arcStageSequence: ArcStage[],  // ["open","build","build","peak","resolve"]
  arcResolutionCondition: string,// specific observable end condition
  currentStageIndex: number      // starts at 0
}
```

The arc plan is stored in `arc.arcPlan` and passed to `planChapter()` as context — so the chapter planner knows which arc stage it's inside and can shape the chapter accordingly.

### Chapter Planner (revised)

`planChapter()` was revised to receive `arcPlan` as context and use it to inform the chapter's stage sequence, goal, and thread advancement requirements. The chapter plan output structure was simplified: the old `arcs[]` structure is replaced with the flat `ChapterPlan` shape (see §5 above).

### Stage advancement

The LLM can signal stage progression via `arcDelta`:

- `advanceChapterStage: true` — moves `chapterPlan.currentStageIndex` forward (open → build → resolve → cooldown)
- `advanceArcStage: true` — moves `arcPlan.currentStageIndex` forward across chapters

`applyDeltas.js` and `storyParser.js` handle both.

### Cooldown mode

A 7th effective mode, triggered when `chapterStage === 'cooldown'`:

> Decompression. The chapter's core conflict just closed. Breathe — let consequences land quietly. Establish new normal. No new conflicts, no escalation. Tension direction: -1. Prepare threads for the next chapter.

Cooldown takes priority over all other modes including resolution.

### Scene mini-structure

Added to the STYLE rule:

> Each scene should follow a mini arc within its 2–3 paragraphs — ¶1: ground the moment; ¶2: something shifts or is revealed; ¶3: reach the decision point. Keep it implicit and natural, not mechanical.

This isn't enforced with rules — it's framed as a craft instruction. The intent is that the arc is felt, not visible.

---

## Files changed

| File | Change |
|------|--------|
| `src/utils/buildUnifiedPrompt.js` | Scene log, 5 tension modes, progression rules, arc direction, 120-word cap, opening scene template, resolution mode, nested stages, cooldown mode, scene mini-structure, updated arcDelta schema |
| `src/utils/chapterPlanner.js` | Full rewrite: added `planArc()`, revised `planChapter()` to use arc context, new ChapterPlan shape |
| `src/state/types.js` | Added `ArcStage`, `ChapterStage`, new `ArcPlan` and `ChapterPlan` types; `arcPlan` added to `GameMemory.arc` |
| `src/state/applyDeltas.js` | Added `advanceChapterStage` and `advanceArcStage` handlers |
| `src/utils/storyParser.js` | `coerceArcDelta` extended with `advanceChapterStage`, `advanceArcStage` |
| `src/state/updateFromAIPacket.js` | `arcPlan: null` default in `ensureWorldArc`; scene log appending (rolling 5) |
| `src/state/migrateMemory.js` | `arcPlan: null` backfill for old saves |
| `src/components/GameScreen.jsx` | Calls `planArc()` before `planChapter()` on story start; `arcPlan: null` in `createFreshMemory` and `ensureWorldArc` |

---

## Status

Committed to `claude/consolidate-env-files-Ar7WN`. Pending merge to main.

No migration needed for saves created before the chapter planner existed — `arcPlan: null` and `chapterPlan: null` are backfilled by `migrateMemory.js` and gracefully handled throughout.

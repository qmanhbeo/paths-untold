# Implemented Changes — 2026-03-25

Two related prompt-layer improvements shipped today. Both target the same core problem: choices that feel authored rather than lived.

---

## 1. Choice Director — choices only when the story earns them (PR #8)

### Problem

Every scene was ending with exactly four paths. Always. Regardless of context.

This created a structural lie: the game implied that every moment in a story naturally produces four equally valid branches. It doesn't. Some moments call for silence. Some call for a binary commitment. Some call for the player's own words.

### What was built

A `choiceDirector` field in the LLM output schema that governs whether — and in what form — player input should appear after a scene.

Four interaction types:

| Type | When to use | Output |
|------|-------------|--------|
| `paths` | Default — player picks from concrete options | 1–4 items (prefer 2–3) |
| `threshold` | Binary commitment — stay/leave, confess/deny, accept/refuse | Exactly 2 items |
| `freetext` | Player speaks in their own words — answering a question, confessing, writing a message | Empty paths array; `choiceDirector.prompt` set to in-world question |
| `none` | Atmosphere, consequence, transition — no input needed | Empty paths array; `choiceDirector.needed = false` |

The frontend (`ChoiceGrid.jsx`, `GameScreen.jsx`) was updated to render each interaction type differently: freetext shows an input field with a submit button; threshold shows a minimal binary layout; none shows a single "Continue" prompt.

A new `FreeTextInput` component was built for freetext scenes. Player responses are captured and fed back into the next prompt as the player's voiced words.

### Design principle

> Never manufacture options just to fill a grid.

Choices are earned by the scene. The scene decides whether it needs them.

---

## 2. Variable path count + Choice Text Law (PR #9)

### Problem A: variable count was broken

The `paths` field in the output schema showed exactly four literal string entries. The LLM read this as the template and reproduced four paths every time, ignoring `choiceDirector.count`. The fix was to annotate the schema entry as a single dynamic item rather than four static examples.

### Problem B: choices were too wordy

Even when choice count was correct, the text of each option was wrong. Choices were being written as:

> "Turn toward the Bakery Owner and invite them to read a memory aloud, inviting soft candor to mingle with lilac and bread scent."

This is a branch summary, not a player action. It tells the player what will happen rather than asking what they want to do. The player isn't choosing — they're selecting a paragraph vibe.

### What was added

A **Choice Text Law** added to the system prompt immediately before the paths rule:

> The scene may be poetic. The choice must be decisive.

The full doctrine:
- Target 2–8 words; 12 maximum
- Strong verbs preferred
- No atmospheric padding, decorative explanation, or predicted consequences
- The scene body carries the literary weight; choice text carries decision clarity only
- Preserve distinctiveness by varying action / value / risk — not by adding more words
- Inline good/bad examples anchor the model to concrete targets, not abstract principles

### Before / after

| Before | After |
|--------|-------|
| Ask the Town Itself to reveal a memory that ties your longing to the map's edge, in a whispered confession | Ask the town what it remembers |
| Turn toward the Bakery Owner and invite them to read a memory aloud, inviting soft candor to mingle with lilac and bread scent | Ask the baker to read it |
| Reach toward the map's edge with a deliberate hand, testing the boundary while the Town Itself murmurs guidance in your ear | Touch the edge |
| Step back and declare a vow to wait for a sign from the town's silence, choosing cautious proximity over immediate surrender | Wait for a sign |

### The artistic principle

When the prose is rich and the choices are clean, the contrast creates power.

The scene says: *here is the moment.*
The choice says: *what do you do?*

If both are literary, the player floats. If the prose dreams and the choice cuts, the player acts.

---

## Files changed

| File | Change |
|------|--------|
| `src/utils/buildUnifiedPrompt.js` | Choice Director doctrine + variable paths schema + Choice Text Law |
| `src/components/GameScreen.jsx` | Route interaction types; capture freetext input |
| `src/components/GameScreenComponents/ChoiceGrid.jsx` | Render paths / threshold / freetext / none differently |
| `src/utils/storyParser.js` | Parse and normalize `choiceDirector` field from LLM output |

---

## Status

Both changes are live on `main`. No migration needed — schema additions are backward-compatible with existing save data.

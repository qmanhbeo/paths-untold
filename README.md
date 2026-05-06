# 🌌 Paths Untold

**An Experimental Long-Horizon Narrative Orchestration System**

Paths Untold is not designed to generate stories, but to sustain them.

It treats interactive storytelling as a **control problem**: each scene is generated against a structured blueprint, evaluated against its intended role, and updated through stateful memory. Rather than treating an LLM as a one-shot storyteller, it frames narrative generation as a **long-horizon orchestration** — where scenes have assigned dramatic functions (open, build, resolve, cooldown), pressure targets, and post-generation quality observation.

The system is a research prototype exploring how directed pacing, explicit wave roles, and feedback-based evaluation can create coherent, controllable long-form narrative interaction.

---

## ✨ What This Project Is

Paths Untold sits at the intersection of **systems design** and **interactive storytelling**:

* **A research-oriented narrative engine** — studying memory, coherence, directed pacing, and human–AI interaction through the lens of game-logic orchestration
* **A quiet choice-driven story game** — where choices are interventions, characters remember, and pacing has visible structure

It is modular by design: Planner → Wave Director → Writer → Evaluator → Memory.

---

## 🌊 Narrative Pressure & Wave Direction

Scenes are not isolated generations. Each scene has a **wave role** that determines its intended dramatic behavior:

| Wave Role | Intended Behavior |
|----------|------------------|
| **open** | Establish situation, stakes, and curiosity |
| **build** | Complicate tension, increase uncertainty |
| **resolve** | Pay off tension, create irreversible change |
| **cooldown** | Process consequences, reduce pressure |

Wave roles are assigned by the Story Blueprint (a long-term narrative plan with arcs, chapters, and scene waves). The **Wave Director** converts these assignments into explicit behavioral guidance for the LLM:

```
Scene wave role: build — shape this scene to match that role exactly.
Target tension: 6/10 — escalate but do not reach breaking point.
```

This creates **rhythm** — the model is asked to perform a narrative function, not merely "write the next scene."

---

## 📊 Narrative Evaluation Layer

After scene generation, **Narrative Evaluator v0** scores whether the scene matched its intended role:

| Dimension | What It Measures |
|-----------|----------------|
| **waveMatch** | How well the scene fulfills its assigned wave role |
| **continuity** | Logical flow from previous scene and player choice |
| **stakesProgression** | Whether tension/pressure moved appropriately |
| **choiceFit** | Whether player choices are immediate, grounded, distinct |
| **mysteryControl** | Whether information was revealed/withheld appropriately |

Scoring scale: 0–10 (where 7+ is good, 4–6 is ok, 0–3 is low).

The evaluator is currently **observational, not blocking** — it does not regenerate scenes or reject outputs. It enables future feedback loops and drift detection.

---

## 🧠 Modular Narrative Architecture

```
Planner → Blueprint (arcs, chapters, scene waves)
         ↓
Wave Director → scene guidance (wave role, targets)
         ↓
Scene Writer → prose + choices
         ↓
Schema Parser → structured output
         ↓
Narrative Evaluator → quality scores
         ↓
World State Update → memory + continuity
         ↺
Player Choice → intervenes in state
```

Each component is explicit:

* **Story Blueprint Planner** — async, background-generated long-term narrative plan
* **Wave Director** — converts blueprint wave/targets into scene-level prompts
* **Scene Writer** — produces prose and player choices
* **Narrative Evaluator** — scores generated scenes post-hoc
* **Memory / Scene Log** — causal continuity (last 5 scenes stored as structured records)
* **Dev Codex / Blueprint Map** — visualizes blueprint and runtime state (F2 to toggle)

---

## 🧩 Core Features

* **Async Story Blueprint planning** — background-generated narrative structure
* **Scene 0 cold start** — background planner runs after opening scene
* **Wave-directed pacing** — open/build/resolve/cooldown scene roles
* **Narrative pressure targets** — tension, intimacy, mystery, choiceHarshness, pacing, revelation
* **Structured scene schema** — enforces contract between model and system
* **Causal scene log** — last 5 scenes as structured records (event, stateChange, reveals, resolvedThreads)
* **Choice Director** — conditional choice types: paths, threshold, free-text, or none
* **Narrative Evaluator v0** — observational scoring (does not block regeneration)
* **Dev Codex / Blueprint Map inspector** — F2 key to visualize blueprint state
* **Cohere provider** with model fallback (command-a-03-2025 → command-r-plus-08-2024)
* **Multi-provider support** — OpenAI, Cohere, Google via server proxy
* **Separate scene schemas** — opening vs. follow-up scene contracts
* **Deferred identity** — player name requested only when narrative earns it

---

## 🚀 Getting Started (Local Development)

### 1. Clone the repository

```bash
git clone https://github.com/qmanhbeo/paths-untold.git
cd paths-untold
```

---

### 2. Set up environment variables

#### Backend (`/server/.env`)

```env
# Provider: openai, google, or cohere
LLM_PROVIDER=cohere
COHERE_API=your-cohere-key
COHERE_MODEL=command-a-03-2025
COHERE_MODEL_FALLBACKS=command-r-plus-08-2024
COHERE_MAX_TOKENS=1600
COHERE_TIMEOUT=30000
PORT=5175
```

#### Frontend (root `.env`)

```env
VITE_API_BASE=http://localhost:5175/api
VITE_LLM_MODEL=command-a-03-2025
```

⚠️ **Important**: Keep API keys only in `/server/.env`. The frontend `.env` must never contain secrets.

---

### 3. Install dependencies

```bash
npm install
npm --prefix server install
```

---

### 4. Run the game 🎮

```bash
npm run dev
```

By default:

* Game UI: [http://localhost:3000](http://localhost:3000)
* API proxy: [http://localhost:5175](http://localhost:5175)

---

## 🛠 Tech Stack

* **Frontend**: React, Vite, Tailwind CSS, React Hooks
* **Backend**: Express, native `fetch`, CORS, zod (schema validation)
* **AI Integration**: Cohere (primary), OpenAI, Google — via server proxy with provider routing and fallback
* **State & Memory**: Custom managers for narrative state, character memory, scene log, and emotion tracking
* **Testing**: Vitest + Testing Library

---

## 📂 Project Structure

```
/src                         → React frontend
  /components                 → UI (GameScreen, StartScreen, Dev Codex)
  /components/GameScreenComponents → ChoiceGrid, HeaderBar, StoryDisplay
  /components/dev            → Inspector, BlueprintMapView
  /state                     → updateFromAIPacket, narrativeGraph, applyDeltas
  /utils                     → buildUnifiedPrompt, buildNarrativeEvaluatorPrompt
  /services                  → llmClient
/server                      → Express proxy (provider routing)
/images                      → Backgrounds and UI assets
/public                      → Logos, manifest, icons
```

---

## 🧭 Why Build This

Most LLM applications optimize for single-turn quality.

Paths Untold instead asks:

* How do models maintain identity over long horizons under directed pacing?
* How should wave roles and pressure targets influence scene generation?
* How does post-generation evaluation enable feedback loops?
* What failure modes emerge when narrative orchestration and human intervention interact?

The narrative domain makes these questions *legible* and *human-scale*.

---

## 🐉 Status

**Active experimental narrative engine / research prototype**

Current architecture is functional:
- Story Blueprint planning works (async, background)
- Wave-directed scene generation works
- Narrative Evaluator v0 runs after each scene
- Dev Codex inspector visualizes blueprint state

Known limitations:
- Evaluator scores are observational (not yet used for regeneration)
- Blueprint advancement is currently deterministic
- Schema recovery is still evolving
- Generation speed depends on provider/model latency

---

## 🛣 Roadmap

### Implemented
- [x] Stateful scene memory
- [x] Structured scene schema
- [x] Causal scene log
- [x] Async Story Blueprint planner
- [x] Wave-directed pacing (open/build/resolve/cooldown)
- [x] Narrative pressure targets
- [x] Narrative Evaluator v0
- [x] Dev Codex / Blueprint Map inspector
- [x] Cohere provider routing and fallbacks

### Near-Term
- [ ] Normalize evaluator scoring consistently (0–10)
- [ ] Persist evaluator scores per scene
- [ ] Drift detection between player actions and blueprint
- [ ] Persistent narrative forces/tensions
- [ ] Better schema repair and recovery
- [ ] Cleaner model routing per role: planner / writer / evaluator

### Future Research
- [ ] Elastic blueprint reinterpretation
- [ ] Evaluator-informed regeneration
- [ ] Companion-specific emotional simulation
- [ ] Dynamic emotional UI/prose modulation
- [ ] Long-term thematic memory
- [ ] Multi-agent narrative orchestration

---

## 👀 Visual Preview

Paths Untold is designed to feel calm, readable, and immersive — closer to a quiet book than a flashy game.

The screenshots below show the full interaction loop: starting a story, making choices, and watching narrative state evolve over time.

> These previews are provided so readers can understand the system and atmosphere **without installing dependencies or using an API key**.

---

### Start & Setup

**Start Screen**
A minimal entry point into the narrative world.

![Start Screen](images/0_StartScreen.png)

**Save Slots**
Multiple timelines can be saved and revisited, allowing parallel narrative exploration.

![Save Slots](images/1_SavedSlots.png)

**Preferences**
Lightweight configuration before entering the story.

![Preferences](images/2_Preferences.png)

---

### Narrative Flow

**Generated Scene**
LLM-generated narrative grounded in accumulated state and memory.

![Scene 0](images/3_Scene0.png)

**Player Choices**
Discrete actions that intervene in the story and influence future generations.

![Choices](images/4_Choice0.png)

**Ongoing Story**
Consequences accumulate across scenes, maintaining tone, character identity, and emotional continuity.

![Scene 1](images/5_Scene1.png)

---

The visuals are intentionally restrained.

The focus is on **reading, choosing, and being remembered** — not spectacle.
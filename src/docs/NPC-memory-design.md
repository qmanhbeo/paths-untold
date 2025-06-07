## NPC Memory Design

This document outlines how non-player characters (NPCs) are identified, tracked, and evolved across scenes within the game's dynamic memory system.

---

### 👤 Purpose

The NPC memory system enables the AI to:
- Remember recurring characters across scenes
- Track their evolving personalities, emotional states, and facts
- Provide contextual continuity (e.g. "Lira seems more cautious than before")
- Prepare future integration for influencing narrative direction and choice logic

---

### 🧠 Data Structure: `companions`

```js
companions: [
  {
    name: "Lira",
    personality: "Curious and loyal",
    role: "Trusted crewmate",
    knownFacts: ["player has seen the flower"],
    lastSpoken: { line: "You really believe it can change you?" },
    trust: 45,
    affection: 10,
    fear: 20,
    curiosity: 60,
    anger: 5,
    relationshipHistory: [
      { event: "You shared secret", impact: 15 },
      { event: "You ignored her", impact: -10 }
    ],
    lastUpdatedScene: 2
  },
  // More characters...
]
```

Each companion object stores:
- Basic identity (`name`, `role`, `personality`)
- Emotional state variables (trust, affection, fear, curiosity, anger)
- Interaction memory (`lastSpoken`, `knownFacts`)
- A running `relationshipHistory` log with the player
- The last scene in which they were updated (`lastUpdatedScene`)

---

### 🔍 Extraction Process

NPCs are extracted after each scene using:
```ts
extractCharacters(storyText, existingCharacters)
```

This function:
- Sends the story and current NPC memory to the LLM
- Prompts it to return only new or updated NPC entries
- Formats the result as a clean JSON array

---

### ♻️ Merging Process

Merging happens via:
```ts
updateCharacterTraits(existing, incoming)
```
- Traits are merged conservatively to avoid overwriting non-null values
- Lists like `knownFacts` and `relationshipHistory` are merged and deduplicated
- `lastUpdatedScene` is set to the current scene index

---

### 🧠 Role in Prompting

Currently, `companions` are **not yet included** in prompt generation (`buildStoryPrompt`). This is intentional:
- The logic for **how** NPCs should influence narrative is under design
- Prompt injection will be added once it’s clear how memory impacts dialogue, relationships, or plot branching

---

### 🧪 Future Considerations

- Relationship progression and branching logic
- Dialogue conditioning based on NPC memory
- Emotional arcs or personality shifts over time
- Decay of unused memory (e.g. trust fades, curiosity cools)

---

The NPC memory system lays the foundation for living, reactive characters that can evolve through interaction. Integration with prompting and gameplay logic is the next milestone.

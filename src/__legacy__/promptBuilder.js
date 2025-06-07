// utils/promptBuilder.js
export const buildStoryPrompt = (gameMemory, latestChoice) => {
  const { summary = [], story = [] } = gameMemory;

  const latestSummary = summary.at(-1) || '';
  const latestScene = story.at(-1) || '';

  const prompt = `**Context Recap:**\n${latestSummary}

**Latest Scene:**\n${latestScene}

**Previous Choice:**\n${latestChoice}

Continue the story (2-3 SHORT PARAGRAPHS) in this format:

- **Story:** [Continue the narrative with strong pacing and emotional nuance. Use line breaks generously for dramatic effect. End with a question.]

- **Choice A:** [Insert the first choice here]
- **Choice B:** [Insert the second choice here]
- **Choice C:** [Insert the third choice here]
- **Choice D:** [Insert the fourth choice here]
(CHOICES ARE 5-7 WORDS)`;

  return prompt;
};

// utils/storyParser.js
export const parseGeneratedStory = (rawAIX, displayedStory, choice = '') => {
  // Extract title
  const titleRegex = /- \*\*Title:\*\* (.*?)(?:\n|$)/;
  const titleMatch = rawAIX.match(titleRegex);
  const storyTitle = titleMatch ? titleMatch[1].trim() : 'Your Adventure Awaits...';

  // Extract story
  const storyRegex = /\*\*Story:\*\*\s*([\s\S]*?)(?=\n\*\*Choice|\n- \*\*Choice|\n$)/;
  const storyMatch = rawAIX.match(storyRegex);
  const storyX = storyMatch ? storyMatch[1].trim() : 'No story available.';

  // Build updated HTML story (with player choice if any)
  const fullStory = `${displayedStory}${displayedStory ? `<br /><br /><strong>The player chooses:</strong> ${choice}.<br /><br />` : ''}${storyX.replace(/\n/g, '<br />')}`;

  // Extract choices
  const choiceRegex = /\*\*Choice (?:A|B|C|D):\*\* (.*?)(?:\n|$)/g;
  const fourChoicesX = [];
  let match;
  while ((match = choiceRegex.exec(rawAIX)) !== null) {
    fourChoicesX.push(match[1].trim().replace(/\.$/, ''));
  }

  return {
    storyTitle,
    fullStory,   // Cumulative version for display
    storyX, // Only the new scene
    fourChoicesX
  };
};
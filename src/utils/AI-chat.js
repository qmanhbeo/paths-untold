// AI-chat.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';

export const generateStory = async (prompt, onStoryGenerated) => {
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 900,
    }, {
      headers: {
        'Authorization': `Bearer [API key]`, // Replace with your actual API key
        'Content-Type': 'application/json',
      },
    });

    // Call the callback function with the generated story
    onStoryGenerated(response.data.choices[0].message.content);
  } catch (error) {
    console.error('Error generating story:', error);
  }
};

// GameStart component to trigger story generation
const GameStart = ({ onStoryGenerated, prompt }) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (prompt) {
      setLoading(true);
      generateStory(prompt, onStoryGenerated).finally(() => setLoading(false));
    }
  }, [prompt, onStoryGenerated]); // Run this effect when the prompt changes

  return (
    <div>
      {loading && <p>Loading story...</p>} {/* Optional loading indicator */}
    </div>
  );
};

export default GameStart;
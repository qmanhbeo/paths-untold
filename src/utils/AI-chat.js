// src/utils/AI-chat.js
import React, { useEffect, useRef, useState } from 'react';
import { chat as llmChat } from '../services/llmClient';
import { extractAndNormalizeAiResponse } from '../utils/storyParser';

const API_MODEL = process.env.REACT_APP_LLM_MODEL || 'gpt-4o-mini';

/** Public API used by components */
export async function generateStory(prompt, callback) {
  try {
    // Call proxy → upstream completion JSON
    const upstream = await llmChat(prompt, { model: API_MODEL });

    // Centralized parse/normalize
    const normalized = extractAndNormalizeAiResponse(upstream);
    if (!normalized) throw new Error('LLM returned unparseable content');

    if (callback) callback(normalized);
    return normalized;
  } catch (e) {
    console.error('[generateStory] error', e);
    if (callback) callback(null, e);
    throw e;
  }
}

/** Optional helper component you were using */
const GameStart = ({ onStoryGenerated, prompt }) => {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const ranOnceRef = useRef(false);

  useEffect(() => {
    if (!prompt) return;
    if (ranOnceRef.current) return; // avoid double fire in React 18 dev StrictMode
    ranOnceRef.current = true;

    setLoading(true);
    setErr(null);
    generateStory(prompt, (payload) => {
      if (payload) onStoryGenerated && onStoryGenerated(payload);
      setLoading(false);
    }).catch(e => {
      setErr(e.message || String(e));
      setLoading(false);
    });
  }, [prompt, onStoryGenerated]);

  return (
    <div>
      {loading && <p>Loading story...</p>}
      {err && <p style={{ color: 'red' }}>Error: {err}</p>}
    </div>
  );
};

export default GameStart;

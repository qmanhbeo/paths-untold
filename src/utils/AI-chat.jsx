// src/utils/AI-chat.js
import React, { useEffect, useRef, useState } from 'react';
import { LLM_MODEL } from '../config/env';
import { chat as llmChat, chatStream, extractStoryFromBuffer } from '../services/llmClient';
import { createDebugLogger } from './debugLog';
import { extractAndNormalizeAiResponse } from '../utils/storyParser';

const debug = createDebugLogger('AI-chat');

/**
 * Non-streaming scene generation.
 * Accepts a prompt string or a messages array (system + user roles).
 */
export async function generateScene(promptOrMessages, callback) {
  try {
    const upstream = await llmChat(promptOrMessages, { model: LLM_MODEL });
    if (callback) callback(upstream);
    return upstream;
  } catch (e) {
    debug.error('[generateScene] error', e);
    if (callback) callback(null, e);
    throw e;
  }
}

/**
 * Streaming scene generation.
 * Calls onStoryChunk(text) with incremental prose text as it arrives.
 * Calls onComplete(upstream) with the full response object when the stream ends.
 */
export async function generateSceneStream(messages, onStoryChunk, onComplete) {
  let prevStoryLength = 0;
  try {
    const rawText = await chatStream(messages, (_delta, accumulated) => {
      const result = extractStoryFromBuffer(accumulated);
      if (result && result.text.length > prevStoryLength) {
        onStoryChunk(result.text.slice(prevStoryLength));
        prevStoryLength = result.text.length;
      }
    });
    const upstream = { choices: [{ message: { content: rawText } }] };
    if (onComplete) onComplete(upstream);
  } catch (e) {
    debug.error('[generateSceneStream] error', e);
    throw e;
  }
}

// Backward-compat alias
export const generateStory = generateScene;
export const generateStoryStream = generateSceneStream;

/** Optional helper component */
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
    generateScene(prompt, (upstream) => {
      const payload = extractAndNormalizeAiResponse(upstream);
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

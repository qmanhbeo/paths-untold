// src/services/llmClient.js
import { API_BASE, LLM_MODEL } from '../config/env';

function withTimeout(ms = 30000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(id) };
}

/** Low-level chat call to your proxy; returns the upstream JSON as-is. */
export async function chat(prompt, options = {}) {
  const model = options.model || LLM_MODEL;
  const { signal, clear } = withTimeout(30000);
  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Proxy error ${res.status}${errText ? `: ${errText}` : ""}`);
    }
    return await res.json();
  } finally {
    clear();
  }
}

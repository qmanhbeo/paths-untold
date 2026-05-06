const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai';

// ---- OpenAI Config ----
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const UPSTREAM_URL = process.env.UPSTREAM_URL || 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.MODEL || 'gpt-4o-mini';
const MAX_COMPLETION_TOKENS = Number(
  process.env.MAX_COMPLETION_TOKENS || (MODEL.startsWith('gpt-5') ? 2400 : 1600)
);
const REASONING_EFFORT =
  process.env.REASONING_EFFORT || (MODEL.startsWith('gpt-5') ? 'minimal' : '');

// ---- Google Config ----
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_MODEL = process.env.GOOGLE_MODEL || 'gemini-2.5-flash-lite';
const GOOGLE_MAX_TOKENS = Number(process.env.GOOGLE_MAX_TOKENS || 1600);

// ---- Unified Config for Health ----
const ACTIVE_MODEL = LLM_PROVIDER === 'google' ? GOOGLE_MODEL : MODEL;

// ---- Input Validation ----
import { z } from 'zod';

const ChatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string().min(1),
    })
  ).min(1),
  model: z.string().optional(),
  stream: z.boolean().optional(),
});

// ---- Shared helper ----
function extractTextContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.text?.value === 'string') return part.text.value;
        if (typeof part?.value === 'string') return part.value;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.text?.value === 'string') return content.text.value;
    if (typeof content.value === 'string') return content.value;
  }
  return '';
}

// ---- OpenAI builders ----
function buildOpenAIBody(messages, stream = false) {
  const body = {
    model: MODEL,
    messages,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    response_format: { type: 'json_object' },
  };
  if (stream) body.stream = true;
  if (REASONING_EFFORT) body.reasoning_effort = REASONING_EFFORT;
  return body;
}

function extractOpenAIResponse(data) {
  return extractTextContent(data?.choices?.[0]?.message?.content);
}

// ---- Google builders ----
function buildGoogleBody(messages, stream = false) {
  const systemMessages = messages.filter((m) => m.role === 'system');
  const nonSystemMessages = messages.filter((m) => m.role !== 'system');

  let contents = nonSystemMessages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  if (contents.length === 0 && systemMessages.length > 0) {
    return {
      contents: [{ role: 'user', parts: [{ text: systemMessages[0].content }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: GOOGLE_MAX_TOKENS,
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
      },
    };
  }

  const firstUserIdx = contents.findIndex((c) => c.role === 'user');
  if (firstUserIdx !== -1 && systemMessages.length > 0) {
    const systemPrompt = systemMessages.map((m) => m.content).join('\n\n');
    contents[firstUserIdx] = {
      role: 'user',
      parts: [{ text: systemPrompt + '\n\n' + contents[firstUserIdx].parts[0].text }],
    };
  }

  return {
    contents,
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: GOOGLE_MAX_TOKENS,
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
    },
  };
}

function extractGoogleResponse(data) {
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === 'string' ? text : '';
}

// ---- Main handler ----
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const { messages, stream: wantsStream } = parsed.data;

  try {
    if (LLM_PROVIDER === 'google') {
      return await handleGoogleChat(req, res, messages, wantsStream);
    } else {
      return await handleOpenAIChat(req, res, messages, wantsStream);
    }
  } catch (err) {
    const m = String(err || '');
    const isAbort = m.includes('AbortError') || m.includes('The operation was aborted');
    console.error('[chat] proxy failed', m);
    return res.status(isAbort ? 504 : 500).json({
      error: isAbort ? 'Upstream timeout' : 'Proxy failed',
      message: m,
    });
  }
}

// ---- OpenAI handler ----
async function handleOpenAIChat(req, res, messages, wantsStream) {
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing OPENAI_API_KEY' });
  }

  console.log('[chat] OpenAI provider', {
    model: MODEL,
    messages: messages.length,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    reasoning_effort: REASONING_EFFORT || 'default',
    stream: wantsStream ?? false,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);

  try {
    const upstreamRes = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildOpenAIBody(messages, wantsStream)),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => '');
      console.error('[chat] OpenAI upstream error', upstreamRes.status, text.slice(0, 400));
      return res.status(upstreamRes.status).json({
        error: 'Upstream error',
        status: upstreamRes.status,
        body: text,
      });
    }

    if (wantsStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = upstreamRes.body.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      } finally {
        reader.releaseLock();
      }
      res.end();
      console.log('[chat] OpenAI stream complete');
      return;
    }

    const data = await upstreamRes.json();
    const content = extractOpenAIResponse(data);
    console.log('[chat] OpenAI ok', {
      finish_reason: data?.choices?.[0]?.finish_reason ?? null,
      visible_chars: content.length,
      preview: content.slice(0, 160) || null,
      usage: data?.usage ?? null,
    });
    return res.json(data);
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ---- Google handler ----
async function handleGoogleChat(req, res, messages, wantsStream) {
  if (!GOOGLE_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing GOOGLE_API_KEY' });
  }

  const GOOGLE_API_URL =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    GOOGLE_MODEL +
    ':generateContent';

  console.log('[chat] Google provider', {
    model: GOOGLE_MODEL,
    messages: messages.length,
    max_output_tokens: GOOGLE_MAX_TOKENS,
    structured: true,
    stream: wantsStream ?? false,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);

  try {
    const upstreamRes = await fetch(GOOGLE_API_URL + '?key=' + GOOGLE_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildGoogleBody(messages, wantsStream)),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => '');
      console.error('[chat] Google upstream error', upstreamRes.status, text.slice(0, 400));
      return res.status(upstreamRes.status).json({
        error: 'Upstream error',
        status: upstreamRes.status,
        body: text,
      });
    }

    const data = await upstreamRes.json();
    const content = extractGoogleResponse(data);

    if (!content) {
      console.error('[chat] Google no content', data);
      return res.status(500).json({
        error: 'No content in Google response',
        body: JSON.stringify(data).slice(0, 400),
      });
    }

    console.log('[chat] Google ok', {
      visible_chars: content.length,
      preview: content.slice(0, 160) || null,
    });

    const normalized = {
      choices: [{ message: { content } }],
    };
    return res.json(normalized);
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}
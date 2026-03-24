import { z } from 'zod';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const UPSTREAM_URL = process.env.UPSTREAM_URL || 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.MODEL || 'gpt-4o-mini';
const MAX_COMPLETION_TOKENS = Number(
  process.env.MAX_COMPLETION_TOKENS || (MODEL.startsWith('gpt-5') ? 2400 : 1600)
);
const REASONING_EFFORT =
  process.env.REASONING_EFFORT || (MODEL.startsWith('gpt-5') ? 'minimal' : '');

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

function buildUpstreamBody(messages, stream = false) {
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing OPENAI_API_KEY' });
  }

  const { messages, stream: wantsStream } = parsed.data;

  console.log('[chat] -> upstream', {
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
      body: JSON.stringify(buildUpstreamBody(messages, wantsStream ?? false)),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => '');
      console.error('[chat] upstream error', upstreamRes.status, text.slice(0, 400));
      return res.status(upstreamRes.status).json({
        error: 'Upstream error',
        status: upstreamRes.status,
        body: text,
      });
    }

    // --- Streaming path ---
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
      console.log('[chat] stream complete');
      return;
    }

    // --- Non-streaming path ---
    const data = await upstreamRes.json();
    const content = extractTextContent(data?.choices?.[0]?.message?.content);
    console.log('[chat] ok', {
      finish_reason: data?.choices?.[0]?.finish_reason ?? null,
      visible_chars: content.length,
      preview: content.slice(0, 160) || null,
      usage: data?.usage ?? null,
    });
    return res.json(data);
  } catch (err) {
    clearTimeout(timer);
    const m = String(err || '');
    const isAbort = m.includes('AbortError') || m.includes('The operation was aborted');
    console.error('[chat] proxy failed', m);
    return res.status(isAbort ? 504 : 500).json({
      error: isAbort ? 'Upstream timeout' : 'Proxy failed',
      message: m,
    });
  }
}

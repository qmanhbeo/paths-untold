import express from 'express';
import cors from 'cors';
import { z } from 'zod';

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '1mb' }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const UPSTREAM_URL = process.env.UPSTREAM_URL || 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.MODEL || 'gpt-4o-mini';
const MAX_COMPLETION_TOKENS = Number(process.env.MAX_COMPLETION_TOKENS || (MODEL.startsWith('gpt-5') ? 2400 : 1100));
const REASONING_EFFORT =
  process.env.REASONING_EFFORT || (MODEL.startsWith('gpt-5') ? 'minimal' : '');

// ---- simple health check
app.get('/health', (req, res) => {
  res.json({ ok: true, model: MODEL });
});

// ---- input validation
const ChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system','user','assistant']),
    content: z.string().min(1)
  })).min(1),
  model: z.string().optional()
});

const DebugLogSchema = z.object({
  source: z.string().optional(),
  level: z.enum(['log', 'warn', 'error']).default('log'),
  args: z.array(z.any()).max(20).default([])
});

function buildUpstreamBody(messages) {
  const body = {
    model: MODEL,
    messages,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    response_format: { type: 'json_object' }
  };

  if (REASONING_EFFORT) {
    body.reasoning_effort = REASONING_EFFORT;
  }

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

app.post('/api/chat', async (req, res) => {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing OPENAI_API_KEY' });
  }

  const { messages } = parsed.data;

  console.log('[chat] -> upstream', {
    model: MODEL,
    messages: messages.length,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    reasoning_effort: REASONING_EFFORT || 'default'
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);

  try {
    const upstreamRes = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildUpstreamBody(messages)),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => '');
      console.error('[chat] upstream error', upstreamRes.status, text.slice(0, 400));
      return res.status(upstreamRes.status).json({
        error: 'Upstream error',
        status: upstreamRes.status,
        body: text
      });
    }

    const data = await upstreamRes.json();
    const content = extractTextContent(data?.choices?.[0]?.message?.content);
    console.log('[chat] ok', {
      finish_reason: data?.choices?.[0]?.finish_reason ?? null,
      visible_chars: content.length,
      preview: content.slice(0, 160) || null,
      usage: data?.usage ?? null
    });
    return res.json(data);
  } catch (err) {
    clearTimeout(timer);
    const m = String(err || '');
    const isAbort = m.includes('AbortError') || m.includes('The operation was aborted');
    console.error('[chat] proxy failed', m);
    return res.status(isAbort ? 504 : 500).json({
      error: isAbort ? 'Upstream timeout' : 'Proxy failed',
      message: m
    });
  }
});

app.post('/api/debug-log', (req, res) => {
  const parsed = DebugLogSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid debug log payload' });
  }

  const { source = 'web', level, args } = parsed.data;
  const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  logger(`[${source}]`, ...args);
  return res.json({ ok: true });
});

const port = Number(process.env.PORT || 5175);
const server = app.listen(port, () => {
  console.log(`[api-proxy] listening on http://localhost:${port}`);
});

function shutdown(signal) {
  console.log(`[api-proxy] shutting down (${signal})`);
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

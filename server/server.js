import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { z } from 'zod';

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '1mb' }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const UPSTREAM_URL = process.env.UPSTREAM_URL || 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.MODEL || 'gpt-4o-mini';

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

app.post('/api/chat', async (req, res) => {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing OPENAI_API_KEY' });
  }

  const { messages } = parsed.data;

  // ---- tiny debug + 15s timeout so it never hangs
  console.log('[chat] → upstream', { model: MODEL, messages: messages.length });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);

  try {
    const upstreamRes = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,          // force server model
        messages,
        temperature: 0.7,
        max_tokens: 1100,    // keep replies snappy
        response_format: { type: 'json_object' }       
      }),
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
    console.log('[chat] ✓ ok');
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

const port = Number(process.env.PORT || 5174);
app.listen(port, () => {
  console.log(`[api-proxy] listening on http://localhost:${port}`);
});

import { z } from 'zod';

const DebugLogSchema = z.object({
  source: z.string().optional(),
  level: z.enum(['log', 'warn', 'error']).default('log'),
  args: z.array(z.any()).max(20).default([]),
});

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const parsed = DebugLogSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid debug log payload' });
  }

  const { source = 'web', level, args } = parsed.data;
  const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  logger(`[${source}]`, ...args);
  return res.json({ ok: true });
}

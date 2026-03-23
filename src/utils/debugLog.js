import { API_BASE, TERMINAL_DEBUG_LOGS } from '../config/env';

function normalizeArg(arg) {
  if (arg instanceof Error) {
    return {
      name: arg.name,
      message: arg.message,
      stack: arg.stack
    };
  }

  if (
    arg == null ||
    typeof arg === 'string' ||
    typeof arg === 'number' ||
    typeof arg === 'boolean'
  ) {
    return arg;
  }

  try {
    return JSON.parse(JSON.stringify(arg));
  } catch {
    return String(arg);
  }
}

async function relay(level, args, source) {
  if (!TERMINAL_DEBUG_LOGS) return;

  try {
    await fetch(`${API_BASE}/debug-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        source,
        level,
        args: args.map(normalizeArg)
      })
    });
  } catch {
    // Ignore relay errors; browser console remains the source of truth.
  }
}

function makeLogger(level, source) {
  const browserLogger =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  return (...args) => {
    browserLogger(...args);
    relay(level, args, source);
  };
}

export function createDebugLogger(source) {
  return {
    log: makeLogger('log', source),
    warn: makeLogger('warn', source),
    error: makeLogger('error', source)
  };
}

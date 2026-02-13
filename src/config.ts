import type { Env, Config } from './types';

/** Parse comma-separated string into a Set, lowercasing values. */
function parseSet(value: string | undefined, fallback: string, lowercase = false): Set<string> {
  const raw = value || fallback;
  return new Set(
    raw
      .split(',')
      .map((v) => (lowercase ? v.trim().toLowerCase() : v.trim()))
      .filter(Boolean),
  );
}

/** Convert a string env var to a boolean. Defaults to the provided fallback. */
function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value.toLowerCase() === 'true';
}

/**
 * Parse raw Cloudflare env bindings into a strongly-typed Config.
 * Only RETELL_API_KEY and N8N_WEBHOOK_URL are required.
 */
export function parseConfig(env: Env): Config {
  return {
    retellApiKey: env.RETELL_API_KEY,
    n8nWebhookUrl: env.N8N_WEBHOOK_URL,
    allowedEvents: parseSet(env.ALLOWED_EVENTS, 'call_analyzed', true),
    allowedIps: parseSet(env.ALLOWED_IPS, '100.20.5.228'),
    apiToken: env.API_TOKEN || null,
    apiTokenHeader: (env.API_TOKEN_HEADER || 'x-api-token').toLowerCase(),
    hmacEnabled: parseBool(env.HMAC_ENABLED, true),
    ipFilterEnabled: parseBool(env.IP_FILTER_ENABLED, true),
    tokenAuthEnabled: parseBool(env.TOKEN_AUTH_ENABLED, false),
  };
}

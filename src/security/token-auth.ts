import type { Config, SecurityCheckResult } from '../types';

/**
 * Check for a custom API token header (defense-in-depth).
 *
 * This is optional — enable via TOKEN_AUTH_ENABLED=true.
 * If enabled but API_TOKEN is not set, fail closed (500).
 *
 * Returns null if valid, or a Response to short-circuit.
 */
export function checkTokenAuth(request: Request, config: Config): SecurityCheckResult {
  if (!config.apiToken) {
    console.error('TOKEN_AUTH_ENABLED is true but API_TOKEN is not set');
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const provided = request.headers.get(config.apiTokenHeader);

  if (!provided || provided !== config.apiToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null;
}

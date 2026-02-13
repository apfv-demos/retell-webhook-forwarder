import type { Config, SecurityCheckResult } from '../types';

/**
 * Check the request's source IP against the configured allowlist.
 *
 * Uses Cloudflare's `CF-Connecting-IP` header, which is set at the edge
 * and cannot be spoofed by the client.
 *
 * Returns null if allowed, or a 403 Response if blocked.
 */
export function checkIpAllowlist(request: Request, config: Config): SecurityCheckResult {
  const clientIp = request.headers.get('cf-connecting-ip');

  if (!clientIp) {
    // CF-Connecting-IP is absent in local dev (wrangler dev).
    // Allow through with a warning — IP_FILTER_ENABLED should be false locally.
    console.warn('CF-Connecting-IP header missing — likely local dev');
    return null;
  }

  if (!config.allowedIps.has(clientIp)) {
    console.log(`IP rejected: ${clientIp}`);
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null;
}

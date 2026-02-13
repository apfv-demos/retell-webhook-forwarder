import type { Env, RetellWebhookPayload } from '../types';
import { parseConfig } from '../config';
import { checkIpAllowlist } from '../security/ip-filter';
import { verifyHmac } from '../security/hmac';
import { checkTokenAuth } from '../security/token-auth';
import { forwardToN8n } from '../forwarder';

/**
 * Main webhook handler. Orchestrates:
 *   1. Read raw body (once)
 *   2. IP allowlist check
 *   3. HMAC signature verification
 *   4. Optional token auth
 *   5. JSON parse
 *   6. Event filtering
 *   7. Forward to n8n
 */
export async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const config = parseConfig(env);

  // 1. Read raw body ONCE — used for HMAC verification AND forwarding
  const rawBody = await request.text();

  // 2. IP filter
  if (config.ipFilterEnabled) {
    const ipResult = checkIpAllowlist(request, config);
    if (ipResult) return ipResult;
  }

  // 3. HMAC verification
  if (config.hmacEnabled) {
    const hmacResult = await verifyHmac(
      rawBody,
      request.headers.get('x-retell-signature'),
      config,
    );
    if (hmacResult) return hmacResult;
  }

  // 4. Token auth
  if (config.tokenAuthEnabled) {
    const tokenResult = checkTokenAuth(request, config);
    if (tokenResult) return tokenResult;
  }

  // 5. Parse JSON
  let payload: RetellWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as RetellWebhookPayload;
  } catch {
    console.error('Failed to parse JSON body');
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 6. Event filtering
  const eventType = (payload.event || '').toLowerCase();
  const callId = payload.call?.call_id || payload.chat?.chat_id || 'unknown';

  if (!config.allowedEvents.has(eventType)) {
    console.log(`Filtered: event=${eventType} call_id=${callId}`);
    return new Response(
      JSON.stringify({
        status: 'filtered',
        event: payload.event,
        message: `Event '${payload.event}' is not in the allowed list`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // 7. Forward to n8n
  console.log(`Forwarding: event=${eventType} call_id=${callId}`);
  return forwardToN8n(rawBody, config);
}

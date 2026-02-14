import type { Config } from './types';

/** Forward timeout — must be less than Retell's 10s webhook timeout. */
const FORWARD_TIMEOUT_MS = 8_000;

/**
 * Forward the raw webhook body to the configured n8n webhook URL.
 *
 * - Uses an AbortController with an 8-second timeout
 * - Returns n8n's response status back to the caller (and thus to Retell)
 * - Returns 504 on timeout, 502 on network error
 */
export async function forwardToN8n(rawBody: string, config: Config): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FORWARD_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'RetellWebhookForwarder/1.0',
    };

    // Send shared secret so n8n can verify the request came from this Worker
    if (config.n8nWebhookSecret) {
      headers['x-webhook-secret'] = config.n8nWebhookSecret;
    }

    const upstream = await fetch(config.n8nWebhookUrl, {
      method: 'POST',
      headers,
      body: rawBody,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' },
    });
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error(`Forward to n8n timed out after ${FORWARD_TIMEOUT_MS}ms`);
      return new Response(
        JSON.stringify({ error: 'Gateway Timeout', detail: 'n8n did not respond in time' }),
        { status: 504, headers: { 'Content-Type': 'application/json' } },
      );
    }

    console.error('Forward to n8n failed:', (error as Error).message);
    return new Response(
      JSON.stringify({ error: 'Bad Gateway', detail: 'Failed to reach n8n' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

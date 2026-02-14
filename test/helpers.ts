import type { Config } from '../src/types';

/** Create a Config with sensible test defaults. Override as needed. */
export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    retellApiKey: 'test-api-key',
    n8nWebhookUrl: 'https://n8n.example.com/webhook/retell',
    allowedEvents: new Set(['call_analyzed']),
    allowedIps: new Set(['100.20.5.228']),
    apiToken: null,
    apiTokenHeader: 'x-api-token',
    n8nWebhookSecret: null,
    hmacEnabled: true,
    ipFilterEnabled: true,
    tokenAuthEnabled: false,
    ...overrides,
  };
}

/**
 * Generate a valid Retell HMAC signature for testing.
 *
 * Matches the Retell SDK format: v={timestamp},d={hex_hmac_sha256}
 * where message = body + timestamp.
 */
export async function generateSignature(
  body: string,
  apiKey: string,
  timestamp?: number,
): Promise<{ signature: string; timestamp: number }> {
  const ts = timestamp ?? Date.now();
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body + ts.toString()));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return { signature: `v=${ts},d=${hex}`, timestamp: ts };
}

/** Build a minimal Request object for testing. */
export function buildRequest(
  body: string,
  headers: Record<string, string> = {},
  method = 'POST',
): Request {
  return new Request('https://worker.example.com/', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: method !== 'GET' ? body : undefined,
  });
}

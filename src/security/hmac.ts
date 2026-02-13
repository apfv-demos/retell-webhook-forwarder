import type { Config, SecurityCheckResult } from '../types';

/** Maximum age of a signature before it's considered expired. */
const SIGNATURE_FRESHNESS_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Parse the Retell signature header format: `v={timestamp},d={hex_digest}`
 * Matches the format used by the Retell TypeScript SDK.
 */
function parseSignature(header: string): { timestamp: number; digest: string } | null {
  const match = header.match(/^v=(\d+),d=([a-f0-9]+)$/);
  if (!match || !match[1] || !match[2]) return null;
  return { timestamp: parseInt(match[1], 10), digest: match[2] };
}

/** Convert a hex string to a Uint8Array. */
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Verify the Retell HMAC-SHA256 webhook signature.
 *
 * Algorithm (matching Retell SDK):
 *   message = rawBody + timestamp
 *   expected = HMAC-SHA256(message, apiKey) → hex
 *   compare with digest from header
 *
 * Uses Web Crypto API's `crypto.subtle.verify()` for constant-time comparison.
 *
 * @param rawBody  The request body as a raw string (never re-serialized)
 * @param signatureHeader  Value of the `x-retell-signature` header
 * @param config   Parsed worker config containing the API key
 * @returns null if valid, or a Response to short-circuit
 */
export async function verifyHmac(
  rawBody: string,
  signatureHeader: string | null,
  config: Config,
): Promise<SecurityCheckResult> {
  if (!signatureHeader) {
    return new Response(JSON.stringify({ error: 'Missing x-retell-signature header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = parseSignature(signatureHeader);
  if (!parsed) {
    return new Response(JSON.stringify({ error: 'Malformed signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Reject expired signatures
  if (Math.abs(Date.now() - parsed.timestamp) > SIGNATURE_FRESHNESS_MS) {
    return new Response(JSON.stringify({ error: 'Signature expired' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Import the API key as an HMAC signing key
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(config.retellApiKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  // Message = rawBody + timestamp (matching Retell SDK)
  const message = rawBody + parsed.timestamp.toString();

  // Constant-time comparison via crypto.subtle.verify
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    hexToUint8Array(parsed.digest),
    encoder.encode(message),
  );

  if (!valid) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null;
}

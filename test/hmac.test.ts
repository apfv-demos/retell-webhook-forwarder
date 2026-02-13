import { describe, it, expect } from 'vitest';
import { verifyHmac } from '../src/security/hmac';
import { testConfig, generateSignature } from './helpers';

const API_KEY = 'test-secret-key';
const BODY = '{"event":"call_analyzed","call":{"call_id":"abc123"}}';

describe('HMAC verification', () => {
  const config = testConfig({ retellApiKey: API_KEY });

  it('passes with a valid signature', async () => {
    const { signature } = await generateSignature(BODY, API_KEY);
    const result = await verifyHmac(BODY, signature, config);
    expect(result).toBeNull();
  });

  it('rejects missing signature header', async () => {
    const result = await verifyHmac(BODY, null, config);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    const json = await result!.json();
    expect(json).toHaveProperty('error', 'Missing x-retell-signature header');
  });

  it('rejects malformed signature', async () => {
    const result = await verifyHmac(BODY, 'garbage', config);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    const json = await result!.json();
    expect(json).toHaveProperty('error', 'Malformed signature');
  });

  it('rejects expired signature (>5 min old)', async () => {
    const oldTimestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago
    const { signature } = await generateSignature(BODY, API_KEY, oldTimestamp);
    const result = await verifyHmac(BODY, signature, config);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    const json = await result!.json();
    expect(json).toHaveProperty('error', 'Signature expired');
  });

  it('rejects wrong API key', async () => {
    const { signature } = await generateSignature(BODY, 'wrong-key');
    const result = await verifyHmac(BODY, signature, config);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    const json = await result!.json();
    expect(json).toHaveProperty('error', 'Invalid signature');
  });

  it('rejects tampered body', async () => {
    const { signature } = await generateSignature(BODY, API_KEY);
    const tampered = BODY.replace('abc123', 'xyz789');
    const result = await verifyHmac(tampered, signature, config);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });
});

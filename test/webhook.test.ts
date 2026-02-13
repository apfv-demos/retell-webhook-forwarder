import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env } from '../src/types';
import worker from '../src/index';
import { generateSignature } from './helpers';

/** Minimal Env for testing with security checks disabled. */
function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    RETELL_API_KEY: 'test-key',
    N8N_WEBHOOK_URL: 'https://n8n.example.com/webhook/retell',
    HMAC_ENABLED: 'false',
    IP_FILTER_ENABLED: 'false',
    TOKEN_AUTH_ENABLED: 'false',
    ...overrides,
  };
}

describe('Worker entry point', () => {
  it('returns health check on GET /health', async () => {
    const req = new Request('https://worker.example.com/health', { method: 'GET' });
    const res = await worker.fetch(req, testEnv());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('status', 'ok');
    expect(json).toHaveProperty('timestamp');
  });

  it('rejects non-POST with 405', async () => {
    const req = new Request('https://worker.example.com/', { method: 'PUT' });
    const res = await worker.fetch(req, testEnv());
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST, GET');
  });
});

describe('Event filtering', () => {
  it('filters non-allowed events with 200', async () => {
    const body = JSON.stringify({ event: 'call_started', call: { call_id: 'test1' } });
    const req = new Request('https://worker.example.com/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const res = await worker.fetch(req, testEnv());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('status', 'filtered');
    expect(json).toHaveProperty('event', 'call_started');
  });

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('https://worker.example.com/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });

    const res = await worker.fetch(req, testEnv());
    expect(res.status).toBe(400);
  });

  it('filters call_ended with 200', async () => {
    const body = JSON.stringify({ event: 'call_ended', call: { call_id: 'test2' } });
    const req = new Request('https://worker.example.com/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const res = await worker.fetch(req, testEnv());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('status', 'filtered');
  });
});

describe('HMAC integration', () => {
  it('rejects requests without signature when HMAC is enabled', async () => {
    const body = JSON.stringify({ event: 'call_analyzed', call: { call_id: 'test3' } });
    const req = new Request('https://worker.example.com/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const res = await worker.fetch(req, testEnv({ HMAC_ENABLED: 'true' }));
    expect(res.status).toBe(401);
  });

  it('accepts requests with valid signature when HMAC is enabled', async () => {
    const apiKey = 'test-key';
    const body = JSON.stringify({ event: 'call_analyzed', call: { call_id: 'test4' } });
    const { signature } = await generateSignature(body, apiKey);

    const req = new Request('https://worker.example.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-retell-signature': signature,
      },
      body,
    });

    // This will try to forward to n8n and fail (no real server), but the
    // important thing is it passes HMAC and doesn't return 401.
    const res = await worker.fetch(req, testEnv({ HMAC_ENABLED: 'true' }));
    // Should NOT be 401 (HMAC passed), will be 502 (can't reach n8n)
    expect(res.status).not.toBe(401);
  });
});

describe('Token auth integration', () => {
  it('rejects when token auth enabled but no token provided', async () => {
    const body = JSON.stringify({ event: 'call_analyzed', call: { call_id: 'test5' } });
    const req = new Request('https://worker.example.com/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const res = await worker.fetch(
      req,
      testEnv({ TOKEN_AUTH_ENABLED: 'true', API_TOKEN: 'secret-token' }),
    );
    expect(res.status).toBe(401);
  });

  it('accepts when correct token provided', async () => {
    const body = JSON.stringify({ event: 'call_started', call: { call_id: 'test6' } });
    const req = new Request('https://worker.example.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': 'secret-token',
      },
      body,
    });

    const res = await worker.fetch(
      req,
      testEnv({ TOKEN_AUTH_ENABLED: 'true', API_TOKEN: 'secret-token' }),
    );
    // Should pass auth and filter the event (call_started is not allowed)
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('status', 'filtered');
  });
});

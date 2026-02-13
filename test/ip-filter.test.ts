import { describe, it, expect } from 'vitest';
import { checkIpAllowlist } from '../src/security/ip-filter';
import { testConfig, buildRequest } from './helpers';

describe('IP filter', () => {
  const config = testConfig({ allowedIps: new Set(['100.20.5.228', '10.0.0.1']) });

  it('allows Retell IP', () => {
    const req = buildRequest('{}', { 'cf-connecting-ip': '100.20.5.228' });
    expect(checkIpAllowlist(req, config)).toBeNull();
  });

  it('allows additional configured IP', () => {
    const req = buildRequest('{}', { 'cf-connecting-ip': '10.0.0.1' });
    expect(checkIpAllowlist(req, config)).toBeNull();
  });

  it('rejects unknown IP with 403', () => {
    const req = buildRequest('{}', { 'cf-connecting-ip': '192.168.1.1' });
    const result = checkIpAllowlist(req, config);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it('allows through when CF-Connecting-IP is missing (local dev)', () => {
    const req = buildRequest('{}');
    expect(checkIpAllowlist(req, config)).toBeNull();
  });
});

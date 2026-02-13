import type { Env } from './types';
import { handleWebhook } from './handlers/webhook';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Health check
    if (request.method === 'GET' && new URL(request.url).pathname === '/health') {
      return new Response(
        JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Only POST allowed for webhooks
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', Allow: 'POST, GET' },
      });
    }

    // Webhook handler with top-level error boundary
    try {
      return await handleWebhook(request, env);
    } catch (error) {
      console.error('Unhandled error:', (error as Error).message, (error as Error).stack);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
} satisfies ExportedHandler<Env>;

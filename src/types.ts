/** Cloudflare Worker environment bindings. All values are strings. */
export interface Env {
  // Secrets (set via `wrangler secret put`)
  RETELL_API_KEY: string;
  N8N_WEBHOOK_URL: string;
  API_TOKEN?: string;

  // Variables (set in wrangler.toml [vars])
  ALLOWED_EVENTS?: string;
  ALLOWED_IPS?: string;
  API_TOKEN_HEADER?: string;
  HMAC_ENABLED?: string;
  IP_FILTER_ENABLED?: string;
  TOKEN_AUTH_ENABLED?: string;
}

/** Parsed configuration with proper types. */
export interface Config {
  retellApiKey: string;
  n8nWebhookUrl: string;
  allowedEvents: Set<string>;
  allowedIps: Set<string>;
  apiToken: string | null;
  apiTokenHeader: string;
  hmacEnabled: boolean;
  ipFilterEnabled: boolean;
  tokenAuthEnabled: boolean;
}

/** Minimal shape of a Retell webhook payload. We only inspect `event`. */
export interface RetellWebhookPayload {
  event: string;
  call?: { call_id?: string; [key: string]: unknown };
  chat?: { chat_id?: string; [key: string]: unknown };
}

/** A security check returns null on success, or a Response to short-circuit. */
export type SecurityCheckResult = Response | null;

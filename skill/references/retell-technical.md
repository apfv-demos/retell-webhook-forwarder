# Retell AI Webhook Technical Reference

Details about Retell's webhook system that Claude needs when helping users configure or troubleshoot the forwarder.

## Webhook Events

| Event | When It Fires | Typical Use |
|---|---|---|
| `call_started` | A new call begins | Real-time dashboards |
| `call_ended` | A call completes, transfers, or errors out | Immediate post-call actions |
| `call_analyzed` | Post-call analysis completes (transcript, summary, sentiment) | CRM updates, logging, follow-ups |
| `transcript_updated` | Conversation turns update during a live call | Live monitoring |
| `transfer_started` | A call transfer is initiated | Transfer tracking |
| `transfer_bridged` | A transfer successfully connects | Transfer tracking |
| `transfer_cancelled` | A transfer fails to connect | Transfer error handling |
| `transfer_ended` | The transfer leg ends | Transfer tracking |

**Most users only need `call_analyzed`** — it contains the full transcript, call analysis (summary, sentiment, custom fields), latency data, and cost breakdown.

## HMAC Signature Verification

Retell signs every webhook with HMAC-SHA256 using the account's API key.

### Header
- Name: `x-retell-signature`
- Format: `v={timestamp_ms},d={hex_hmac_sha256_digest}`
- Example: `v=1707000000000,d=a1b2c3d4e5f6...`

### Algorithm
1. Message = `rawBody` + `timestamp` (string concatenation, no separator)
2. Key = Retell API key (the same key used for the Retell REST API)
3. Signature = HMAC-SHA256(message, key) as lowercase hex
4. Compare with `d=` value from the header

### Freshness
- Timestamp is in milliseconds since Unix epoch
- The forwarder rejects signatures older than 5 minutes
- This prevents replay attacks

### Important Notes
- The raw request body must be used exactly as received — do not re-serialize JSON
- Retell's SDK and documentation confirm this format
- The forwarder uses Web Crypto API `crypto.subtle.verify()` for constant-time comparison

## Retell Webhook Source IP

- Current IP: `100.20.5.228`
- This is the single origin IP for all Retell webhook deliveries
- The forwarder checks `CF-Connecting-IP` header (set by Cloudflare, cannot be spoofed)
- If Retell adds more IPs in the future, update `ALLOWED_IPS` in `wrangler.toml`

## Retell API Keys

Retell has two types of API keys. This distinction is critical for HMAC verification:

| Type | Badge | Can verify webhooks? | Limit |
|---|---|---|---|
| Standard API key | None | No | Multiple per workspace |
| Webhook API key | Blue "Webhook" badge | Yes | Exactly one per workspace |

- Found in: Retell Dashboard > Settings > API Keys
- Format: both types start with `key_` followed by hex characters
- **Only the webhook-tagged key signs webhook requests** — using a standard key causes "Invalid signature" errors
- The webhook key cannot be deleted (Retell enforces this)
- The forwarder only uses it for HMAC verification — it never calls the Retell API
- Docs: https://docs.retellai.com/accounts/api-keys-overview

## call_analyzed Payload Structure

The `call_analyzed` event contains the richest data. Key fields:

```json
{
  "event": "call_analyzed",
  "call": {
    "call_id": "...",
    "agent_id": "...",
    "call_type": "web_call",
    "from_number": "...",
    "to_number": "...",
    "direction": "inbound",
    "start_timestamp": 1707000000000,
    "end_timestamp": 1707000060000,
    "duration_ms": 60000,
    "status": "ended",
    "disconnection_reason": "agent_goodbye",
    "transcript": "Agent: Hello...\nUser: Hi...",
    "transcript_object": [...],
    "call_analysis": {
      "call_summary": "...",
      "user_sentiment": "positive",
      "custom_analysis_data": {...}
    },
    "latency": {...},
    "call_cost": {...}
  }
}
```

The entire payload is forwarded to n8n unchanged — no fields are stripped or modified.

## Cloudflare Worker Configuration

### wrangler.toml Variables
All non-secret configuration lives in `wrangler.toml` under `[vars]`:

| Variable | Default | Description |
|---|---|---|
| `ALLOWED_EVENTS` | `call_analyzed` | Comma-separated events to forward |
| `ALLOWED_IPS` | `100.20.5.228` | Comma-separated allowed source IPs |
| `HMAC_ENABLED` | `true` | Enable HMAC signature verification |
| `IP_FILTER_ENABLED` | `true` | Enable IP allowlist |
| `TOKEN_AUTH_ENABLED` | `false` | Enable optional API token check |
| `API_TOKEN_HEADER` | `x-api-token` | Header name for optional API token |

### Secrets (encrypted, set via wrangler CLI)
| Secret | Required | Description |
|---|---|---|
| `RETELL_API_KEY` | Yes | Retell API key for HMAC verification |
| `N8N_WEBHOOK_URL` | Yes | Destination webhook URL |
| `N8N_WEBHOOK_SECRET` | Recommended | Shared secret sent as `x-webhook-secret` header |
| `API_TOKEN` | Only if TOKEN_AUTH_ENABLED=true | Custom inbound API token |

### Worker Behavior
- Forwards with 8-second timeout (Retell's webhook timeout is 10 seconds)
- Returns 504 if n8n does not respond in time
- Returns 502 if n8n is unreachable
- Filtered events get 200 response (so Retell does not retry them)
- Health check at GET `/health` returns `{"status":"ok"}`
- User-Agent sent to n8n: `RetellWebhookForwarder/1.0`

### Cloudflare Free Tier Limits
- 100,000 requests per day
- 10ms CPU time per request (more than enough for this worker)
- Zero cold starts — runs on Cloudflare's global edge network
- No credit card required for the free plan

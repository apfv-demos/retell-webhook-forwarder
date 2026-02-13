# Retell Webhook Forwarder

A lightweight Cloudflare Worker that sits between [Retell AI](https://retellai.com) and your [n8n](https://n8n.io) instance. It filters webhook events so only the ones you need (like `call_analyzed`) reach n8n — saving you execution costs.

## Why?

Retell AI sends a webhook for **every** event: `call_started`, `call_ended`, `call_analyzed`, `transfer_started`, etc. If you only care about `call_analyzed`, the other events create unnecessary n8n executions that cost money.

This forwarder:

- **Filters events** — only forwards the events you want (default: `call_analyzed`)
- **Verifies HMAC signatures** — ensures webhooks really come from Retell (n8n can't do this natively)
- **Checks IP allowlist** — only accepts requests from Retell's IP (`100.20.5.228`)
- **Optional API token** — extra authentication layer for defense-in-depth
- **Zero cold starts** — runs on Cloudflare's global edge network
- **Free tier** — 100,000 requests/day on Cloudflare's free plan

## How It Works

```
Retell AI  ──webhook──>  Cloudflare Worker  ──filtered──>  n8n
                          (this project)

  call_started   →  200 "filtered" (n8n never sees it)
  call_ended     →  200 "filtered" (n8n never sees it)
  call_analyzed  →  forwarded to n8n ✓
```

---

## Quick Start

### Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free)
- [Node.js](https://nodejs.org/) v20 or later
- Your Retell API key (from [Retell Dashboard](https://dashboard.retellai.com/) → Settings → API Keys)
- Your n8n webhook URL

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/retell-webhook-forwarder.git
cd retell-webhook-forwarder
npm install
```

### 2. Set Your Secrets

```bash
npx wrangler login          # Opens browser to authenticate with Cloudflare

npx wrangler secret put RETELL_API_KEY
# Paste your Retell API key when prompted

npx wrangler secret put N8N_WEBHOOK_URL
# Paste your n8n webhook URL when prompted
```

### 3. Deploy

```bash
npm run deploy
```

This outputs your Worker URL, something like:
```
https://retell-webhook-forwarder.YOUR_SUBDOMAIN.workers.dev
```

### 4. Update Retell

Go to your [Retell Dashboard](https://dashboard.retellai.com/) → Agent → Webhook URL and set it to your Worker URL.

That's it! Only `call_analyzed` events will reach n8n now.

---

## Deploy with GitHub Actions (Recommended)

If you want automatic deploys every time you push to `main`:

### 1. Fork this repository

Click the **Fork** button on GitHub.

### 2. Create a Cloudflare API Token

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use the **Edit Cloudflare Workers** template
4. Copy the token

### 3. Get Your Cloudflare Account ID

1. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click on any domain (or the Workers section)
3. Your Account ID is shown in the right sidebar

### 4. Add GitHub Secrets

In your forked repo, go to **Settings → Secrets and variables → Actions** and add:

| Secret Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | The API token from step 2 |
| `CLOUDFLARE_ACCOUNT_ID` | Your Account ID from step 3 |

### 5. Set Worker Secrets

You still need to set the Retell/n8n secrets on Cloudflare (one-time):

```bash
npx wrangler secret put RETELL_API_KEY
npx wrangler secret put N8N_WEBHOOK_URL
```

Or set them in the Cloudflare Dashboard → Workers → your worker → Settings → Variables and Secrets.

### 6. Push to Deploy

Every push to `main` will automatically deploy the worker.

---

## Configuration

All configuration is done through environment variables. Defaults work out of the box — you only **need** to set `RETELL_API_KEY` and `N8N_WEBHOOK_URL`.

| Variable | Required | Default | Description |
|---|---|---|---|
| `RETELL_API_KEY` | Yes | — | Your Retell API key (for HMAC verification) |
| `N8N_WEBHOOK_URL` | Yes | — | The n8n webhook URL to forward events to |
| `API_TOKEN` | No | — | Custom API token for extra authentication |
| `ALLOWED_EVENTS` | No | `call_analyzed` | Comma-separated list of events to forward |
| `ALLOWED_IPS` | No | `100.20.5.228` | Comma-separated list of allowed source IPs |
| `HMAC_ENABLED` | No | `true` | Enable/disable HMAC signature verification |
| `IP_FILTER_ENABLED` | No | `true` | Enable/disable IP allowlist filtering |
| `TOKEN_AUTH_ENABLED` | No | `false` | Enable/disable custom API token check |
| `API_TOKEN_HEADER` | No | `x-api-token` | Header name for the custom API token |

### Forwarding Multiple Events

To forward more than just `call_analyzed`, change `ALLOWED_EVENTS` in `wrangler.toml`:

```toml
[vars]
ALLOWED_EVENTS = "call_analyzed,call_ended"
```

Or set it in the Cloudflare Dashboard.

### Retell Webhook Events Reference

| Event | Description |
|---|---|
| `call_started` | A new call begins |
| `call_ended` | A call completes, transfers, or errors |
| `call_analyzed` | Call analysis is complete (transcript, summary, etc.) |
| `transcript_updated` | Conversation turns update during a call |
| `transfer_started` | A transfer is initiated |
| `transfer_bridged` | A transfer successfully connects |
| `transfer_cancelled` | A transfer fails to connect |
| `transfer_ended` | The transfer leg ends |

---

## Local Development

```bash
# Copy the example env file
cp .dev.vars.example .dev.vars

# Edit .dev.vars with your values
# (IP_FILTER_ENABLED is already set to false for local dev)

# Start the local dev server
npm run dev
```

Test with curl:

```bash
# Should return 200 "filtered" (call_started is not in allowed list)
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{"event":"call_started","call":{"call_id":"test"}}'

# Health check
curl http://localhost:8787/health
```

---

## Monitoring

View live logs from your deployed worker:

```bash
npm run logs
```

Or use `npx wrangler tail` to see real-time request logs in your terminal.

---

## Security

This worker implements three layers of security:

1. **IP Allowlist** — Only accepts requests from Retell's IP (`100.20.5.228`). Uses Cloudflare's `CF-Connecting-IP` header which cannot be spoofed.

2. **HMAC Signature Verification** — Verifies the `x-retell-signature` header using your Retell API key. This proves the webhook genuinely came from Retell and hasn't been tampered with.

3. **Custom API Token** (optional) — An additional header check for defense-in-depth. Enable with `TOKEN_AUTH_ENABLED=true` and set `API_TOKEN`.

---

## License

MIT

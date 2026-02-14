---
name: retell-webhook-forwarder
description: Deploy a Cloudflare Worker that filters and secures Retell AI webhooks before forwarding to n8n or any webhook endpoint. Saves 50-80% on n8n execution costs. Use when the user mentions Retell webhooks, n8n execution costs, filtering Retell events, too many n8n executions from Retell, HMAC verification for Retell, reducing webhook costs, deploying a Cloudflare Worker for voice AI, setting up a webhook forwarder for Retell AI, or creating a Retell webhook filter.
---

# Retell Webhook Forwarder — Deployment Skill

Guide the user through deploying a Cloudflare Worker between Retell AI and n8n. The worker filters webhook events and adds HMAC signature verification.

**Audience: Assume beginner.** Explain each step. Verify success before proceeding. If something fails, diagnose before retrying. Never leave the user stuck — always offer an alternative path.

## Phase 1: Motivation and Prerequisites

Start by explaining the cost problem:

> Retell AI sends a webhook for every event in a call's lifecycle — call_started, call_ended, call_analyzed, and more. A single call triggers at least 3 webhooks. If you only need call_analyzed (which has the transcript and analysis), the other events are wasted n8n executions.
>
> Example: 1,000 calls/month x 3 events = 3,000 n8n executions. With this forwarder, that drops to 1,000. On n8n Cloud, that can save hundreds of dollars per month.
>
> Bonus: your n8n execution log becomes much cleaner. Without the forwarder, every call creates at least 3 executions and you end up clicking through useless call_started entries trying to find the call_analyzed one that actually has the data. With the forwarder, every execution in n8n is a real, useful one.
>
> This forwarder is free — it runs on Cloudflare's free tier (100,000 requests/day). It also adds HMAC security that n8n cannot do natively.

Then check prerequisites one at a time. Ask the user to confirm each before continuing:

**1. Cloudflare account (free, no credit card needed)**
- If they do not have one: https://dash.cloudflare.com/sign-up

**2. Node.js v20 or later**
Check by running:
```bash
node -v
```
- If not installed or below v20: direct them to https://nodejs.org/ and have them download the LTS version. Wait for them to install before continuing.

**3. Retell Webhook API key**
- Found in Retell Dashboard > Settings > API Keys
- **Important**: Retell has two types of API keys. The user needs the one with the blue **"Webhook"** badge next to it — NOT a standard API key. Only the webhook key can verify HMAC signatures. There is exactly one per account.
- Starts with `key_`
- If they cannot find it: go to Settings > API Keys and look for the row that has a blue "Webhook" tag. If they only see standard keys, they may need to scroll or check that they are in the right workspace.

**4. Their n8n webhook URL**
- The full URL from an n8n Webhook node, looks like `https://your-n8n.example.com/webhook/some-uuid`
- If they have not created the webhook node yet, tell them to create a Webhook node in n8n first, copy the "Production URL", and come back
- This also works with any other HTTP endpoint (Make.com, Zapier, custom API) — not just n8n

Do NOT proceed until all four items are confirmed.

## Phase 2: Get the Code

Check if git is available:
```bash
git --version
```

**If git is available:**
```bash
git clone https://github.com/apfv-demos/retell-webhook-forwarder.git
cd retell-webhook-forwarder
```

**If git is NOT available (common on fresh Windows installs):**
Tell the user:
> No problem — open https://github.com/apfv-demos/retell-webhook-forwarder in your browser, click the green "Code" button, then "Download ZIP". Unzip it and open a terminal in that folder.

Verify the code is there:
```bash
ls package.json
```
On Windows PowerShell this may need `dir package.json` instead.

Then install dependencies:
```bash
npm install
```
Wait for completion. If errors occur, see [troubleshooting.md](references/troubleshooting.md).

## Phase 3: Authenticate with Cloudflare

```bash
npx wrangler login
```

Tell the user:
> This opens your browser to log in to Cloudflare. Authorize Wrangler when prompted, then come back to the terminal.

If the browser does not open automatically, the terminal will display a URL — tell the user to copy-paste it into their browser.

Verify authentication worked:
```bash
npx wrangler whoami
```
This should display their account name. If it fails, see [troubleshooting.md](references/troubleshooting.md).

## Phase 4: Configure Secrets

Secrets are encrypted by Cloudflare and never appear in code. Set each one interactively.

### 4a. Retell Webhook API Key
Ask the user: "Please paste your Retell **Webhook** API key (starts with `key_`)."

Remind them: this is the key with the blue **"Webhook"** badge in Retell Dashboard > Settings > API Keys. A standard API key will NOT work for HMAC verification — only the webhook-tagged key signs webhook requests.

Then run — the user types/pastes the value when prompted:
```bash
npx wrangler secret put RETELL_API_KEY
```
Tell the user to paste their key at the prompt and press Enter.

### 4b. Webhook Destination URL
Ask the user: "Please paste your n8n webhook URL (the full URL)."

```bash
npx wrangler secret put N8N_WEBHOOK_URL
```

### 4c. Webhook Secret (Recommended)
Generate a strong secret automatically — do NOT ask the user to make one up:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Show the user the generated value and tell them:
> Save this value somewhere safe — you will need it in the last step to configure n8n. I will now store it as a Cloudflare secret.

Then set it:
```bash
npx wrangler secret put N8N_WEBHOOK_SECRET
```
Tell the user to paste the generated secret at the prompt.

## Phase 5: Deploy

```bash
npm run deploy
```

The output includes the Worker URL, like:
```
https://retell-webhook-forwarder.your-subdomain.workers.dev
```

Tell the user to save this URL — it becomes their new Retell webhook endpoint.

Verify the deployment by checking the health endpoint. Try opening this in the user's browser first (most reliable cross-platform):

> Open this URL in your browser: `https://retell-webhook-forwarder.<subdomain>.workers.dev/health`
>
> You should see: `{"status":"ok","timestamp":"..."}`

If they prefer the terminal:
```bash
curl -s https://retell-webhook-forwarder.<subdomain>.workers.dev/health
```

If the health check fails, wait 30 seconds and retry (Cloudflare propagation delay). If it still fails, run `npx wrangler tail` and check for errors.

## Phase 6: Connect the Services

### 6a. Update Retell Webhook URL
Walk the user through this:
1. Open https://dashboard.retellai.com/
2. Select their Agent
3. Find the **Webhook URL** field
4. Replace the current URL with the new Worker URL
5. Save

> Your existing n8n workflow will keep working — it will just receive fewer (filtered) events now.

### 6b. Configure n8n Header Auth
If the webhook secret was set in Phase 4c, the user must configure n8n to verify it.

Walk them through step by step:
1. Open their n8n workflow
2. Click on the **Webhook** node to edit it
3. In the **Authentication** dropdown, select **Header Auth**
4. Click **Create New Credential** (or the pencil icon)
5. In the credential form:
   - **Name** field (the header name): type exactly `x-webhook-secret`
   - **Value** field: paste the secret that was generated in Phase 4c
6. Click **Save** on the credential
7. Click **Save** on the Webhook node
8. Make sure the workflow is **Active** (toggle in the top-right)

Common beginner mistake: using "Basic Auth" instead of "Header Auth", or putting the secret in the wrong field. The "Name" field is the HTTP header name, not a display name.

## Phase 7: Verify End-to-End

Tell the user:
> Let's test with a real call. The easiest way is to make a web call from the Retell dashboard.

Have the user run this in a separate terminal to watch live logs:
```bash
npx wrangler tail
```

Then tell them:
> 1. Go to your Retell Dashboard and start a quick test web call
> 2. Watch the terminal — you should see `call_started` and `call_ended` logged as "filtered"
> 3. After the call ends, `call_analyzed` should appear as "forwarding"
> 4. Check n8n — the webhook execution should show the full call data

If `call_analyzed` does not arrive in n8n, check the wrangler tail output for error codes. See [troubleshooting.md](references/troubleshooting.md) for diagnosis.

## Completion

When everything works, summarize for the user:

> Setup complete! Here is what is running:
>
> - **Worker URL**: (their URL)
> - **Events forwarded**: call_analyzed (everything else is filtered)
> - **Security**: IP allowlist + HMAC verification + webhook secret
> - **Cost**: Free (Cloudflare free tier, 100k requests/day)
> - **Monitoring**: `npx wrangler tail` for live logs, `/health` for uptime
>
> With only call_analyzed reaching n8n, your execution count drops by roughly 65-70% — that is real money saved every month.

**Optional customization**: If the user also needs `call_ended` or other events, show them how to edit `ALLOWED_EVENTS` in `wrangler.toml` and redeploy with `npm run deploy`. Available events are listed in [retell-technical.md](references/retell-technical.md).

## Error Handling

At any step, if something fails, consult [troubleshooting.md](references/troubleshooting.md) before asking the user to retry. Common issues are covered there including: Node.js/npm problems, wrangler auth failures, deployment errors, HMAC issues, n8n connectivity, and Windows-specific quirks.

# Troubleshooting Reference

Common issues when deploying the Retell Webhook Forwarder, with diagnosis and fixes.

## Prerequisites

### "node: command not found" / "node is not recognized"
Node.js is not installed.
- Windows/macOS: Download v20 LTS from https://nodejs.org/
- Linux: `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt-get install -y nodejs`
- After installing, restart the terminal before retrying

### Node version below v20
Run `node -v`. If below v20:
- Windows: Download latest v20 LTS installer from nodejs.org (overwrites in-place)
- macOS: `brew install node@20`
- Linux: `nvm install 20`

### "git: command not found"
Git is not installed. Two options:
- Install git: https://git-scm.com/downloads
- Or skip git entirely: download the ZIP from the GitHub repo page (green "Code" button > "Download ZIP")

### "npm: command not found"
npm comes with Node.js. If Node.js is installed but npm is missing, reinstall Node.js from nodejs.org.

## npm Install Issues

### EACCES permission error
Do NOT use `sudo npm install`. Instead:
- Windows: Run terminal as Administrator
- macOS/Linux: Fix npm permissions — https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally

### Network errors during npm install
- Check internet connection
- Corporate proxy: `npm config set proxy http://proxy:port`
- Clear cache: `npm cache clean --force && npm install`

### "unsupported engine" warnings
These are warnings, not errors. npm still installs successfully. The worker will work fine. The user can safely ignore these.

## Wrangler / Cloudflare Issues

### "npx wrangler login" does not open browser
The terminal displays a URL. The user can copy-paste it into a browser manually. This is normal on headless systems or WSL.

### "Authentication error" on deploy
Run `npx wrangler whoami`. If it fails:
```bash
npx wrangler login
```
Re-authenticate and try deploying again.

### Worker naming conflict
If the user already has a worker named `retell-webhook-forwarder`, they can rename it in `wrangler.toml`:
```toml
name = "my-retell-forwarder"
```

### Deploy succeeds but health check fails
1. Wait 30 seconds — Cloudflare has a short propagation delay
2. Verify the URL (copy it exactly from the deploy output)
3. Try opening `/health` in a browser instead of curl
4. Run `npx wrangler tail` and retry to see logs
5. Check Cloudflare Dashboard > Workers > verify worker is listed and active

### "could not resolve host" when deploying
DNS/network issue. Check connectivity. If on a VPN, try disconnecting temporarily.

## Secret Configuration Issues

### "Missing required environment variable"
A required secret was not set. Check which secrets exist:
```bash
npx wrangler secret list
```
Both `RETELL_API_KEY` and `N8N_WEBHOOK_URL` must be present.

### Pasting secrets did not work
When `wrangler secret put` prompts for input:
- Paste the value and press Enter
- The input is hidden (no characters appear) — this is normal
- If the secret contains special characters, this interactive method handles them correctly

### Secrets set but worker still fails
Secrets take effect immediately — no redeploy needed. If still failing:
1. Run `npx wrangler tail` to see the exact error
2. Re-set the secret: `npx wrangler secret put RETELL_API_KEY`

## HMAC Verification Failures

### "Missing x-retell-signature header"
The request did not come from Retell, or a proxy stripped headers.
- Verify Retell's webhook URL points to the Worker (not directly to n8n)
- Check for intermediate proxies modifying headers

### "Signature expired"
The signature has a 5-minute freshness window. Rare in production. If it persists:
- Verify the correct Retell API key is set (re-set it to be sure)

### "Invalid signature"
Wrong Retell API key. The `RETELL_API_KEY` must match Retell Dashboard > Settings > API Keys exactly.
```bash
npx wrangler secret put RETELL_API_KEY
```

## IP Filter Issues

### "Forbidden" (403) for legitimate Retell webhooks
Retell's webhook IP is `100.20.5.228`. If Retell has changed their IP:
1. Check Retell docs for updated IPs
2. Update `ALLOWED_IPS` in `wrangler.toml`
3. Redeploy: `npm run deploy`

### Temporarily disable IP filtering for debugging
Edit `wrangler.toml`:
```toml
[vars]
IP_FILTER_ENABLED = "false"
```
Redeploy, debug, then re-enable.

## n8n Not Receiving Webhooks

### Check the Worker logs first
```bash
npx wrangler tail
```
This shows every request including the HTTP status code from n8n.

### n8n returns 401 or 403
Header Auth is misconfigured. Common mistakes:
- Used "Basic Auth" instead of "Header Auth" in the Webhook node
- Header name must be exactly `x-webhook-secret` (lowercase, hyphens, no spaces)
- The value must match the secret from Phase 4c exactly — no extra spaces or newlines
- In n8n, the "Name" field in the Header Auth credential is the HTTP header name, not a display name

### n8n returns 404
Wrong webhook URL. The path must match the Webhook node's URL. Verify:
- The n8n workflow is active (toggle in top-right)
- The Webhook node uses "Production URL" not "Test URL"
- The URL path has not changed (re-creating a Webhook node generates a new UUID)

### n8n returns 500
Workflow error inside n8n. Check n8n's execution log for the specific error.

### n8n webhook URL changed
If the URL changed (e.g., node was re-created), update the secret:
```bash
npx wrangler secret put N8N_WEBHOOK_URL
```
No redeploy needed.

## Windows-Specific Issues

### "ls: command not found" in PowerShell
Use `dir` instead of `ls`, or use `Get-ChildItem`.

### curl not available
Open the health check URL in a browser instead. Or use PowerShell:
```powershell
Invoke-WebRequest -Uri "https://your-worker.workers.dev/health" | Select-Object -ExpandProperty Content
```

### Execution policy blocks npx
Run PowerShell as Administrator and execute:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Line ending warnings from git
Harmless. Git is converting line endings between Unix (LF) and Windows (CRLF). The worker works fine regardless.

## General Debugging

### Live request logs
```bash
npx wrangler tail
```
Shows real-time logs from the deployed worker. Every request logs its event type, action (filtered/forwarded), and any errors.

### Local testing without a real Retell call
1. Copy `.dev.vars.example` to `.dev.vars`
2. Fill in values, set `HMAC_ENABLED=false` and `IP_FILTER_ENABLED=false`
3. Run `npm run dev`
4. Test with:
```bash
curl -X POST http://localhost:8787 -H "Content-Type: application/json" -d "{\"event\":\"call_analyzed\",\"call\":{\"call_id\":\"test\"}}"
```

# CI/CD Setup — GitHub Actions → VPS Deployment

This guide covers the one-time setup needed to enable automatic deployments from GitHub to your Ubuntu VPS at `72.62.125.235`.

---

## How It Works

```
git push to main
      │
      ▼
GitHub Actions
      ├── Run unit tests (app, staff-app, api) ── if FAIL → stop
      └── Deploy (only if all tests pass)
            └── SSH into VPS
                  ├── git pull origin main
                  └── docker compose up -d --build
```

The `.env` file lives **only on the VPS** and is never committed to git.

---

## Step 1 — One-Time VPS Server Setup

SSH into your server:

```bash
ssh root@72.62.125.235
```

### Install Docker

```bash
curl -fsSL https://get.docker.com | sh
```

### Clone the repository

```bash
cd /root
git clone https://github.com/kmavillanosa/chair-rental.git
cd chair-rental
```

### Create the `.env` file

```bash
nano .env
```

Fill in all variables. See [VPS_SETUP.md](VPS_SETUP.md) for the full variable reference and an example `.env`.

Use these commands to generate strong secrets:

```bash
openssl rand -base64 32   # for passwords
openssl rand -base64 48   # for JWT_SECRET
```

### Get TLS certificates (recommended: Hostinger API mode)

```bash
DOMAIN=rentalbasic.com EMAIL=you@rentalbasic.com DNS_PROVIDER=hostinger HOSTINGER_API_TOKEN=your_hostinger_api_token bash nginx/certbot-init.sh
```

Get your Hostinger token from: `https://hpanel.hostinger.com/profile/api`

Fallback manual mode (interactive TXT prompts):

```bash
DOMAIN=rentalbasic.com EMAIL=you@rentalbasic.com DNS_PROVIDER=manual bash nginx/certbot-init.sh
```

### Start the stack

```bash
docker compose up -d --build
docker compose ps
```

### Disable DB auto-sync after first boot

After TypeORM creates all tables on first run, edit `.env`:

```
DB_SYNC=false
```

Then restart the API:

```bash
docker compose up -d api
```

---

## Step 2 — Generate a Deploy SSH Key

**On the VPS**, create a dedicated key pair for GitHub Actions (no passphrase):

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_deploy -N ""
```

Authorize it to log into the server:

```bash
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
```

Print the private key — you'll need to copy this in the next step:

```bash
cat ~/.ssh/github_deploy
```

---

## Step 3 — Add GitHub Secrets

In your GitHub repo go to:
**Settings → Secrets and variables → Actions → New repository secret**

Add the following base secrets:

| Secret Name | Value |
|---|---|
| `VPS_HOST` | `72.62.125.235` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | Full contents of `~/.ssh/github_deploy` (include the `-----BEGIN...` and `-----END...` lines) |

For automated TLS with Hostinger DNS API, also add:

| Secret Name | Value |
|---|---|
| `TLS_AUTO_PROVISION` | `true` |
| `CERTBOT_DOMAIN` | `rentalbasic.com` |
| `CERTBOT_EMAIL` | Your Let's Encrypt email |
| `HOSTINGER_API_TOKEN` | Hostinger API token from hPanel |
| `HOSTINGER_ZONE` | `rentalbasic.com` |
| `HOSTINGER_DNS_TTL` | `60` |
| `HOSTINGER_DNS_PROPAGATION_SECONDS` | `60` |
| `HOSTINGER_API_BASE_URL` | `https://developers.hostinger.com` |

If you want to disable CI-driven certificate provisioning, set `TLS_AUTO_PROVISION` to `false`.

---

## Step 4 — Push to Trigger the Pipeline

The workflow file is already in place at `.github/workflows/deploy.yml`.

Push it to `main` to activate:

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add deploy workflow"
git push origin main
```

Then watch the run in the **Actions** tab of your GitHub repo.

---

## Workflow Summary

| Trigger | Branch | What happens |
|---|---|---|
| `push` | `main` / `master` | Tests run → if pass, SSH deploy |
| `pull_request` | any | Tests run only (no deploy) |

---

## Troubleshooting

### SSH permission denied
- Make sure the public key is in `~/.ssh/authorized_keys` on the VPS
- Make sure the private key in GitHub Secrets has no extra whitespace or newlines

### Docker compose not found
```bash
# On VPS, verify:
docker compose version
```

### Tests failing before deploy
Check the **Actions** tab logs. Fix the failing test locally, then push again.

### Container not updating after deploy
```bash
# On VPS, manually force a rebuild:
cd /root/chair-rental
docker compose up -d --build
```

### Check live container logs
```bash
docker compose logs -f api
docker compose logs -f nginx_proxy
```

### Hostinger API token or DNS errors in deploy logs
- Verify `HOSTINGER_API_TOKEN` is valid in GitHub Secrets.
- Verify `HOSTINGER_ZONE` matches the DNS zone (example: `rentalbasic.com`).
- Keep `TLS_AUTO_PROVISION=true` only when those secrets are configured.

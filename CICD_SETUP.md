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

### Get TLS certificates (run once)

```bash
DOMAIN=rentalbasic.com EMAIL=you@rentalbasic.com bash nginx/certbot-init.sh
```

> The script will pause and ask you to add a DNS TXT record at your registrar. Add it, wait ~60 seconds, then press Enter to continue.

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

Add the following three secrets:

| Secret Name | Value |
|---|---|
| `VPS_HOST` | `72.62.125.235` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | Full contents of `~/.ssh/github_deploy` (include the `-----BEGIN...` and `-----END...` lines) |

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

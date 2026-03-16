# RentalBasic — VPS Deployment Guide

Complete step-by-step guide for deploying the RentalBasic platform to a production VPS with HTTPS, vendor subdomains, and automatic certificate renewal.

---

## Architecture Overview

```
rentalbasic.com              → Customer storefront (React PWA)
vendors.rentalbasic.com      → Vendor / Admin dashboard (React)
api.rentalbasic.com          → NestJS REST API
<slug>.rentalbasic.com       → Individual vendor shop (e.g. juans-rentals.rentalbasic.com)
```

All traffic enters through a single **nginx reverse proxy** container on ports 80 and 443. Port 80 redirects to HTTPS. Wildcard TLS from Let's Encrypt covers all subdomains automatically.

```
                  ┌─────────────────────────────────────────────────┐
Internet ──80/443─► nginx_proxy  ─── api.rentalbasic.com  ──► api:3000
                  │              ─── vendors.rentalbasic.com ─► staff_app:80
                  │              ─── *.rentalbasic.com       ─► app:80
                  └─────────────────────────────────────────────────┘
```

---

## Prerequisites

On your VPS:
- Ubuntu 22.04 / Debian 12 (or any Linux with Docker support)
- Minimum 1 vCPU, 1 GB RAM (2 GB+ recommended)
- Ports **80** and **443** open in your firewall / security group
- A domain pointed at your server's IP (see DNS section below)

---

## Step 1 — Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # allow your user to run docker without sudo
newgrp docker

# Verify
docker --version
docker compose version
```

---

## Step 2 — DNS Records

At your domain registrar (wherever `rentalbasic.com` is managed), add these records.  
Replace `<SERVER_IP>` with your VPS public IP address.

| Type | Name      | Value          | TTL |
|------|-----------|----------------|-----|
| A    | `@`       | `<SERVER_IP>`  | 300 |
| A    | `www`     | `<SERVER_IP>`  | 300 |
| A    | `api`     | `<SERVER_IP>`  | 300 |
| A    | `vendors` | `<SERVER_IP>`  | 300 |
| A    | `*`       | `<SERVER_IP>`  | 300 |

> The wildcard `*` record covers every vendor's subdomain (e.g. `juans-rentals.rentalbasic.com`) automatically — no manual DNS entry needed per vendor.

Wait for DNS to propagate before continuing. You can check with:
```bash
dig +short rentalbasic.com
dig +short kmavillanosa.rentalbasic.com
```

---

## Step 3 — Clone the Repository

```bash
git clone https://github.com/kmavillanosa/chair-rental.git
cd chair-rental
```

---

## Step 4 — Configure Environment Variables

Copy the root `.env` template and fill in every value:

```bash
cp .env.example .env   # or: nano .env
```

### Full Variable Reference

#### 🗄️ Database

| Variable | Purpose | How to get it |
|---|---|---|
| `MYSQL_ROOT_PASSWORD` | MySQL root password | `openssl rand -base64 32` |
| `MYSQL_DATABASE` | Database name | e.g. `chair_rental` |
| `MYSQL_USER` | App DB user (non-root) | e.g. `rentalbasic` |
| `MYSQL_PASSWORD` | App DB user password | `openssl rand -base64 32` |
| `DB_HOST` | MySQL hostname | `mysql` (Docker service name) |
| `DB_PORT` | MySQL port | `3306` |
| `DB_NAME` | Same as `MYSQL_DATABASE` | Same value |
| `DB_USER` | Same as `MYSQL_USER` | Same value |
| `DB_PASSWORD` | Same as `MYSQL_PASSWORD` | Same value |
| `DB_SYNC` | Auto-sync TypeORM schema | `true` on first deploy, then **`false`** |

#### 🔐 JWT

| Variable | Purpose | How to get it |
|---|---|---|
| `JWT_SECRET` | Signs and verifies auth tokens | `openssl rand -base64 48` |
| `JWT_EXPIRY` | Token lifetime | `7d` |

#### 🔑 Google OAuth

| Variable | Purpose | How to get it |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Identifies your app to Google | [console.cloud.google.com](https://console.cloud.google.com) → Credentials → OAuth 2.0 Client IDs |
| `GOOGLE_CLIENT_SECRET` | OAuth secret | Same credential page |
| `GOOGLE_CALLBACK_URL` | Post-login redirect back to API | `https://api.rentalbasic.com/auth/google/callback` |

> In the Google Cloud Console, add `https://api.rentalbasic.com/auth/google/callback` to the list of **Authorized redirect URIs** for your OAuth client.

#### 🌐 App URLs

| Variable | Purpose | Production value |
|---|---|---|
| `FRONTEND_URL` | Customer app (CORS + OAuth redirect) | `https://rentalbasic.com` |
| `STAFF_FRONTEND_URL` | Vendor/admin app (CORS + OAuth redirect) | `https://vendors.rentalbasic.com` |
| `VITE_API_URL` | API URL baked into frontends at build time | `https://api.rentalbasic.com` |
| `VITE_CUSTOMER_APP_URL` | Customer app URL baked into staff-app | `https://rentalbasic.com` |
| `VENDOR_DOMAIN` | Root domain for vendor subdomain detection | `rentalbasic.com` |

#### 📧 Email (Gmail SMTP)

| Variable | Purpose | How to get it |
|---|---|---|
| `GMAIL_USER` | Gmail address for system emails | Your Gmail address |
| `GMAIL_APP_PASSWORD` | App-specific password (not your login password) | [myaccount.google.com](https://myaccount.google.com) → Security → 2-Step Verification → **App passwords** |

#### 💳 PayMongo (Split Payments)

| Variable | Purpose | How to get it |
|---|---|---|
| `PAYMONGO_ENABLED` | Enable PayMongo checkout | `true` / `false` |
| `PAYMONGO_SECRET_KEY` | API secret key | [dashboard.paymongo.com](https://dashboard.paymongo.com) → Developers → API Keys |
| `PAYMONGO_API_BASE_URL` | PayMongo base URL | `https://api.paymongo.com/v1` |
| `PAYMONGO_PLATFORM_MERCHANT_ID` | Platform's PayMongo org ID | Dashboard → Settings → Organization |
| `PAYMONGO_DELIVERY_MERCHANT_ID` | Delivery fee recipient org ID | Same dashboard, separate sub-merchant |
| `PAYMONGO_VENDOR_ONBOARDING_ENABLED` | Auto-provision vendor merchant accounts | `false` until you have PayMongo Connect access |
| `PAYMONGO_VENDOR_ONBOARDING_REQUIRED` | Block vendor approval if onboarding fails | `false` (approval continues, failure is logged) |
| `PAYMONGO_VENDOR_ONBOARDING_URL` | Vendor onboarding API endpoint | Provided by PayMongo Connect program |
| `PAYMONGO_PAYMENT_METHOD_TYPES` | Accepted payment methods | `gcash`, `paymaya`, `card` — comma-separated |
| `PAYMONGO_SUCCESS_URL` | Redirect after successful payment | `https://rentalbasic.com/bookings?payment=success` |
| `PAYMONGO_CANCEL_URL` | Redirect after cancelled payment | `https://rentalbasic.com/bookings?payment=cancelled` |
| `PAYMONGO_SPLIT_FEE_BUFFER_BPS` | Fee rounding buffer in basis points | `300` (= 3%) |

#### 🗂️ General

| Variable | Purpose | Value |
|---|---|---|
| `PLATFORM_COMMISSION_RATE` | Platform fee per booking (decimal) | `0.10` = 10% |
| `UPLOAD_DIR` | Item image storage path (inside API container) | `/app/uploads` |
| `API_PORT` / `PORT` | NestJS listen port | `3000` |
| `PROXY_PORT` | Host port for nginx (HTTP) | `80` |

### Example Production `.env`

```dotenv
# MySQL
MYSQL_ROOT_PASSWORD=change_me_strong_password
MYSQL_DATABASE=chair_rental
MYSQL_USER=rentalbasic
MYSQL_PASSWORD=change_me_strong_password

# JWT
JWT_SECRET=change_me_48_char_random_string
JWT_EXPIRY=7d

# Google OAuth
GOOGLE_CLIENT_ID=429152063748-xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
GOOGLE_CALLBACK_URL=https://api.rentalbasic.com/auth/google/callback

# App URLs
FRONTEND_URL=https://rentalbasic.com
STAFF_FRONTEND_URL=https://vendors.rentalbasic.com
VITE_API_URL=https://api.rentalbasic.com
VITE_CUSTOMER_APP_URL=https://rentalbasic.com
VENDOR_DOMAIN=rentalbasic.com

# Email
GMAIL_USER=yourapp@gmail.com
GMAIL_APP_PASSWORD=your_app_specific_password

# Database flags
DB_HOST=mysql
DB_PORT=3306
DB_NAME=chair_rental
DB_USER=rentalbasic
DB_PASSWORD=change_me_strong_password
DB_SYNC=true

# Platform
PLATFORM_COMMISSION_RATE=0.10

# PayMongo
PAYMONGO_ENABLED=true
PAYMONGO_SECRET_KEY=sk_live_xxxx
PAYMONGO_API_BASE_URL=https://api.paymongo.com/v1
PAYMONGO_PLATFORM_MERCHANT_ID=org_xxxx
PAYMONGO_DELIVERY_MERCHANT_ID=org_xxxx
PAYMONGO_VENDOR_ONBOARDING_ENABLED=false
PAYMONGO_VENDOR_ONBOARDING_REQUIRED=false
PAYMONGO_VENDOR_ONBOARDING_URL=https://api.paymongo.com/v1/organizations
PAYMONGO_PAYMENT_METHOD_TYPES=gcash
PAYMONGO_SUCCESS_URL=https://rentalbasic.com/bookings?payment=success
PAYMONGO_CANCEL_URL=https://rentalbasic.com/bookings?payment=cancelled
PAYMONGO_SPLIT_FEE_BUFFER_BPS=300
```

---

## Step 5 — Obtain TLS Certificates (Let's Encrypt)

This must be done **once** before starting the full stack. It obtains a wildcard certificate for `rentalbasic.com` and `*.rentalbasic.com`.

```bash
DOMAIN=rentalbasic.com EMAIL=you@rentalbasic.com bash nginx/certbot-init.sh
```

The script will:
1. Generate a temporary self-signed cert so nginx can start
2. Bring up the nginx proxy
3. Run certbot in interactive DNS-01 challenge mode — **it will ask you to add a TXT record in your DNS registrar**
4. Reload nginx with the real certificate

> After completing the DNS challenge, certbot auto-renewal runs every 12 hours inside the `certbot` container — you never need to manually renew.

---

## Step 6 — Start the Stack

```bash
docker compose up -d --build
```

Verify all containers are running:

```bash
docker compose ps
```

Expected output:

```
NAME                     STATUS
chair_rental_api         Up
chair_rental_app         Up
chair_rental_certbot     Up
chair_rental_db          Up (healthy)
chair_rental_pma         Up
chair_rental_proxy       Up
chair_rental_staff_app   Up
```

---

## Step 7 — Disable Schema Auto-Sync

After the first successful start (TypeORM creates all tables), disable `DB_SYNC` to prevent accidental schema changes on restart:

```bash
# Edit .env
DB_SYNC=false

# Restart only the API container
docker compose up -d api
```

---

## Step 8 — Verify

```bash
# Customer app
curl -I https://rentalbasic.com

# Vendor/admin app
curl -I https://vendors.rentalbasic.com

# API
curl https://api.rentalbasic.com/vendors/slug/check?slug=test

# A vendor subdomain
curl -I https://kmavillanosa.rentalbasic.com
```

All should return `200 OK` with a valid `Strict-Transport-Security` header.

---

## Ongoing Operations

### View logs
```bash
docker compose logs -f api          # API logs
docker compose logs -f nginx_proxy  # Access / error logs
docker compose logs -f certbot      # Certificate renewal logs
```

### Restart a single service
```bash
docker compose restart api
```

### Deploy an update
```bash
git pull
docker compose up -d --build
```

### Database backup
```bash
docker exec chair_rental_db \
  mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" chair_rental \
  > backup_$(date +%Y%m%d).sql
```

### Access phpMyAdmin
phpMyAdmin runs on port `8080`. It is **not** exposed through nginx — access it via an SSH tunnel:
```bash
ssh -L 8080:localhost:8080 user@<SERVER_IP>
# Then open http://localhost:8080 in your browser
```

---

## Summary of Subdomains

| Subdomain | Serves | Container |
|---|---|---|
| `rentalbasic.com` | Customer storefront | `app` |
| `www.rentalbasic.com` | Customer storefront | `app` |
| `api.rentalbasic.com` | NestJS REST API | `api` |
| `vendors.rentalbasic.com` | Vendor + admin dashboard | `staff_app` |
| `*.rentalbasic.com` | Individual vendor shops | `app` |

---

## CI/CD — GitHub Actions Automatic Deployment

Once the server is running, connect GitHub Actions so every push to `main` automatically deploys.

### How it works

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

### Step A — Generate a Deploy SSH Key

**On the VPS**, generate a dedicated key pair for GitHub Actions (no passphrase):

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_deploy -N ""
```

Authorize it:

```bash
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
```

Print the private key — copy the full output for the next step:

```bash
cat ~/.ssh/github_deploy
```

---

### Step B — Add GitHub Secrets

In your GitHub repo go to:  
**Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Value |
|---|---|
| `VPS_HOST` | `72.62.125.235` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | Full contents of `~/.ssh/github_deploy` (include `-----BEGIN...` and `-----END...` lines) |

---

### Step C — Push the Workflow File

The workflow file is at `.github/workflows/deploy.yml`. Push it to activate:

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add deploy workflow"
git push origin main
```

Watch the run under the **Actions** tab in GitHub.

---

### Workflow Trigger Summary

| Trigger | Branch | What happens |
|---|---|---|
| `push` | `main` / `master` | Tests run → if pass, SSH deploy |
| `pull_request` | any | Tests run only (no deploy) |

---

### CI/CD Troubleshooting

**SSH permission denied**
- Confirm the public key is in `~/.ssh/authorized_keys` on the VPS
- Confirm the private key in GitHub Secrets has no extra whitespace

**Docker compose not found on VPS**
```bash
docker compose version
```

**Container not updating after deploy**
```bash
cd /root/chair-rental
docker compose up -d --build
```

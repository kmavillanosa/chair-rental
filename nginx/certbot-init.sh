#!/usr/bin/env bash
# =============================================================================
# certbot-init.sh  –  One-time TLS certificate bootstrap
#
# Run this ONCE on your server to obtain a wildcard Let's Encrypt certificate
# for rentalbasic.com and *.rentalbasic.com (covers all vendor subdomains).
#
# Prerequisites:
#   • docker & docker compose are installed and the stack is not yet running
#   • Your DNS is pointed at this server (A / wildcard * records)
#   • You have access to add a DNS TXT record at your registrar
#
# Usage:
#   DOMAIN=rentalbasic.com EMAIL=you@example.com bash nginx/certbot-init.sh
# =============================================================================
set -euo pipefail

DOMAIN="${DOMAIN:-rentalbasic.com}"
EMAIL="${EMAIL:-}"   # Set via env: EMAIL=you@example.com bash nginx/certbot-init.sh

if [[ -z "$EMAIL" ]]; then
  echo "ERROR: Set EMAIL before running this script."
  echo "  EMAIL=you@example.com bash nginx/certbot-init.sh"
  exit 1
fi

CERT_DIR="./nginx/certbot/conf/live/$DOMAIN"

# ── Step 1: Create a temporary self-signed cert so nginx can start ───────────
# nginx refuses to start if the ssl_certificate files don't exist yet.
if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
  echo "→ [1/4] Creating temporary self-signed certificate so nginx can start…"
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out    "$CERT_DIR/fullchain.pem" \
    -subj   "/CN=localhost" 2>/dev/null
  echo "   Temporary cert created at $CERT_DIR"
else
  echo "→ [1/4] Certificate directory already exists – skipping dummy cert."
fi

# ── Step 2: Bring nginx up (serves ACME /.well-known path on port 80) ────────
echo ""
echo "→ [2/4] Starting nginx proxy…"
docker compose up -d nginx_proxy

# ── Step 3: Request the real wildcard certificate via DNS-01 challenge ────────
# Let's Encrypt needs you to add a TXT record to prove you own the domain.
# The certbot prompt will tell you exactly what to add.
echo ""
echo "→ [3/4] Requesting wildcard certificate for $DOMAIN and *.$DOMAIN"
echo "   ⚠  You will be asked to create a DNS TXT record at your registrar."
echo "      Wait for DNS to propagate (~60 s) before pressing Enter in certbot."
echo ""

docker compose run --rm certbot certonly \
  --manual \
  --preferred-challenges dns \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" \
  -d "*.$DOMAIN"

# ── Step 4: Reload nginx with the real certificate ───────────────────────────
echo ""
echo "→ [4/4] Reloading nginx with the real certificate…"
docker compose exec nginx_proxy nginx -s reload

echo ""
echo "✓ Done! Your site is now secured with a Let's Encrypt wildcard certificate."
echo "  Automatic renewal is handled by the 'certbot' service (checks every 12 h)."
echo ""
echo "  DNS records you need at your registrar:"
echo "  ┌──────┬──────────────────────────┬───────────────────┐"
echo "  │ Type │ Name                     │ Value             │"
echo "  ├──────┼──────────────────────────┼───────────────────┤"
echo "  │ A    │ @                        │ <your-server-ip>  │"
echo "  │ A    │ www                      │ <your-server-ip>  │"
echo "  │ A    │ api                      │ <your-server-ip>  │"
echo "  │ A    │ vendors                  │ <your-server-ip>  │"
echo "  │ A    │ *                        │ <your-server-ip>  │"
echo "  └──────┴──────────────────────────┴───────────────────┘"
echo "  The wildcard * record covers all vendor shop subdomains automatically."

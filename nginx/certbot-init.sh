#!/usr/bin/env bash
# =============================================================================
# certbot-init.sh  –  TLS certificate bootstrap / reissue
#
# Run this on your server to obtain (or re-issue) a wildcard Let's Encrypt
# certificate for rentalbasic.com and *.rentalbasic.com.
#
# Prerequisites:
#   • docker & docker compose are installed and the stack is not yet running
#   • Your DNS is pointed at this server (A / wildcard * records)
#   • You have access to add a DNS TXT record at your registrar
#
# Usage:
#   DOMAIN=rentalbasic.com EMAIL=you@example.com bash nginx/certbot-init.sh
#   DOMAIN=rentalbasic.com EMAIL=you@example.com FORCE_RENEWAL=true bash nginx/certbot-init.sh
# =============================================================================
set -euo pipefail

DOMAIN="${DOMAIN:-rentalbasic.com}"
EMAIL="${EMAIL:-}"   # Set via env: EMAIL=you@example.com bash nginx/certbot-init.sh
FORCE_RENEWAL="${FORCE_RENEWAL:-false}" # Optional: FORCE_RENEWAL=true to always reissue

if [[ -z "$EMAIL" ]]; then
  echo "ERROR: Set EMAIL before running this script."
  echo "  EMAIL=you@example.com bash nginx/certbot-init.sh"
  exit 1
fi

CERT_DIR="./nginx/certbot/conf/live/$DOMAIN"
CERT_FILE="$CERT_DIR/fullchain.pem"
KEY_FILE="$CERT_DIR/privkey.pem"

is_lets_encrypt_cert() {
  local cert_file="$1"
  if [[ ! -f "$cert_file" ]]; then
    return 1
  fi

  openssl x509 -in "$cert_file" -noout -issuer 2>/dev/null | grep -qi "Let's Encrypt"
}

# ── Step 1: Create a temporary self-signed cert so nginx can start ───────────
# nginx refuses to start if the ssl_certificate files don't exist yet.
if is_lets_encrypt_cert "$CERT_FILE"; then
  echo "→ [1/4] Existing Let's Encrypt certificate found – keeping it for nginx startup."
else
  echo "→ [1/4] No Let's Encrypt certificate found (or non-LE cert detected)."
  echo "         Creating temporary self-signed certificate so nginx can start…"
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "$KEY_FILE" \
    -out    "$CERT_FILE" \
    -subj   "/CN=localhost" 2>/dev/null
  echo "   Temporary cert created at $CERT_DIR"
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

CERTBOT_ARGS=(
  certonly
  --manual
  --preferred-challenges dns
  --email "$EMAIL"
  --agree-tos
  --no-eff-email
  --cert-name "$DOMAIN"
  -d "$DOMAIN"
  -d "*.$DOMAIN"
)

if [[ "$FORCE_RENEWAL" == "true" ]]; then
  CERTBOT_ARGS+=(--force-renewal)
fi

docker compose run --rm certbot "${CERTBOT_ARGS[@]}"

# ── Step 4: Reload nginx with the real certificate ───────────────────────────
echo ""
echo "→ [4/4] Reloading nginx with the real certificate…"
docker compose exec nginx_proxy nginx -s reload

if ! is_lets_encrypt_cert "$CERT_FILE"; then
  echo ""
  echo "ERROR: Issued certificate is not from Let's Encrypt."
  echo "       Check certbot output and DNS challenge records, then re-run this script."
  exit 1
fi

echo ""
echo "✓ Done! Your site is now secured with a Let's Encrypt wildcard certificate."
echo "  IMPORTANT: Manual DNS-01 challenge certs are NOT automatically renewable."
echo "  Re-run this script before expiry (~every 60 days), or switch to a DNS API"
echo "  plugin/auth-hook flow to enable unattended renewal."
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

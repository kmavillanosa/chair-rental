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
#   • For manual mode: access to add DNS TXT records at your registrar
#   • For Hostinger mode: Hostinger API token from hPanel
#
# Usage:
#   DOMAIN=rentalbasic.com EMAIL=you@example.com bash nginx/certbot-init.sh
#   DOMAIN=rentalbasic.com EMAIL=you@example.com FORCE_RENEWAL=true bash nginx/certbot-init.sh
#   DOMAIN=rentalbasic.com EMAIL=you@example.com DNS_PROVIDER=hostinger HOSTINGER_API_TOKEN=... bash nginx/certbot-init.sh
# =============================================================================
set -euo pipefail

DOMAIN="${DOMAIN:-rentalbasic.com}"
EMAIL="${EMAIL:-}"   # Set via env: EMAIL=you@example.com bash nginx/certbot-init.sh
FORCE_RENEWAL="${FORCE_RENEWAL:-false}" # Optional: FORCE_RENEWAL=true to always reissue
DNS_PROVIDER="${DNS_PROVIDER:-manual}" # manual | hostinger
HOSTINGER_ZONE="${HOSTINGER_ZONE:-$DOMAIN}"
HOSTINGER_DNS_TTL="${HOSTINGER_DNS_TTL:-60}"
HOSTINGER_DNS_PROPAGATION_SECONDS="${HOSTINGER_DNS_PROPAGATION_SECONDS:-60}"
HOSTINGER_API_BASE_URL="${HOSTINGER_API_BASE_URL:-https://developers.hostinger.com}"

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

CERTBOT_RUN_ENV_ARGS=()

if [[ "$DNS_PROVIDER" == "hostinger" ]]; then
  if [[ -z "${HOSTINGER_API_TOKEN:-}" ]]; then
    echo "ERROR: HOSTINGER_API_TOKEN is required when DNS_PROVIDER=hostinger."
    echo "       Generate token at: https://hpanel.hostinger.com/profile/api"
    exit 1
  fi

  echo "   Using Hostinger DNS API in non-interactive mode."
  echo "   Zone: $HOSTINGER_ZONE"
  echo "   DNS propagation wait: ${HOSTINGER_DNS_PROPAGATION_SECONDS}s"

  CERTBOT_ARGS+=(
    --manual-auth-hook "python3 /work/nginx/hostinger-dns-hook.py auth"
    --manual-cleanup-hook "python3 /work/nginx/hostinger-dns-hook.py cleanup"
    --manual-public-ip-logging-ok
    --non-interactive
  )

  CERTBOT_RUN_ENV_ARGS+=(
    -e "HOSTINGER_API_TOKEN=$HOSTINGER_API_TOKEN"
    -e "HOSTINGER_ZONE=$HOSTINGER_ZONE"
    -e "HOSTINGER_DNS_TTL=$HOSTINGER_DNS_TTL"
    -e "HOSTINGER_DNS_PROPAGATION_SECONDS=$HOSTINGER_DNS_PROPAGATION_SECONDS"
    -e "HOSTINGER_API_BASE_URL=$HOSTINGER_API_BASE_URL"
  )
else
  echo "   ⚠  You will be asked to create DNS TXT record(s) at your registrar."
  echo "      Wait for DNS to propagate (~60 s) before pressing Enter in certbot."
fi

if [[ "$FORCE_RENEWAL" == "true" ]]; then
  CERTBOT_ARGS+=(--force-renewal)
fi

docker compose run --rm --entrypoint certbot "${CERTBOT_RUN_ENV_ARGS[@]}" certbot "${CERTBOT_ARGS[@]}"

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
if [[ "$DNS_PROVIDER" == "hostinger" ]]; then
  echo "  Hostinger DNS API mode is enabled; non-interactive renewals can run unattended."
  echo "  Keep HOSTINGER_API_TOKEN available in your certbot runtime environment."
else
  echo "  IMPORTANT: Manual DNS-01 challenge certs are NOT automatically renewable."
  echo "  Re-run this script before expiry (~every 60 days), or switch to DNS_PROVIDER=hostinger"
  echo "  with HOSTINGER_API_TOKEN for unattended renewal."
fi
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

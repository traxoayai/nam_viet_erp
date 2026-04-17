#!/usr/bin/env bash
#
# Setup tu dong khi doi Timo / Gmail account moi.
#
# Cach chay:
#   1. Tao file nam_viet_erp/.env.newaccount theo mau .env.newaccount.example
#   2. Chay: bash scripts/setup-new-account.sh
#
# Flow:
#   [1/7] Validate input
#   [2/7] Set Supabase secrets (GMAIL_*, PUBSUB_TOPIC)
#   [3/7] Redeploy Edge Function gmail-push-receiver
#   [4/7] Reset watch state (system_settings)
#   [5/7] Trigger renew-watch (lay historyId + expiry moi)
#   [6/7] Verify watch expiry
#   [7/7] Nhac update Portal env (TIMO_ACCOUNT_NO, TIMO_ACCOUNT_NAME)
#

set -euo pipefail

# ─── Color helpers ─────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}ℹ${NC}  $*"; }
ok()    { echo -e "${GREEN}✓${NC}  $*"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $*"; }
err()   { echo -e "${RED}✗${NC}  $*" >&2; }
step()  { echo -e "\n${BLUE}═══${NC} $* ${BLUE}═══${NC}"; }

# ─── Paths ─────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ERP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ERP_DIR/.env.newaccount"
ENV_DEV="$ERP_DIR/.env.dev"

# ─── [1/7] Validate input ──────────────────────────────────────────────────
step "[1/7] Validate input"

if [[ ! -f "$ENV_FILE" ]]; then
  err "Khong tim thay $ENV_FILE"
  echo "    Copy .env.newaccount.example -> .env.newaccount, dien gia tri moi"
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

REQUIRED_VARS=(
  GMAIL_CLIENT_ID
  GMAIL_CLIENT_SECRET
  GMAIL_REFRESH_TOKEN
  GMAIL_USER_EMAIL
  PUBSUB_TOPIC
  TIMO_ACCOUNT_NO
  TIMO_ACCOUNT_NAME
)

MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then MISSING+=("$var"); fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  err "Thieu bien: ${MISSING[*]}"
  exit 1
fi

# SUPABASE_ACCESS_TOKEN tu .env.dev (neu chua co trong env)
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" && -f "$ENV_DEV" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_DEV"; set +a
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  err "Thieu SUPABASE_ACCESS_TOKEN (dat trong .env.newaccount hoac .env.dev)"
  exit 1
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-iudkexocalqdhxuyjacu}"
GMAIL_PUSH_SECRET_VAL="${GMAIL_PUSH_SECRET:-8f28084745133470bc6bac0108791e79616f43c0}"

ok "Input hop le"
info "Gmail account: $GMAIL_USER_EMAIL"
info "Timo account:  $TIMO_ACCOUNT_NO ($TIMO_ACCOUNT_NAME)"
info "Pub/Sub topic: $PUBSUB_TOPIC"
info "Project ref:   $PROJECT_REF"

export SUPABASE_ACCESS_TOKEN

# ─── [2/7] Set Supabase secrets ────────────────────────────────────────────
step "[2/7] Set Supabase secrets"

cd "$ERP_DIR"

npx --yes supabase secrets set \
  GMAIL_CLIENT_ID="$GMAIL_CLIENT_ID" \
  GMAIL_CLIENT_SECRET="$GMAIL_CLIENT_SECRET" \
  GMAIL_REFRESH_TOKEN="$GMAIL_REFRESH_TOKEN" \
  GMAIL_USER_EMAIL="$GMAIL_USER_EMAIL" \
  PUBSUB_TOPIC="$PUBSUB_TOPIC" \
  GMAIL_PUSH_SECRET="$GMAIL_PUSH_SECRET_VAL" \
  --project-ref "$PROJECT_REF"

ok "Da set secrets"

# ─── [3/7] Redeploy Edge Function ──────────────────────────────────────────
step "[3/7] Redeploy Edge Function gmail-push-receiver"

npx --yes supabase functions deploy gmail-push-receiver \
  --project-ref "$PROJECT_REF"

ok "Deploy xong"

# ─── [4/7] Reset watch state ───────────────────────────────────────────────
step "[4/7] Reset watch state"

SUPA_API="https://${PROJECT_REF}.supabase.co"

# Can SERVICE_ROLE_KEY (tu .env.dev)
if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  err "Thieu SUPABASE_SERVICE_ROLE_KEY trong .env.dev"
  exit 1
fi

# Xoa 2 key: gmail_push_watch_expiry + gmail_push_last_history_id
for key in gmail_push_watch_expiry gmail_push_last_history_id; do
  curl -sS -X DELETE \
    "${SUPA_API}/rest/v1/system_settings?key=eq.${key}" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Prefer: return=minimal" > /dev/null
  info "  - Deleted system_settings[$key]"
done

ok "Watch state da reset"

# ─── [5/7] Trigger renew-watch ─────────────────────────────────────────────
step "[5/7] Trigger renew-watch"

RENEW_URL="${SUPA_API}/functions/v1/gmail-push-receiver"
RESPONSE=$(curl -sS -X POST "$RENEW_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "x-gmail-push-secret: ${GMAIL_PUSH_SECRET_VAL}" \
  -d '{"action":"renew-watch"}')

echo "$RESPONSE" | head -c 500
echo ""

if echo "$RESPONSE" | grep -q '"status":"watch_renewed"'; then
  ok "Watch renewed"
else
  err "Renew-watch FAIL. Response: $RESPONSE"
  exit 1
fi

# ─── [6/7] Verify watch expiry ─────────────────────────────────────────────
step "[6/7] Verify watch expiry"

VERIFY=$(curl -sS \
  "${SUPA_API}/rest/v1/system_settings?key=eq.gmail_push_watch_expiry&select=value" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")

echo "$VERIFY"

EXPIRY=$(echo "$VERIFY" | grep -oE '"value":"?[0-9]+' | grep -oE '[0-9]+' | head -1)
NOW_MS=$(($(date +%s) * 1000))

if [[ -n "$EXPIRY" && "$EXPIRY" -gt "$NOW_MS" ]]; then
  DAYS=$(( (EXPIRY - NOW_MS) / 86400000 ))
  ok "Watch con $DAYS ngay (expiry: $EXPIRY)"
else
  warn "Khong verify duoc expiry. Check thu cong tai Supabase dashboard."
fi

# ─── [7/7] Nhac update Portal env ─────────────────────────────────────────
step "[7/7] Portal env — CAN UPDATE THU CONG"

cat <<EOF
Vao ${YELLOW}duoc-pham-web-portal/.env.production${NC} (hoac Vercel Dashboard) cap nhat:

  NEXT_PUBLIC_TIMO_ACCOUNT_NO=${TIMO_ACCOUNT_NO}
  NEXT_PUBLIC_TIMO_ACCOUNT_NAME=${TIMO_ACCOUNT_NAME}

Sau do redeploy Portal.

EOF

ok "Setup hoan tat!"
echo ""
info "Next: test chuyen khoan voi noi dung 'SO-xxxxx-xxxx' de verify matching."

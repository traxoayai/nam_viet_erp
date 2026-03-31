#!/bin/bash
# =====================================================
# Nam Viet ERP - Production Migration Deploy Script
# =====================================================
# Usage: ./supabase/deploy_migrations.sh
#
# Prerequisites:
#   - Supabase CLI installed (npx supabase)
#   - SUPABASE_DB_URL or connected project
#   - pg_dump available (for backup)
#
# What this script does:
#   1. Backup production DB (schema + data)
#   2. Test migrations on schema-only copy (dry run)
#   3. Apply migrations to production
#   4. Verify post-migration
#
# Rollback: Restore from backup file created in step 1
# =====================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/production_backup_${TIMESTAMP}.sql"
SCHEMA_BACKUP="${BACKUP_DIR}/schema_only_${TIMESTAMP}.sql"

echo -e "${YELLOW}=== Nam Viet ERP Migration Deploy ===${NC}"
echo "Timestamp: ${TIMESTAMP}"
echo ""

# ---- STEP 0: Check prerequisites ----
echo -e "${YELLOW}[0/5] Checking prerequisites...${NC}"
mkdir -p "${BACKUP_DIR}"

if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}ERROR: pg_dump not found. Install PostgreSQL client tools.${NC}"
    echo "  Windows: choco install postgresql"
    echo "  Mac: brew install postgresql"
    exit 1
fi

# Get DB connection string
if [ -z "${SUPABASE_DB_URL:-}" ]; then
    echo -e "${YELLOW}SUPABASE_DB_URL not set.${NC}"
    echo "Enter production DB connection string:"
    echo "  Format: postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
    read -r SUPABASE_DB_URL
fi

echo -e "${GREEN}Prerequisites OK${NC}"
echo ""

# ---- STEP 1: Backup ----
echo -e "${YELLOW}[1/5] Backing up production database...${NC}"
echo "  This may take a few minutes for large databases."

# Schema-only backup (fast, ~1MB)
echo "  Creating schema backup..."
pg_dump "${SUPABASE_DB_URL}" --schema-only --no-owner --no-acl \
    -f "${SCHEMA_BACKUP}" 2>&1 && \
    echo -e "  ${GREEN}Schema backup: ${SCHEMA_BACKUP} ($(du -h "${SCHEMA_BACKUP}" | cut -f1))${NC}"

# Full backup (slower for large DBs, but essential for rollback)
echo "  Creating full backup (schema + data)..."
echo "  For 2-3GB databases this may take 5-15 minutes."
pg_dump "${SUPABASE_DB_URL}" --no-owner --no-acl \
    -f "${BACKUP_FILE}" 2>&1 && \
    echo -e "  ${GREEN}Full backup: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))${NC}"

echo ""

# ---- STEP 2: Dry run (schema-only test) ----
echo -e "${YELLOW}[2/5] Dry run - testing migrations on schema copy...${NC}"
echo "  This validates SQL syntax and schema compatibility."

# Create temp DB for testing
TEMP_DB="namviet_migration_test_${TIMESTAMP}"
psql "${SUPABASE_DB_URL}" -c "CREATE DATABASE ${TEMP_DB};" 2>/dev/null || true
TEMP_URL=$(echo "${SUPABASE_DB_URL}" | sed "s|/postgres$|/${TEMP_DB}|")

# Restore schema-only to temp DB
psql "${TEMP_URL}" < "${SCHEMA_BACKUP}" 2>/dev/null

# Apply migrations to temp DB
MIGRATION_FILES=(
    "supabase/migrations/20260325000001_001_infrastructure.sql"
    "supabase/migrations/20260325000001_002_business_logic.sql"
    "supabase/migrations/20260325000001_003_misc.sql"
)

DRY_RUN_OK=true
for f in "${MIGRATION_FILES[@]}"; do
    echo -n "  Applying ${f}... "
    if psql "${TEMP_URL}" -f "${f}" > /dev/null 2>&1; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
        DRY_RUN_OK=false
        # Show error detail
        psql "${TEMP_URL}" -f "${f}" 2>&1 | tail -5
    fi
done

# Cleanup temp DB
psql "${SUPABASE_DB_URL}" -c "DROP DATABASE IF EXISTS ${TEMP_DB};" 2>/dev/null || true

if [ "${DRY_RUN_OK}" = false ]; then
    echo -e "${RED}Dry run FAILED. Fix migration errors before deploying.${NC}"
    echo "Backup preserved at: ${BACKUP_FILE}"
    exit 1
fi

echo -e "${GREEN}Dry run passed!${NC}"
echo ""

# ---- STEP 3: Confirm ----
echo -e "${YELLOW}[3/5] Ready to apply migrations to PRODUCTION.${NC}"
echo ""
echo "  Files to apply:"
for f in "${MIGRATION_FILES[@]}"; do
    echo "    - ${f} ($(wc -l < "${f}") lines)"
done
echo ""
echo "  Backup: ${BACKUP_FILE}"
echo ""
echo -e "${RED}WARNING: This will modify the production database.${NC}"
read -p "  Type 'DEPLOY' to continue: " CONFIRM

if [ "${CONFIRM}" != "DEPLOY" ]; then
    echo "Aborted. No changes made."
    exit 0
fi

echo ""

# ---- STEP 4: Apply migrations ----
echo -e "${YELLOW}[4/5] Applying migrations to production...${NC}"

for f in "${MIGRATION_FILES[@]}"; do
    echo -n "  Applying ${f}... "
    if psql "${SUPABASE_DB_URL}" -f "${f}" 2>&1 | tail -1; then
        echo -e "  ${GREEN}OK${NC}"
    else
        echo -e "  ${RED}FAILED${NC}"
        echo ""
        echo -e "${RED}=== MIGRATION FAILED ===${NC}"
        echo "To rollback, run:"
        echo "  psql \"\${SUPABASE_DB_URL}\" < ${BACKUP_FILE}"
        exit 1
    fi
done

echo ""

# ---- STEP 5: Verify ----
echo -e "${YELLOW}[5/5] Post-migration verification...${NC}"

# Check key functions exist
FUNCTIONS_TO_CHECK=(
    "check_rpc_access"
    "create_sales_order"
    "confirm_purchase_costing"
    "_deduct_stock_fefo"
    "approve_user"
    "match_products_from_excel"
)

ALL_OK=true
for func in "${FUNCTIONS_TO_CHECK[@]}"; do
    COUNT=$(psql "${SUPABASE_DB_URL}" -t -c \
        "SELECT COUNT(*) FROM pg_proc WHERE proname = '${func}';" 2>/dev/null | tr -d ' ')
    if [ "${COUNT}" -gt 0 ]; then
        echo -e "  ${GREEN}✓${NC} ${func}"
    else
        echo -e "  ${RED}✗${NC} ${func} MISSING"
        ALL_OK=false
    fi
done

# Check key tables
TABLES_TO_CHECK=("rpc_access_rules" "rpc_rate_log")
for tbl in "${TABLES_TO_CHECK[@]}"; do
    EXISTS=$(psql "${SUPABASE_DB_URL}" -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '${tbl}';" 2>/dev/null | tr -d ' ')
    if [ "${EXISTS}" -gt 0 ]; then
        echo -e "  ${GREEN}✓${NC} table ${tbl}"
    else
        echo -e "  ${RED}✗${NC} table ${tbl} MISSING"
        ALL_OK=false
    fi
done

# Check rpc_access_rules seed data
RULE_COUNT=$(psql "${SUPABASE_DB_URL}" -t -c \
    "SELECT COUNT(*) FROM rpc_access_rules;" 2>/dev/null | tr -d ' ')
echo -e "  ${GREEN}✓${NC} rpc_access_rules: ${RULE_COUNT} rules"

echo ""
if [ "${ALL_OK}" = true ]; then
    echo -e "${GREEN}=== DEPLOYMENT SUCCESSFUL ===${NC}"
    echo "Backup: ${BACKUP_FILE}"
    echo ""
    echo "To rollback if issues found later:"
    echo "  psql \"\${SUPABASE_DB_URL}\" < ${BACKUP_FILE}"
else
    echo -e "${YELLOW}=== DEPLOYMENT COMPLETED WITH WARNINGS ===${NC}"
    echo "Some functions/tables missing. Check logs above."
    echo "Backup: ${BACKUP_FILE}"
fi

-- =====================================================
-- SECTION 7: Schema Changes (finance_invoices columns from 006)
-- =====================================================

-- 7a. Add missing columns
ALTER TABLE public.finance_invoices
  ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'inbound',
  ADD COLUMN IF NOT EXISTS buyer_tax_code TEXT,
  ADD COLUMN IF NOT EXISTS raw_items JSONB;

-- 7b. Make file_url nullable (outbound invoices don't have an uploaded file)
ALTER TABLE public.finance_invoices
  ALTER COLUMN file_url DROP NOT NULL,
  ALTER COLUMN file_url SET DEFAULT NULL;

-- 7c. Expand status CHECK constraint to include outbound statuses
ALTER TABLE public.finance_invoices DROP CONSTRAINT IF EXISTS finance_invoices_status_check;
ALTER TABLE public.finance_invoices ADD CONSTRAINT finance_invoices_status_check
  CHECK (status = ANY (ARRAY['draft', 'verified', 'posted', 'rejected', 'verified_outbound']));


-- =====================================================
-- SECTION 8: Indexes (from 007)
-- =====================================================

-- 8a. FEFO stock deduction queries (most frequent write path in POS/Sales)
CREATE INDEX IF NOT EXISTS idx_inventory_batches_wh_product_qty
  ON public.inventory_batches(warehouse_id, product_id)
  WHERE quantity > 0;

-- 8b. VAT inventory ledger lookups with FOR UPDATE locks
CREATE INDEX IF NOT EXISTS idx_vat_inventory_ledger_product_rate
  ON public.vat_inventory_ledger(product_id, vat_rate);

-- 8c. Fuzzy product name search (pg_trgm GIN index)
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON public.products USING gin(name public.gin_trgm_ops);

-- 8d. Sales order queries by creator
CREATE INDEX IF NOT EXISTS idx_orders_creator_id
  ON public.orders(creator_id);

-- 8e. RPC rate-limit log cleanup and lookup queries
CREATE INDEX IF NOT EXISTS idx_rpc_rate_log_lookup
  ON public.rpc_rate_log(user_id, function_name, called_at);


-- =====================================================
-- SECTION 9: RLS Policy Overrides (B2 blocker fixes from 009)
-- =====================================================

-- 9a. Inventory tables: permissive write (security enforced at RPC layer)
DROP POLICY IF EXISTS "inventory_batches_write" ON public.inventory_batches;
CREATE POLICY "inventory_batches_write" ON public.inventory_batches
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "inventory_receipts_write" ON public.inventory_receipts;
CREATE POLICY "inventory_receipts_write" ON public.inventory_receipts
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "inventory_receipt_items_write" ON public.inventory_receipt_items;
CREATE POLICY "inventory_receipt_items_write" ON public.inventory_receipt_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "vat_inventory_ledger_write" ON public.vat_inventory_ledger;
CREATE POLICY "vat_inventory_ledger_write" ON public.vat_inventory_ledger
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 9b. Permission tables: add explicit WITH CHECK (B3 fix)
DROP POLICY IF EXISTS "role_permissions_modify" ON public.role_permissions;
CREATE POLICY "role_permissions_modify" ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.user_has_permission('settings.permissions'))
  WITH CHECK (public.user_has_permission('settings.permissions'));

DROP POLICY IF EXISTS "roles_modify" ON public.roles;
CREATE POLICY "roles_modify" ON public.roles
  FOR ALL TO authenticated
  USING (public.user_has_permission('settings.permissions'))
  WITH CHECK (public.user_has_permission('settings.permissions'));

DROP POLICY IF EXISTS "permissions_modify" ON public.permissions;
CREATE POLICY "permissions_modify" ON public.permissions
  FOR ALL TO authenticated
  USING (public.user_has_permission('settings.permissions'))
  WITH CHECK (public.user_has_permission('settings.permissions'));

DROP POLICY IF EXISTS "user_roles_modify" ON public.user_roles;
CREATE POLICY "user_roles_modify" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.user_has_permission('settings.permissions'))
  WITH CHECK (public.user_has_permission('settings.permissions'));


-- =====================================================
-- SECTION 10: Seed Data (rpc_access_rules for new RPCs)
-- =====================================================

-- From file 006: VAT RPCs
INSERT INTO public.rpc_access_rules (function_name, required_permission, max_calls_per_minute, is_write, description)
VALUES ('process_vat_export_entry', 'finance.view_balance', 20, true, 'Trừ kho VAT từ HĐ xuất')
ON CONFLICT (function_name) DO UPDATE
  SET required_permission   = EXCLUDED.required_permission,
      max_calls_per_minute  = EXCLUDED.max_calls_per_minute,
      is_write              = EXCLUDED.is_write,
      description           = EXCLUDED.description;

INSERT INTO public.rpc_access_rules (function_name, required_permission, max_calls_per_minute, is_write, description)
VALUES
  ('deduct_vat_for_pos_export', NULL, 60, true, 'Trừ kho VAT (đơn lẻ)'),
  ('batch_deduct_vat_for_pos', NULL, 60, true, 'Trừ kho VAT (batch atomic)')
ON CONFLICT (function_name) DO NOTHING;

-- From file 008: cancel_purchase_order
INSERT INTO public.rpc_access_rules (function_name, required_permission, max_calls_per_minute, is_write, description)
VALUES ('cancel_purchase_order', 'purchasing.edit', 10, true, 'Huy don mua hang')
ON CONFLICT (function_name) DO NOTHING;


-- End of migration 002

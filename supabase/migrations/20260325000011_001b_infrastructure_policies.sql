-- SECTION 8: RLS Policies (ALL tables - final versions only)
-- =============================================================

-- ~~~ 8a. finance_transactions ~~~
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.finance_transactions;
DROP POLICY IF EXISTS "finance_transactions_select" ON public.finance_transactions;
DROP POLICY IF EXISTS "finance_transactions_modify" ON public.finance_transactions;

CREATE POLICY "finance_transactions_select" ON public.finance_transactions
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "finance_transactions_modify" ON public.finance_transactions
  FOR ALL USING (public.user_has_permission('finance.view_balance'));

-- ~~~ 8b. finance_invoices ~~~
DROP POLICY IF EXISTS "Staff full access invoices" ON public.finance_invoices;
DROP POLICY IF EXISTS "finance_invoices_select" ON public.finance_invoices;
DROP POLICY IF EXISTS "finance_invoices_modify" ON public.finance_invoices;
DROP POLICY IF EXISTS "finance_invoices_update" ON public.finance_invoices;
DROP POLICY IF EXISTS "finance_invoices_delete" ON public.finance_invoices;

CREATE POLICY "finance_invoices_select" ON public.finance_invoices
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "finance_invoices_modify" ON public.finance_invoices
  FOR INSERT WITH CHECK (public.user_has_permission('finance.view_balance'));
CREATE POLICY "finance_invoices_update" ON public.finance_invoices
  FOR UPDATE USING (public.user_has_permission('finance.view_balance'));
CREATE POLICY "finance_invoices_delete" ON public.finance_invoices
  FOR DELETE USING (public.user_has_permission('finance.view_balance'));

-- ~~~ 8c. users ~~~
DROP POLICY IF EXISTS "Allow read all users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated full access on users" ON public.users;
DROP POLICY IF EXISTS "users_select_all" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_admin" ON public.users;
DROP POLICY IF EXISTS "users_read_self_and_basic" ON public.users;
DROP POLICY IF EXISTS "users_modify_admin" ON public.users;

CREATE POLICY "users_read_self_and_basic" ON public.users
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "users_modify_admin" ON public.users
  FOR UPDATE USING (
    auth.uid() = id
    OR public.user_has_permission('admin-all')
  );

-- ~~~ 8d. roles ~~~
DROP POLICY IF EXISTS "Allow authenticated full access on roles" ON public.roles;
DROP POLICY IF EXISTS "roles_select_all" ON public.roles;
DROP POLICY IF EXISTS "roles_admin_write" ON public.roles;
DROP POLICY IF EXISTS "roles_read" ON public.roles;
DROP POLICY IF EXISTS "roles_modify" ON public.roles;

CREATE POLICY "roles_read" ON public.roles
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "roles_modify" ON public.roles
  FOR ALL USING (public.user_has_permission('settings.permissions'));

-- ~~~ 8e. permissions ~~~
DROP POLICY IF EXISTS "Allow authenticated full access on permissions" ON public.permissions;
DROP POLICY IF EXISTS "permissions_select_all" ON public.permissions;
DROP POLICY IF EXISTS "permissions_admin_write" ON public.permissions;
DROP POLICY IF EXISTS "permissions_read" ON public.permissions;
DROP POLICY IF EXISTS "permissions_modify" ON public.permissions;

CREATE POLICY "permissions_read" ON public.permissions
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "permissions_modify" ON public.permissions
  FOR ALL USING (public.user_has_permission('settings.permissions'));

-- ~~~ 8f. role_permissions ~~~
DROP POLICY IF EXISTS "Allow authenticated full access on role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_select_all" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_admin_write" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_read" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_modify" ON public.role_permissions;

CREATE POLICY "role_permissions_read" ON public.role_permissions
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "role_permissions_modify" ON public.role_permissions
  FOR ALL USING (public.user_has_permission('settings.permissions'));

-- ~~~ 8g. user_roles ~~~
DROP POLICY IF EXISTS "Allow authenticated full access on user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_all" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_write" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_read" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_modify" ON public.user_roles;

CREATE POLICY "user_roles_read" ON public.user_roles
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "user_roles_modify" ON public.user_roles
  FOR ALL USING (public.user_has_permission('settings.permissions'));

-- ~~~ 8h. orders ~~~
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.orders;
DROP POLICY IF EXISTS "orders_authenticated" ON public.orders;

CREATE POLICY "orders_authenticated" ON public.orders
  FOR ALL USING (public.is_authenticated());

-- ~~~ 8i. order_items ~~~
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.order_items;
DROP POLICY IF EXISTS "order_items_authenticated" ON public.order_items;

CREATE POLICY "order_items_authenticated" ON public.order_items
  FOR ALL USING (public.is_authenticated());

-- ~~~ 8j. purchase_orders ~~~
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.purchase_orders;
DROP POLICY IF EXISTS "po_authenticated" ON public.purchase_orders;

CREATE POLICY "po_authenticated" ON public.purchase_orders
  FOR ALL USING (public.is_authenticated());

-- ~~~ 8k. purchase_order_items ~~~
DROP POLICY IF EXISTS "Enable all for items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "po_items_authenticated" ON public.purchase_order_items;

CREATE POLICY "po_items_authenticated" ON public.purchase_order_items
  FOR ALL USING (public.is_authenticated());

-- ~~~ 8l. system_settings ~~~
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_select_all" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_admin_write" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_read" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_modify" ON public.system_settings;

CREATE POLICY "system_settings_read" ON public.system_settings
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "system_settings_modify" ON public.system_settings
  FOR ALL USING (public.user_has_permission('admin-all'));

-- ~~~ 8m. fund_accounts ~~~
DROP POLICY IF EXISTS "Allow authenticated full access on fund_accounts" ON public.fund_accounts;
DROP POLICY IF EXISTS "fund_accounts_select_all" ON public.fund_accounts;
DROP POLICY IF EXISTS "fund_accounts_admin_write" ON public.fund_accounts;

CREATE POLICY "fund_accounts_select_all" ON public.fund_accounts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "fund_accounts_admin_write" ON public.fund_accounts
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ~~~ 8n. banks ~~~
DROP POLICY IF EXISTS "Allow authenticated full access on banks" ON public.banks;
DROP POLICY IF EXISTS "banks_select_all" ON public.banks;
DROP POLICY IF EXISTS "banks_admin_write" ON public.banks;

CREATE POLICY "banks_select_all" ON public.banks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "banks_admin_write" ON public.banks
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ~~~ 8o. document_templates ~~~
DROP POLICY IF EXISTS "Allow authenticated full access on document_templates" ON public.document_templates;
DROP POLICY IF EXISTS "doc_templates_select_all" ON public.document_templates;
DROP POLICY IF EXISTS "doc_templates_admin_write" ON public.document_templates;

CREATE POLICY "doc_templates_select_all" ON public.document_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "doc_templates_admin_write" ON public.document_templates
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ~~~ 8p. transaction_categories ~~~
DROP POLICY IF EXISTS "Allow authenticated full access on transaction_categories" ON public.transaction_categories;
DROP POLICY IF EXISTS "tx_categories_select_all" ON public.transaction_categories;
DROP POLICY IF EXISTS "tx_categories_admin_write" ON public.transaction_categories;

CREATE POLICY "tx_categories_select_all" ON public.transaction_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "tx_categories_admin_write" ON public.transaction_categories
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ~~~ 8q. finance_invoice_allocations ~~~
ALTER TABLE public.finance_invoice_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.finance_invoice_allocations;
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.finance_invoice_allocations;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.finance_invoice_allocations;
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.finance_invoice_allocations;
DROP POLICY IF EXISTS "finance_invoice_allocations_read" ON public.finance_invoice_allocations;
DROP POLICY IF EXISTS "finance_invoice_allocations_write" ON public.finance_invoice_allocations;

CREATE POLICY "finance_invoice_allocations_read" ON public.finance_invoice_allocations
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "finance_invoice_allocations_write" ON public.finance_invoice_allocations
  FOR ALL TO authenticated
  USING (public.user_has_permission('finance.manage_invoices'))
  WITH CHECK (public.user_has_permission('finance.manage_invoices'));

-- ~~~ 8r. vat_inventory_ledger ~~~
ALTER TABLE public.vat_inventory_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.vat_inventory_ledger;
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.vat_inventory_ledger;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.vat_inventory_ledger;
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.vat_inventory_ledger;
DROP POLICY IF EXISTS "vat_inventory_ledger_read" ON public.vat_inventory_ledger;
DROP POLICY IF EXISTS "vat_inventory_ledger_write" ON public.vat_inventory_ledger;

CREATE POLICY "vat_inventory_ledger_read" ON public.vat_inventory_ledger
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "vat_inventory_ledger_write" ON public.vat_inventory_ledger
  FOR ALL TO authenticated
  USING (public.user_has_permission('finance.manage_invoices'))
  WITH CHECK (public.user_has_permission('finance.manage_invoices'));

-- ~~~ 8s. inventory_batches ~~~
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.inventory_batches;
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.inventory_batches;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.inventory_batches;
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.inventory_batches;
DROP POLICY IF EXISTS "inventory_batches_read" ON public.inventory_batches;
DROP POLICY IF EXISTS "inventory_batches_write" ON public.inventory_batches;

CREATE POLICY "inventory_batches_read" ON public.inventory_batches
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "inventory_batches_write" ON public.inventory_batches
  FOR ALL TO authenticated
  USING (public.user_has_permission('inventory.manage'))
  WITH CHECK (public.user_has_permission('inventory.manage'));

-- ~~~ 8t. inventory_receipts ~~~
ALTER TABLE public.inventory_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.inventory_receipts;
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.inventory_receipts;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.inventory_receipts;
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.inventory_receipts;
DROP POLICY IF EXISTS "inventory_receipts_read" ON public.inventory_receipts;
DROP POLICY IF EXISTS "inventory_receipts_write" ON public.inventory_receipts;

CREATE POLICY "inventory_receipts_read" ON public.inventory_receipts
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "inventory_receipts_write" ON public.inventory_receipts
  FOR ALL TO authenticated
  USING (public.user_has_permission('inventory.manage'))
  WITH CHECK (public.user_has_permission('inventory.manage'));

-- ~~~ 8u. inventory_receipt_items ~~~
ALTER TABLE public.inventory_receipt_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.inventory_receipt_items;
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.inventory_receipt_items;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.inventory_receipt_items;
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.inventory_receipt_items;
DROP POLICY IF EXISTS "inventory_receipt_items_read" ON public.inventory_receipt_items;
DROP POLICY IF EXISTS "inventory_receipt_items_write" ON public.inventory_receipt_items;

CREATE POLICY "inventory_receipt_items_read" ON public.inventory_receipt_items
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "inventory_receipt_items_write" ON public.inventory_receipt_items
  FOR ALL TO authenticated
  USING (public.user_has_permission('inventory.manage'))
  WITH CHECK (public.user_has_permission('inventory.manage'));

-- ~~~ 8v. customers ~~~
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.customers;
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.customers;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.customers;
DROP POLICY IF EXISTS "customers_read" ON public.customers;
DROP POLICY IF EXISTS "customers_write" ON public.customers;

CREATE POLICY "customers_read" ON public.customers
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "customers_write" ON public.customers
  FOR ALL TO authenticated
  USING (public.user_has_permission('customers.manage'))
  WITH CHECK (public.user_has_permission('customers.manage'));

-- ~~~ 8w. customers_b2b ~~~
ALTER TABLE public.customers_b2b ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.customers_b2b;
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.customers_b2b;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.customers_b2b;
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.customers_b2b;
DROP POLICY IF EXISTS "customers_b2b_read" ON public.customers_b2b;
DROP POLICY IF EXISTS "customers_b2b_write" ON public.customers_b2b;

CREATE POLICY "customers_b2b_read" ON public.customers_b2b
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "customers_b2b_write" ON public.customers_b2b
  FOR ALL TO authenticated
  USING (public.user_has_permission('customers.manage'))
  WITH CHECK (public.user_has_permission('customers.manage'));


-- =============================================================
-- SECTION 9: Seed Data (rpc_access_rules)
-- =============================================================

INSERT INTO public.rpc_access_rules (function_name, required_permission, max_calls_per_minute, is_write, description) VALUES
-- === AUTH & USER MANAGEMENT (admin only, low rate) ===
('approve_user',              'settings.permissions',  10,  true,  'Duyệt user mới'),
('update_user_status',        'settings.permissions',  20,  true,  'Cập nhật trạng thái user'),
('update_user_assignments',   'settings.permissions',  20,  true,  'Gán role cho user'),
('update_permissions_for_role','settings.permissions',  20,  true,  'Cập nhật quyền cho role'),
('delete_auth_user',          'settings.permissions',  5,   true,  'Xóa user'),
('invite_new_user',           'settings.permissions',  10,  true,  'Mời user mới'),
('create_new_auth_user',      'settings.permissions',  10,  true,  'Tạo user mới'),

-- === PURCHASING ===
('create_purchase_order',     'purchasing.create',     30,  true,  'Tạo PO'),
('update_purchase_order',     'purchasing.edit',       30,  true,  'Cập nhật PO'),
('confirm_purchase_order',    'purchasing.edit',       20,  true,  'Xác nhận PO'),
('delete_purchase_order',     'purchasing.edit',       10,  true,  'Xóa PO'),
('confirm_purchase_costing',  'purchasing.costing',    20,  true,  'Chốt giá vốn'),
('confirm_purchase_order_financials','purchasing.costing',10,true, 'Chốt tài chính PO'),
('auto_create_purchase_orders_min_max','purchasing.create',5,true, 'Tạo PO tự động min/max'),

-- === SALES & POS ===
('create_sales_order',        NULL,                    60,  true,  'Tạo đơn bán hàng (POS)'),
('update_sales_order',        NULL,                    30,  true,  'Cập nhật đơn bán'),
('cancel_order',              NULL,                    20,  true,  'Hủy đơn hàng'),
('clone_sales_order',         NULL,                    20,  true,  'Sao chép đơn hàng'),

-- === FINANCE ===
('create_finance_transaction','finance.view_balance',  30,  true,  'Tạo phiếu thu/chi'),
('confirm_finance_transaction','finance.view_balance', 20,  true,  'Duyệt phiếu thu/chi'),
('process_vat_invoice_entry', 'finance.view_balance',  20,  true,  'Nhập VAT vào kho'),
('reverse_vat_invoice_entry', 'finance.view_balance',  10,  true,  'Reverse VAT'),
('delete_invoice_atomic',     'finance.view_balance',  10,  true,  'Xóa hóa đơn'),
('process_incoming_bank_transfer',NULL,                30,  true,  'Nhận chuyển khoản'),
('bulk_pay_orders',           'finance.view_balance',  10,  true,  'Thanh toán hàng loạt'),
('submit_cash_remittance',    'finance.view_balance',  20,  true,  'Nộp tiền mặt'),

-- === INVENTORY ===
('create_inventory_receipt',  NULL,                    20,  true,  'Tạo phiếu nhập kho'),
('process_inbound_receipt',   NULL,                    20,  true,  'Xử lý nhập kho'),
('create_manual_transfer',    NULL,                    20,  true,  'Tạo phiếu chuyển kho'),
('confirm_transfer_outbound_fefo',NULL,                20,  true,  'Xác nhận xuất chuyển kho'),
('confirm_transfer_inbound',  NULL,                    20,  true,  'Xác nhận nhập chuyển kho'),
('create_inventory_check',    NULL,                    10,  true,  'Tạo phiên kiểm kê'),
('complete_inventory_check',  NULL,                    10,  true,  'Hoàn thành kiểm kê'),
('import_opening_stock_v3_by_id',NULL,                 5,   true,  'Nhập tồn đầu kỳ'),

-- === PRODUCT ===
('update_product',            'inventory.product.edit_info', 30, true, 'Cập nhật sản phẩm'),
('delete_products',           'inventory.product.edit_info', 10, true, 'Xóa sản phẩm'),
('bulk_update_product_prices','quick.price_update',    5,   true,  'Cập nhật giá hàng loạt'),
('bulk_update_product_barcodes','quick.barcode_update', 5,  true,  'Cập nhật barcode hàng loạt'),
('upsert_product_with_units', 'inventory.product.edit_info',30,true,'Tạo/sửa SP + đơn vị'),
('update_product_location',   'quick.location_update', 30,  true,  'Cập nhật vị trí SP'),

-- === MEDICAL ===
('create_medical_visit',      'medical.reception',     30,  true,  'Tạo phiên khám'),
('check_in_patient',          'medical.reception',     30,  true,  'Check-in bệnh nhân'),
('send_prescription_to_pos',  'medical.examine',       30,  true,  'Gửi toa thuốc ra POS'),
('checkout_clinical_services','medical.examine',       20,  true,  'Thanh toán dịch vụ y tế'),
('doctor_approve_vaccination','medical.examine',       20,  true,  'Duyệt tiêm chủng'),

-- === CUSTOMER ===
('create_customer_b2c',       'crm.b2c.create',       30,  true,  'Tạo KH B2C'),
('update_customer_b2c',       'crm.b2c.edit',         30,  true,  'Sửa KH B2C'),
('delete_customer_b2c',       'crm.b2c.delete',       10,  true,  'Xóa KH B2C'),
('create_customer_b2b',       'crm.b2b.create',       30,  true,  'Tạo KH B2B'),
('update_customer_b2b',       'crm.b2b.edit',         30,  true,  'Sửa KH B2B'),
('delete_customer_b2b',       'crm.b2b.delete',       10,  true,  'Xóa KH B2B'),

-- === PARTNER ===
('create_supplier',           'partner.supplier.create',20, true,  'Tạo NCC'),
('update_supplier',           'partner.supplier.edit', 20,  true,  'Sửa NCC'),
('delete_supplier',           'partner.supplier.delete',10, true,  'Xóa NCC'),
('create_shipping_partner',   'partner.shipping.create',20, true,  'Tạo ĐVVC'),
('update_shipping_partner',   'partner.shipping.edit', 20,  true,  'Sửa ĐVVC'),
('delete_shipping_partner',   'partner.shipping.delete',10, true,  'Xóa ĐVVC'),

-- === READ functions (high rate limit, no specific permission) ===
('get_purchase_orders_master', NULL,                   120, false, 'Danh sách PO'),
('search_products_pos',        NULL,                   120, false, 'Tìm SP POS'),
('search_products_v2',         NULL,                   120, false, 'Tìm SP v2'),
('get_sales_orders_view',      NULL,                   120, false, 'Danh sách đơn hàng'),
('get_products_list',          NULL,                   120, false, 'Danh sách sản phẩm')

ON CONFLICT (function_name) DO UPDATE SET
  required_permission = EXCLUDED.required_permission,
  max_calls_per_minute = EXCLUDED.max_calls_per_minute,
  is_write = EXCLUDED.is_write,
  description = EXCLUDED.description;


-- =============================================================
-- SECTION 10: Revoke (process_incoming_bank_transfer)
-- =============================================================

REVOKE ALL ON FUNCTION public.process_incoming_bank_transfer(numeric, text, text) FROM anon;


-- End of migration 001

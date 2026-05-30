# Database Schema

### Table: \_revert_double_deduct_20260417

- **id**: bigint (Nullable: NO) DEFAULT nextval('\_revert_double_deduct_20260417_id_seq'::regclass)
- **snapshot_at**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **action**: text (Nullable: NO)
- **payload**: jsonb (Nullable: NO)

### Table: \_revert_double_deduct_20260418

- **id**: bigint (Nullable: NO) DEFAULT nextval('\_revert_double_deduct_20260418_id_seq'::regclass)
- **snapshot_at**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **action**: text (Nullable: NO)
- **payload**: jsonb (Nullable: NO)

### Table: \_revert_double_deduct_20260423

- **id**: bigint (Nullable: NO) DEFAULT nextval('\_revert_double_deduct_20260423_id_seq'::regclass)
- **snapshot_at**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **action**: text (Nullable: NO)
- **payload**: jsonb (Nullable: NO)

### Table: \_stock_adjust_oversell_failures

- **id**: bigint (Nullable: NO) DEFAULT nextval('\_stock_adjust_oversell_failures_id_seq'::regclass)
- **order_code**: text (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **uom**: text (Nullable: NO)
- **missing_base_qty**: numeric (Nullable: NO)
- **error_message**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()

### Table: \_unit_normalize_skipped

- **id**: bigint (Nullable: NO) DEFAULT nextval('\_unit_normalize_skipped_id_seq'::regclass)
- **product_id**: bigint (Nullable: YES)
- **variant**: text (Nullable: YES)
- **canonical**: text (Nullable: YES)
- **variant_conv**: numeric (Nullable: YES)
- **existing_canonical_conv**: numeric (Nullable: YES)
- **unit_type**: text (Nullable: YES)
- **reason**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: appointments

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **customer_id**: bigint (Nullable: NO)
- **doctor_id**: uuid (Nullable: YES)
- **service_type**: USER-DEFINED (Nullable: YES) DEFAULT 'examination'::appointment_service_type
- **appointment_time**: timestamp with time zone (Nullable: NO)
- **status**: USER-DEFINED (Nullable: YES) DEFAULT 'pending'::appointment_status
- **symptoms**: jsonb (Nullable: YES) DEFAULT '[]'::jsonb
- **note**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **priority**: text (Nullable: YES) DEFAULT 'normal'::text
- **contact_status**: text (Nullable: YES) DEFAULT 'pending'::text
- **room_id**: bigint (Nullable: YES)
- **service_ids**: ARRAY (Nullable: YES) DEFAULT '{}'::bigint[]
- **created_by**: uuid (Nullable: YES)
- **check_in_time**: timestamp with time zone (Nullable: YES)

### Table: asset_maintenance_history

- **id**: bigint (Nullable: NO) DEFAULT nextval('asset_maintenance_history_id_seq'::regclass)
- **asset_id**: bigint (Nullable: NO)
- **maintenance_date**: date (Nullable: NO)
- **content**: text (Nullable: NO)
- **cost**: numeric (Nullable: YES) DEFAULT 0
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: asset_maintenance_plans

- **id**: bigint (Nullable: NO) DEFAULT nextval('asset_maintenance_plans_id_seq'::regclass)
- **asset_id**: bigint (Nullable: NO)
- **content**: text (Nullable: NO)
- **frequency_months**: integer (Nullable: NO)
- **exec_type**: USER-DEFINED (Nullable: NO)
- **assigned_user_id**: uuid (Nullable: YES)
- **provider_name**: text (Nullable: YES)
- **provider_phone**: text (Nullable: YES)
- **provider_note**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: asset_types

- **id**: bigint (Nullable: NO) DEFAULT nextval('asset_types_id_seq'::regclass)
- **name**: text (Nullable: NO)
- **description**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: assets

- **id**: bigint (Nullable: NO) DEFAULT nextval('assets_id_seq'::regclass)
- **asset_code**: text (Nullable: YES)
- **name**: text (Nullable: NO)
- **description**: text (Nullable: YES)
- **serial_number**: text (Nullable: YES)
- **image_url**: text (Nullable: YES)
- **asset_type_id**: bigint (Nullable: YES)
- **branch_id**: bigint (Nullable: YES)
- **user_id**: uuid (Nullable: YES)
- **status**: USER-DEFINED (Nullable: NO) DEFAULT 'storage'::asset_status
- **handed_over_date**: date (Nullable: YES)
- **purchase_date**: date (Nullable: YES)
- **supplier_id**: bigint (Nullable: YES)
- **cost**: numeric (Nullable: YES) DEFAULT 0
- **depreciation_months**: integer (Nullable: YES) DEFAULT 36
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: b2b_customer_debt_view

- **customer_id**: bigint (Nullable: YES)
- **customer_code**: text (Nullable: YES)
- **customer_name**: text (Nullable: YES)
- **customer_phone**: text (Nullable: YES)
- **total_invoiced**: numeric (Nullable: YES)
- **total_paid**: numeric (Nullable: YES)
- **actual_current_debt**: numeric (Nullable: YES)

### Table: b2b_notifications

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **customer_b2b_id**: bigint (Nullable: YES)
- **type**: USER-DEFINED (Nullable: NO) DEFAULT 'system'::b2b_notification_type
- **title**: text (Nullable: NO)
- **body**: text (Nullable: YES)
- **data**: jsonb (Nullable: YES) DEFAULT '{}'::jsonb
- **is_read**: boolean (Nullable: NO) DEFAULT false
- **read_at**: timestamp with time zone (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()

### Table: b2b_push_subscriptions

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **portal_user_id**: uuid (Nullable: NO)
- **endpoint**: text (Nullable: NO)
- **p256dh**: text (Nullable: NO)
- **auth**: text (Nullable: NO)
- **user_agent**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()

### Table: banks

- **id**: bigint (Nullable: NO) DEFAULT nextval('banks_id_seq'::regclass)
- **name**: text (Nullable: NO)
- **code**: text (Nullable: NO)
- **bin**: text (Nullable: NO)
- **short_name**: text (Nullable: NO)
- **logo**: text (Nullable: YES)
- **status**: text (Nullable: NO) DEFAULT 'active'::text
- **transfer_supported**: boolean (Nullable: YES) DEFAULT false
- **lookup_supported**: boolean (Nullable: YES) DEFAULT false
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: batch_revaluations

- **id**: bigint (Nullable: NO) DEFAULT nextval('batch_revaluations_id_seq'::regclass)
- **batch_id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **warehouse_id**: bigint (Nullable: YES)
- **old_price**: numeric (Nullable: NO)
- **new_price**: numeric (Nullable: NO)
- **qty_at_change**: integer (Nullable: NO)
- **delta_value**: numeric (Nullable: YES)
- **reason_code**: text (Nullable: NO)
- **note**: text (Nullable: YES)
- **vat_synced**: boolean (Nullable: NO) DEFAULT false
- **user_id**: uuid (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()

### Table: batches

- **id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: YES)
- **batch_code**: text (Nullable: NO)
- **expiry_date**: date (Nullable: NO)
- **manufacturing_date**: date (Nullable: YES)
- **inbound_price**: numeric (Nullable: YES) DEFAULT 0
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: categories

- **id**: integer (Nullable: NO) DEFAULT nextval('categories_id_seq'::regclass)
- **name**: text (Nullable: NO)
- **slug**: text (Nullable: NO)
- **parent_id**: integer (Nullable: YES)
- **image_url**: text (Nullable: YES)
- **sort_order**: integer (Nullable: YES) DEFAULT 0
- **status**: text (Nullable: YES) DEFAULT 'active'::text
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: NO) DEFAULT now()

### Table: chart_of_accounts

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **account_code**: text (Nullable: NO)
- **name**: text (Nullable: NO)
- **parent_id**: uuid (Nullable: YES)
- **type**: USER-DEFINED (Nullable: NO)
- **balance_type**: USER-DEFINED (Nullable: NO)
- **status**: USER-DEFINED (Nullable: NO) DEFAULT 'active'::account_status
- **allow_posting**: boolean (Nullable: NO) DEFAULT true
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: chat_cache

- **cache_key**: text (Nullable: NO)
- **response**: jsonb (Nullable: NO)
- **hits**: integer (Nullable: NO) DEFAULT 0
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **expires_at**: timestamp with time zone (Nullable: NO)

### Table: chat_compliance_audits

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **message_id**: uuid (Nullable: NO)
- **session_id**: uuid (Nullable: NO)
- **rule_code**: text (Nullable: NO)
- **severity**: text (Nullable: NO)
- **matched_keywords**: ARRAY (Nullable: YES)
- **excerpt**: text (Nullable: YES)
- **status**: text (Nullable: NO) DEFAULT 'open'::text
- **reviewer_id**: uuid (Nullable: YES)
- **reviewed_at**: timestamp with time zone (Nullable: YES)
- **reviewer_note**: text (Nullable: YES)
- **audited_at**: timestamp with time zone (Nullable: NO) DEFAULT now()

### Table: chat_feedback

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **message_id**: uuid (Nullable: NO)
- **reporter_id**: uuid (Nullable: NO)
- **feedback_type**: text (Nullable: NO)
- **note**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()

### Table: chat_feedback_weekly_clusters

- **id**: bigint (Nullable: NO) DEFAULT nextval('chat_feedback_weekly_clusters_id_seq'::regclass)
- **week_start**: date (Nullable: NO)
- **pattern_keyword**: text (Nullable: NO)
- **sample_message_ids**: ARRAY (Nullable: NO)
- **feedback_count**: integer (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()

### Table: chat_handoffs

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **session_id**: uuid (Nullable: NO)
- **reason**: text (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **resolved_at**: timestamp with time zone (Nullable: YES)

### Table: chat_messages

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **session_id**: uuid (Nullable: NO)
- **role**: text (Nullable: NO)
- **content_type**: text (Nullable: NO)
- **content**: text (Nullable: YES)
- **attachments**: jsonb (Nullable: YES)
- **llm_meta**: jsonb (Nullable: YES)
- **intent**: text (Nullable: YES)
- **entities**: jsonb (Nullable: YES)
- **deleted_at**: timestamp with time zone (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()

### Table: chat_sessions

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **user_id**: uuid (Nullable: NO)
- **status**: text (Nullable: NO) DEFAULT 'bot'::text
- **assigned_sales_id**: uuid (Nullable: YES)
- **draft_cart_id**: uuid (Nullable: YES)
- **platform**: text (Nullable: NO) DEFAULT 'web'::text
- **context**: jsonb (Nullable: NO) DEFAULT '{}'::jsonb
- **started_at**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **last_activity_at**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **closed_at**: timestamp with time zone (Nullable: YES)

### Table: clinical_prescription_items

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **prescription_id**: uuid (Nullable: YES)
- **product_id**: bigint (Nullable: YES)
- **product_unit_id**: bigint (Nullable: YES)
- **quantity**: numeric (Nullable: NO)
- **usage_note**: text (Nullable: YES)
- **unit_price_snapshot**: numeric (Nullable: YES) DEFAULT 0

### Table: clinical_prescriptions

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **visit_id**: uuid (Nullable: YES)
- **customer_id**: bigint (Nullable: YES)
- **doctor_id**: uuid (Nullable: YES)
- **code**: text (Nullable: YES)
- **advice**: text (Nullable: YES)
- **re_exam_date**: date (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: clinical_queues

- **id**: bigint (Nullable: NO)
- **appointment_id**: uuid (Nullable: YES)
- **customer_id**: bigint (Nullable: NO)
- **doctor_id**: uuid (Nullable: YES)
- **queue_number**: integer (Nullable: NO)
- **status**: USER-DEFINED (Nullable: YES) DEFAULT 'waiting'::queue_status
- **priority_level**: USER-DEFINED (Nullable: YES) DEFAULT 'normal'::queue_priority
- **checked_in_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: clinical_service_requests

- **id**: bigint (Nullable: NO)
- **medical_visit_id**: uuid (Nullable: YES)
- **patient_id**: bigint (Nullable: YES)
- **doctor_id**: uuid (Nullable: YES)
- **service_package_id**: bigint (Nullable: YES)
- **service_name_snapshot**: text (Nullable: YES)
- **category**: text (Nullable: YES) DEFAULT 'lab'::text
- **status**: text (Nullable: YES) DEFAULT 'pending'::text
- **results_json**: jsonb (Nullable: YES) DEFAULT '{}'::jsonb
- **imaging_result**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **created_by**: uuid (Nullable: YES)
- **payment_order_id**: uuid (Nullable: YES)

### Table: connect_comments

- **id**: bigint (Nullable: NO) DEFAULT nextval('connect_comments_id_seq'::regclass)
- **post_id**: bigint (Nullable: NO)
- **user_id**: uuid (Nullable: NO) DEFAULT auth.uid()
- **content**: text (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: connect_likes

- **id**: bigint (Nullable: NO) DEFAULT nextval('connect_likes_id_seq'::regclass)
- **post_id**: bigint (Nullable: NO)
- **user_id**: uuid (Nullable: NO) DEFAULT auth.uid()
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: connect_posts

- **id**: bigint (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **creator_id**: uuid (Nullable: YES) DEFAULT auth.uid()
- **category**: text (Nullable: NO)
- **title**: text (Nullable: NO)
- **summary**: text (Nullable: YES)
- **content**: text (Nullable: YES)
- **is_pinned**: boolean (Nullable: YES) DEFAULT false
- **is_anonymous**: boolean (Nullable: YES) DEFAULT false
- **priority**: text (Nullable: YES) DEFAULT 'normal'::text
- **status**: text (Nullable: YES) DEFAULT 'published'::text
- **must_confirm**: boolean (Nullable: YES) DEFAULT false
- **reward_points**: integer (Nullable: YES) DEFAULT 0
- **feedback_response**: text (Nullable: YES)
- **response_by**: uuid (Nullable: YES)
- **responded_at**: timestamp with time zone (Nullable: YES)
- **tags**: ARRAY (Nullable: YES) DEFAULT '{}'::text[]
- **attachments**: ARRAY (Nullable: YES) DEFAULT '{}'::jsonb[]
- **is_locked**: boolean (Nullable: YES) DEFAULT false
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: connect_reads

- **post_id**: bigint (Nullable: NO)
- **user_id**: uuid (Nullable: NO) DEFAULT auth.uid()
- **confirmed_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: customer_b2b_contacts

- **id**: bigint (Nullable: NO) DEFAULT nextval('customer_b2b_contacts_id_seq'::regclass)
- **customer_b2b_id**: bigint (Nullable: NO)
- **name**: text (Nullable: NO)
- **position**: text (Nullable: YES)
- **phone**: text (Nullable: YES)
- **email**: text (Nullable: YES)
- **is_primary**: boolean (Nullable: YES) DEFAULT false
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: customer_favorites

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **customer_b2b_id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: customer_guardians

- **id**: bigint (Nullable: NO) DEFAULT nextval('customer_guardians_id_seq'::regclass)
- **customer_id**: bigint (Nullable: NO)
- **guardian_id**: bigint (Nullable: NO)
- **relationship**: text (Nullable: YES)

### Table: customer_segment_members

- **id**: bigint (Nullable: NO)
- **segment_id**: bigint (Nullable: NO)
- **customer_id**: bigint (Nullable: NO)
- **added_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: customer_segments

- **id**: bigint (Nullable: NO)
- **name**: text (Nullable: NO)
- **description**: text (Nullable: YES)
- **type**: text (Nullable: NO)
- **criteria**: jsonb (Nullable: YES) DEFAULT '{}'::jsonb
- **is_active**: boolean (Nullable: YES) DEFAULT true
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: customer_service_wallets

- **id**: bigint (Nullable: NO)
- **customer_id**: bigint (Nullable: NO)
- **order_id**: uuid (Nullable: YES)
- **package_id**: bigint (Nullable: YES)
- **product_id**: bigint (Nullable: NO)
- **total_quantity**: integer (Nullable: NO)
- **used_quantity**: integer (Nullable: YES) DEFAULT 0
- **expiry_date**: date (Nullable: YES)
- **status**: text (Nullable: YES) DEFAULT 'active'::text
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: customer_vaccination_records

- **id**: bigint (Nullable: NO)
- **customer_id**: bigint (Nullable: NO)
- **order_id**: uuid (Nullable: YES)
- **medical_visit_id**: uuid (Nullable: YES)
- **package_id**: bigint (Nullable: YES)
- **product_id**: bigint (Nullable: NO)
- **dose_number**: integer (Nullable: NO) DEFAULT 1
- **expected_date**: date (Nullable: NO)
- **actual_date**: date (Nullable: YES)
- **appointment_id**: uuid (Nullable: YES)
- **status**: text (Nullable: YES) DEFAULT 'pending'::text
- **consulted_by**: uuid (Nullable: YES)
- **administered_by**: uuid (Nullable: YES)
- **updated_by**: uuid (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: customer_vouchers

- **id**: bigint (Nullable: NO)
- **customer_id**: bigint (Nullable: NO)
- **promotion_id**: uuid (Nullable: NO)
- **code**: text (Nullable: NO)
- **status**: text (Nullable: NO) DEFAULT 'active'::text
- **used_at**: timestamp with time zone (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **usage_remaining**: integer (Nullable: YES) DEFAULT 1

### Table: customers

- **id**: bigint (Nullable: NO) DEFAULT nextval('customers_id_seq'::regclass)
- **customer_code**: text (Nullable: YES)
- **name**: text (Nullable: NO)
- **type**: USER-DEFINED (Nullable: NO) DEFAULT 'CaNhan'::customer_b2c_type
- **phone**: text (Nullable: YES)
- **email**: text (Nullable: YES)
- **address**: text (Nullable: YES)
- **dob**: date (Nullable: YES)
- **gender**: USER-DEFINED (Nullable: YES)
- **cccd**: text (Nullable: YES)
- **cccd_issue_date**: date (Nullable: YES)
- **avatar_url**: text (Nullable: YES)
- **cccd_front_url**: text (Nullable: YES)
- **cccd_back_url**: text (Nullable: YES)
- **occupation**: text (Nullable: YES)
- **lifestyle_habits**: text (Nullable: YES)
- **allergies**: text (Nullable: YES)
- **medical_history**: text (Nullable: YES)
- **tax_code**: text (Nullable: YES)
- **contact_person_name**: text (Nullable: YES)
- **loyalty_points**: integer (Nullable: YES) DEFAULT 0
- **status**: USER-DEFINED (Nullable: NO) DEFAULT 'active'::account_status
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **contact_person_phone**: text (Nullable: YES)
- **last_purchase_at**: timestamp with time zone (Nullable: YES)
- **updated_by**: uuid (Nullable: YES)

### Table: customers_b2b

- **id**: bigint (Nullable: NO) DEFAULT nextval('customers_b2b_id_seq'::regclass)
- **customer_code**: text (Nullable: YES)
- **name**: text (Nullable: NO)
- **tax_code**: text (Nullable: YES)
- **debt_limit**: numeric (Nullable: YES) DEFAULT 100000000
- **payment_term**: integer (Nullable: YES) DEFAULT 30
- **ranking**: text (Nullable: YES)
- **business_license_number**: text (Nullable: YES)
- **business_license_url**: text (Nullable: YES)
- **sales_staff_id**: uuid (Nullable: YES)
- **status**: USER-DEFINED (Nullable: NO) DEFAULT 'active'::account_status
- **phone**: text (Nullable: YES)
- **email**: text (Nullable: YES)
- **vat_address**: text (Nullable: YES)
- **shipping_address**: text (Nullable: YES)
- **gps_lat**: numeric (Nullable: YES)
- **gps_long**: numeric (Nullable: YES)
- **bank_name**: text (Nullable: YES)
- **bank_account_name**: text (Nullable: YES)
- **bank_account_number**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **loyalty_points**: integer (Nullable: YES) DEFAULT 0
- **current_debt**: numeric (Nullable: YES) DEFAULT 0
- **current_debt_bak**: numeric (Nullable: YES)

### Table: deal_items

- **id**: integer (Nullable: NO) DEFAULT nextval('deal_items_id_seq'::regclass)
- **deal_id**: integer (Nullable: NO)
- **product_id**: integer (Nullable: NO)
- **override_discount_type**: text (Nullable: YES)
- **override_discount_value**: numeric (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()

### Table: delivery_routes

- **id**: bigint (Nullable: NO)
- **day_of_week**: smallint (Nullable: NO)
- **route_name**: text (Nullable: NO)
- **district_codes**: ARRAY (Nullable: NO)
- **is_active**: boolean (Nullable: YES) DEFAULT true
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: delivery_schedule_overrides

- **id**: bigint (Nullable: NO)
- **override_date**: date (Nullable: NO)
- **route_name**: text (Nullable: YES)
- **district_codes**: ARRAY (Nullable: YES)
- **reason**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: document_templates

- **id**: bigint (Nullable: NO) DEFAULT nextval('document_templates_id_seq'::regclass)
- **name**: text (Nullable: NO)
- **module**: USER-DEFINED (Nullable: NO)
- **type**: USER-DEFINED (Nullable: NO)
- **status**: USER-DEFINED (Nullable: NO) DEFAULT 'active'::account_status
- **content**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: finance_invoice_allocations

- **id**: bigint (Nullable: NO)
- **invoice_id**: bigint (Nullable: YES)
- **po_id**: bigint (Nullable: YES)
- **allocated_amount**: numeric (Nullable: YES) DEFAULT 0
- **note**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: finance_invoices

- **id**: bigint (Nullable: NO)
- **invoice_number**: text (Nullable: YES)
- **invoice_symbol**: text (Nullable: YES)
- **invoice_date**: date (Nullable: YES)
- **supplier_name_raw**: text (Nullable: YES)
- **supplier_tax_code**: text (Nullable: YES)
- **supplier_id**: bigint (Nullable: YES)
- **total_amount_pre_tax**: numeric (Nullable: YES) DEFAULT 0
- **tax_amount**: numeric (Nullable: YES) DEFAULT 0
- **total_amount_post_tax**: numeric (Nullable: YES) DEFAULT 0
- **items_json**: jsonb (Nullable: YES) DEFAULT '[]'::jsonb
- **parsed_data**: jsonb (Nullable: YES)
- **file_url**: text (Nullable: YES)
- **file_type**: text (Nullable: YES)
- **status**: text (Nullable: YES) DEFAULT 'draft'::text
- **created_by**: uuid (Nullable: YES) DEFAULT auth.uid()
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **supplier_address_raw**: text (Nullable: YES)
- **direction**: text (Nullable: YES) DEFAULT 'inbound'::text
- **buyer_tax_code**: text (Nullable: YES)
- **raw_items**: jsonb (Nullable: YES)

### Table: finance_transactions

- **id**: bigint (Nullable: NO)
- **code**: text (Nullable: NO)
- **transaction_date**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **flow**: USER-DEFINED (Nullable: NO)
- **business_type**: USER-DEFINED (Nullable: NO) DEFAULT 'other'::business_type
- **category_id**: bigint (Nullable: YES)
- **amount**: numeric (Nullable: NO)
- **fund_account_id**: bigint (Nullable: NO)
- **partner_type**: text (Nullable: YES)
- **partner_id**: text (Nullable: YES)
- **partner_name_cache**: text (Nullable: YES)
- **ref_type**: text (Nullable: YES)
- **ref_id**: text (Nullable: YES)
- **description**: text (Nullable: YES)
- **evidence_url**: text (Nullable: YES)
- **created_by**: uuid (Nullable: YES) DEFAULT auth.uid()
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **status**: USER-DEFINED (Nullable: NO) DEFAULT 'pending'::transaction_status
- **cash_tally**: jsonb (Nullable: YES)
- **ref_advance_id**: bigint (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **target_bank_info**: jsonb (Nullable: YES)
- **bank_reference_id**: text (Nullable: YES)

### Table: fund_accounts

- **id**: bigint (Nullable: NO) DEFAULT nextval('fund_accounts_id_seq'::regclass)
- **name**: text (Nullable: NO)
- **type**: USER-DEFINED (Nullable: NO)
- **location**: text (Nullable: YES)
- **account_number**: text (Nullable: YES)
- **bank_id**: bigint (Nullable: YES)
- **initial_balance**: numeric (Nullable: NO) DEFAULT 0
- **status**: USER-DEFINED (Nullable: NO) DEFAULT 'active'::fund_account_status
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **currency**: text (Nullable: YES) DEFAULT 'VND'::text
- **balance**: numeric (Nullable: NO) DEFAULT 0
- **bank_info**: jsonb (Nullable: YES)
- **description**: text (Nullable: YES)

### Table: inventory_batches

- **id**: bigint (Nullable: NO)
- **warehouse_id**: bigint (Nullable: YES)
- **product_id**: bigint (Nullable: YES)
- **batch_id**: bigint (Nullable: YES)
- **quantity**: numeric (Nullable: YES) DEFAULT 0
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: inventory_check_items

- **id**: bigint (Nullable: NO)
- **check_id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **batch_code**: text (Nullable: YES)
- **expiry_date**: date (Nullable: YES)
- **system_quantity**: numeric (Nullable: YES) DEFAULT 0
- **actual_quantity**: numeric (Nullable: YES) DEFAULT 0
- **cost_price**: numeric (Nullable: YES) DEFAULT 0
- **location_snapshot**: text (Nullable: YES)
- **difference_reason**: text (Nullable: YES)
- **counted_by**: uuid (Nullable: YES)
- **counted_at**: timestamp with time zone (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **created_by**: uuid (Nullable: YES)
- **diff_quantity**: numeric (Nullable: YES)

### Table: inventory_checks

- **id**: bigint (Nullable: NO)
- **code**: text (Nullable: NO)
- **warehouse_id**: bigint (Nullable: NO)
- **total_system_value**: numeric (Nullable: YES) DEFAULT 0
- **total_actual_value**: numeric (Nullable: YES) DEFAULT 0
- **total_diff_value**: numeric (Nullable: YES)
- **status**: text (Nullable: YES) DEFAULT 'DRAFT'::text
- **note**: text (Nullable: YES)
- **created_by**: uuid (Nullable: YES)
- **verified_by**: uuid (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **completed_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: inventory_receipt_items

- **id**: bigint (Nullable: NO)
- **receipt_id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **quantity**: integer (Nullable: NO)
- **lot_number**: text (Nullable: YES)
- **expiry_date**: date (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **serial_number**: text (Nullable: YES)
- **qc_status**: text (Nullable: YES) DEFAULT 'pass'::text
- **unit_price**: numeric (Nullable: NO) DEFAULT 0
- **discount_amount**: numeric (Nullable: YES) DEFAULT 0
- **vat_rate**: numeric (Nullable: YES) DEFAULT 0
- **sub_total**: numeric (Nullable: YES)
- **allocated_cost**: numeric (Nullable: YES) DEFAULT 0
- **final_unit_cost**: numeric (Nullable: YES) DEFAULT 0

### Table: inventory_receipts

- **id**: bigint (Nullable: NO)
- **code**: text (Nullable: NO)
- **po_id**: bigint (Nullable: YES)
- **warehouse_id**: bigint (Nullable: NO)
- **creator_id**: uuid (Nullable: YES) DEFAULT auth.uid()
- **receipt_date**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **note**: text (Nullable: YES)
- **status**: text (Nullable: YES) DEFAULT 'completed'::text
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **total_goods_amount**: numeric (Nullable: YES) DEFAULT 0
- **discount_order**: numeric (Nullable: YES) DEFAULT 0
- **shipping_fee**: numeric (Nullable: YES) DEFAULT 0
- **other_fee**: numeric (Nullable: YES) DEFAULT 0
- **final_amount**: numeric (Nullable: YES) DEFAULT 0
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: inventory_transactions

- **id**: bigint (Nullable: NO)
- **warehouse_id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **batch_id**: bigint (Nullable: YES)
- **type**: text (Nullable: NO)
- **quantity**: numeric (Nullable: NO)
- **ref_id**: text (Nullable: YES)
- **note**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **created_by**: uuid (Nullable: YES)
- **description**: text (Nullable: YES)
- **action_group**: text (Nullable: YES)
- **unit_price**: numeric (Nullable: YES) DEFAULT 0
- **partner_id**: bigint (Nullable: YES)
- **total_value**: numeric (Nullable: YES)

### Table: inventory_transfer_batch_items

- **id**: bigint (Nullable: NO)
- **transfer_item_id**: bigint (Nullable: NO)
- **batch_id**: bigint (Nullable: NO)
- **quantity**: integer (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: inventory_transfer_items

- **id**: bigint (Nullable: NO)
- **transfer_id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **unit**: text (Nullable: YES)
- **conversion_factor**: integer (Nullable: YES) DEFAULT 1
- **qty_requested**: numeric (Nullable: YES) DEFAULT 0
- **qty_approved**: numeric (Nullable: YES) DEFAULT 0
- **qty_shipped**: numeric (Nullable: YES) DEFAULT 0
- **qty_received**: numeric (Nullable: YES) DEFAULT 0
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: inventory_transfers

- **id**: bigint (Nullable: NO)
- **code**: text (Nullable: NO)
- **source_warehouse_id**: bigint (Nullable: NO)
- **dest_warehouse_id**: bigint (Nullable: NO)
- **status**: text (Nullable: NO) DEFAULT 'pending'::text
- **created_by**: uuid (Nullable: YES)
- **note**: text (Nullable: YES)
- **carrier_name**: text (Nullable: YES)
- **carrier_contact**: text (Nullable: YES)
- **carrier_phone**: text (Nullable: YES)
- **expected_arrival_at**: timestamp with time zone (Nullable: YES)
- **is_urgent**: boolean (Nullable: YES) DEFAULT false
- **urgency_approved**: boolean (Nullable: YES) DEFAULT false
- **packages_sent**: integer (Nullable: YES) DEFAULT 0
- **packages_received**: integer (Nullable: YES) DEFAULT 0
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **received_by**: uuid (Nullable: YES)
- **received_at**: timestamp with time zone (Nullable: YES)

### Table: lab_indicators_config

- **id**: bigint (Nullable: NO)
- **service_package_id**: bigint (Nullable: YES)
- **indicator_code**: text (Nullable: NO)
- **indicator_name**: text (Nullable: NO)
- **unit**: text (Nullable: YES)
- **value_type**: text (Nullable: YES) DEFAULT 'quantitative'::text
- **gender_apply**: text (Nullable: YES) DEFAULT 'all'::text
- **age_min_days**: integer (Nullable: YES) DEFAULT 0
- **age_max_days**: integer (Nullable: YES) DEFAULT 36500
- **min_normal**: numeric (Nullable: YES)
- **max_normal**: numeric (Nullable: YES)
- **qualitative_normal_value**: text (Nullable: YES)
- **absurd_min**: numeric (Nullable: YES)
- **absurd_max**: numeric (Nullable: YES)
- **display_order**: integer (Nullable: YES) DEFAULT 0
- **status**: text (Nullable: YES) DEFAULT 'active'::text
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: llm_request_log

- **id**: bigint (Nullable: NO) DEFAULT nextval('llm_request_log_id_seq'::regclass)
- **session_id**: uuid (Nullable: YES)
- **user_id**: uuid (Nullable: YES)
- **provider**: text (Nullable: NO)
- **model**: text (Nullable: YES)
- **status**: text (Nullable: NO)
- **latency_ms**: integer (Nullable: YES)
- **tokens_in**: integer (Nullable: YES)
- **tokens_out**: integer (Nullable: YES)
- **error_message**: text (Nullable: YES)
- **attempted_providers**: ARRAY (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()

### Table: manufacturers

- **id**: integer (Nullable: NO) DEFAULT nextval('manufacturers_id_seq'::regclass)
- **name**: text (Nullable: NO)
- **slug**: text (Nullable: NO)
- **country**: text (Nullable: YES)
- **logo_url**: text (Nullable: YES)
- **status**: text (Nullable: YES) DEFAULT 'active'::text
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: NO) DEFAULT now()

### Table: medical_visits

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **appointment_id**: uuid (Nullable: YES)
- **customer_id**: bigint (Nullable: YES)
- **doctor_id**: uuid (Nullable: YES)
- **created_by**: uuid (Nullable: YES)
- **updated_by**: uuid (Nullable: YES)
- **pulse**: integer (Nullable: YES)
- **temperature**: numeric (Nullable: YES)
- **sp02**: integer (Nullable: YES)
- **respiratory_rate**: integer (Nullable: YES)
- **bp_systolic**: integer (Nullable: YES)
- **bp_diastolic**: integer (Nullable: YES)
- **weight**: numeric (Nullable: YES)
- **height**: numeric (Nullable: YES)
- **bmi**: numeric (Nullable: YES)
- **head_circumference**: numeric (Nullable: YES)
- **birth_weight**: numeric (Nullable: YES)
- **birth_height**: numeric (Nullable: YES)
- **symptoms**: text (Nullable: YES)
- **examination_summary**: text (Nullable: YES)
- **diagnosis**: text (Nullable: YES)
- **icd_code**: text (Nullable: YES)
- **doctor_notes**: text (Nullable: YES)
- **status**: text (Nullable: YES) DEFAULT 'in_progress'::text
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **fontanelle**: text (Nullable: YES)
- **reflexes**: text (Nullable: YES)
- **jaundice**: text (Nullable: YES)
- **feeding_status**: text (Nullable: YES)
- **dental_status**: text (Nullable: YES)
- **motor_development**: text (Nullable: YES)
- **language_development**: text (Nullable: YES)
- **puberty_stage**: text (Nullable: YES)
- **scoliosis_status**: text (Nullable: YES)
- **visual_acuity_left**: text (Nullable: YES)
- **visual_acuity_right**: text (Nullable: YES)
- **lifestyle_alcohol**: boolean (Nullable: YES)
- **lifestyle_smoking**: boolean (Nullable: YES)
- **red_flags**: jsonb (Nullable: YES) DEFAULT '[]'::jsonb
- **vac_screening**: jsonb (Nullable: YES) DEFAULT '{}'::jsonb

### Table: notifications

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **user_id**: uuid (Nullable: NO)
- **title**: text (Nullable: NO)
- **message**: text (Nullable: YES)
- **type**: text (Nullable: YES) DEFAULT 'info'::text
- **is_read**: boolean (Nullable: YES) DEFAULT false
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **reference_id**: uuid (Nullable: YES)
- **category**: text (Nullable: YES)
- **metadata**: jsonb (Nullable: YES) DEFAULT '{}'::jsonb

### Table: order_items

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **order_id**: uuid (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **quantity**: integer (Nullable: NO)
- **uom**: text (Nullable: NO)
- **conversion_factor**: integer (Nullable: YES)
- **base_quantity**: integer (Nullable: YES)
- **unit_price**: numeric (Nullable: NO)
- **discount**: numeric (Nullable: YES) DEFAULT 0
- **is_gift**: boolean (Nullable: YES) DEFAULT false
- **note**: text (Nullable: YES)
- **batch_no**: text (Nullable: YES)
- **expiry_date**: date (Nullable: YES)
- **total_line**: numeric (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **quantity_picked**: integer (Nullable: YES) DEFAULT 0
- **quantity_returned**: integer (Nullable: YES) DEFAULT 0

### Table: order_status_history

- **id**: bigint (Nullable: NO) DEFAULT nextval('order_status_history_id_seq'::regclass)
- **order_id**: uuid (Nullable: NO)
- **old_status**: text (Nullable: YES)
- **new_status**: text (Nullable: NO)
- **changed_by**: uuid (Nullable: YES)
- **reason**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()

### Table: orders

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **code**: text (Nullable: NO)
- **customer_id**: bigint (Nullable: YES)
- **creator_id**: uuid (Nullable: YES)
- **status**: text (Nullable: NO) DEFAULT 'PENDING'::text
- **total_amount**: numeric (Nullable: YES) DEFAULT 0
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **final_amount**: numeric (Nullable: YES) DEFAULT 0
- **paid_amount**: numeric (Nullable: YES) DEFAULT 0
- **shipping_fee**: numeric (Nullable: YES) DEFAULT 0
- **discount_amount**: numeric (Nullable: YES) DEFAULT 0
- **quote_expires_at**: timestamp with time zone (Nullable: YES)
- **delivery_address**: text (Nullable: YES)
- **delivery_time**: text (Nullable: YES)
- **fee_payer**: text (Nullable: YES) DEFAULT 'receiver'::text
- **shipping_partner_id**: bigint (Nullable: YES)
- **note**: text (Nullable: YES)
- **delivery_method**: text (Nullable: YES) DEFAULT 'internal'::text
- **package_count**: integer (Nullable: YES) DEFAULT 1
- **order_type**: text (Nullable: YES) DEFAULT 'B2B'::text
- **customer_b2c_id**: bigint (Nullable: YES)
- **payment_status**: text (Nullable: YES) DEFAULT 'unpaid'::text
- **remittance_status**: text (Nullable: YES) DEFAULT 'pending'::text
- **remittance_transaction_id**: bigint (Nullable: YES)
- **payment_method**: text (Nullable: YES) DEFAULT 'cash'::text
- **warehouse_id**: bigint (Nullable: YES)
- **invoice_status**: USER-DEFINED (Nullable: YES) DEFAULT 'none'::invoice_request_status
- **invoice_request_data**: jsonb (Nullable: YES)
- **shipping_address_id**: bigint (Nullable: YES)
- **transport_vehicle_id**: bigint (Nullable: YES)
- **custom_vehicle_name**: text (Nullable: YES)
- **custom_vehicle_phone**: text (Nullable: YES)
- **custom_vehicle_route**: text (Nullable: YES)
- **source**: text (Nullable: YES) DEFAULT 'erp'::text

### Table: paraclinical_templates

- **id**: bigint (Nullable: NO)
- **service_package_id**: bigint (Nullable: YES)
- **name**: text (Nullable: NO)
- **category**: text (Nullable: NO)
- **description_html**: text (Nullable: YES)
- **conclusion**: text (Nullable: YES)
- **recommendation**: text (Nullable: YES)
- **status**: text (Nullable: YES) DEFAULT 'active'::text
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **created_by**: uuid (Nullable: YES)

### Table: permissions

- **key**: text (Nullable: NO)
- **name**: text (Nullable: NO)
- **module**: text (Nullable: NO)

### Table: portal_cart_items

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **portal_user_id**: uuid (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **quantity**: integer (Nullable: NO)
- **uom**: text (Nullable: NO)
- **unit_price**: numeric (Nullable: NO)
- **conversion_factor**: integer (Nullable: NO) DEFAULT 1
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: NO) DEFAULT now()

### Table: portal_users

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **auth_user_id**: uuid (Nullable: NO)
- **customer_b2b_id**: bigint (Nullable: NO)
- **display_name**: text (Nullable: YES)
- **email**: text (Nullable: NO)
- **phone**: text (Nullable: YES)
- **role**: text (Nullable: NO) DEFAULT 'owner'::text
- **status**: text (Nullable: NO) DEFAULT 'active'::text
- **last_login_at**: timestamp with time zone (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: prescription_template_items

- **id**: bigint (Nullable: NO)
- **template_id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **quantity**: integer (Nullable: NO)
- **usage_instruction**: text (Nullable: NO)
- **product_unit_id**: bigint (Nullable: YES)

### Table: prescription_templates

- **id**: bigint (Nullable: NO)
- **name**: text (Nullable: NO)
- **diagnosis**: text (Nullable: YES)
- **note**: text (Nullable: YES)
- **status**: text (Nullable: YES) DEFAULT 'active'::text
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **doctor_id**: uuid (Nullable: YES)

### Table: product_activity_logs

- **id**: bigint (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **user_id**: uuid (Nullable: YES)
- **product_id**: bigint (Nullable: YES)
- **action_type**: text (Nullable: YES)
- **old_value**: text (Nullable: YES)
- **new_value**: text (Nullable: YES)
- **note**: text (Nullable: YES)

### Table: product_contents

- **id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: YES)
- **channel**: text (Nullable: NO)
- **description_html**: text (Nullable: YES)
- **short_description**: text (Nullable: YES)
- **images**: jsonb (Nullable: YES) DEFAULT '[]'::jsonb
- **is_published**: boolean (Nullable: YES) DEFAULT true
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **seo_title**: text (Nullable: YES)
- **seo_description**: text (Nullable: YES)
- **seo_keywords**: ARRAY (Nullable: YES)
- **language_code**: text (Nullable: YES) DEFAULT 'vi'::text
- **updated_by**: uuid (Nullable: YES)

### Table: product_deals

- **id**: integer (Nullable: NO) DEFAULT nextval('product_deals_id_seq'::regclass)
- **name**: text (Nullable: NO)
- **slug**: text (Nullable: NO)
- **description**: text (Nullable: YES)
- **discount_type**: text (Nullable: NO) DEFAULT 'percent'::text
- **discount_value**: numeric (Nullable: NO)
- **start_date**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **end_date**: timestamp with time zone (Nullable: YES)
- **status**: text (Nullable: YES) DEFAULT 'active'::text
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: NO) DEFAULT now()

### Table: product_inventory

- **id**: bigint (Nullable: NO) DEFAULT nextval('product_inventory_id_seq'::regclass)
- **product_id**: bigint (Nullable: NO)
- **warehouse_id**: bigint (Nullable: NO)
- **stock_quantity**: numeric (Nullable: NO) DEFAULT 0
- **min_stock**: integer (Nullable: YES) DEFAULT 0
- **max_stock**: integer (Nullable: YES) DEFAULT 0
- **shelf_location**: text (Nullable: YES) DEFAULT 'Chưa xếp'::text
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **location_cabinet**: text (Nullable: YES)
- **location_row**: text (Nullable: YES)
- **location_slot**: text (Nullable: YES)
- **updated_by**: uuid (Nullable: YES)

### Table: product_synonyms

- **id**: bigint (Nullable: NO) DEFAULT nextval('product_synonyms_id_seq'::regclass)
- **product_id**: bigint (Nullable: NO)
- **synonym**: text (Nullable: NO)
- **weight**: real (Nullable: NO) DEFAULT 1.0
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()

### Table: product_units

- **id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: YES)
- **unit_name**: text (Nullable: NO)
- **conversion_rate**: integer (Nullable: YES) DEFAULT 1
- **barcode**: text (Nullable: YES)
- **is_base**: boolean (Nullable: YES) DEFAULT false
- **is_direct_sale**: boolean (Nullable: YES) DEFAULT true
- **price_cost**: numeric (Nullable: YES) DEFAULT 0
- **price_sell**: numeric (Nullable: YES) DEFAULT 0
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **unit_type**: text (Nullable: YES) DEFAULT 'retail'::text
- **price**: numeric (Nullable: YES) DEFAULT 0

### Table: products

- **id**: bigint (Nullable: NO) DEFAULT nextval('products_id_seq'::regclass)
- **name**: text (Nullable: NO)
- **sku**: text (Nullable: YES)
- **barcode**: text (Nullable: YES)
- **description**: text (Nullable: YES)
- **active_ingredient**: text (Nullable: YES)
- **image_url**: text (Nullable: YES)
- **status**: text (Nullable: NO) DEFAULT 'active'::text
- **fts**: tsvector (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **category_name**: text (Nullable: YES)
- **manufacturer_name**: text (Nullable: YES) -- cần xây dựng bảng này.
- **distributor_id**: bigint (Nullable: YES) -- chính là bảng supplier, FK đến bảng manufacturer để có thể hiển thị 1 sản phẩm có nhiều nhà cung cấp.
- **invoice_price**: numeric (Nullable: YES) DEFAULT 0 -- Không dùng cột này, giá trị VAT của sản phẩm dùng "vat_rate" trên bảng "vat_inventory_ledger"
- **actual_cost**: numeric (Nullable: NO) DEFAULT 0 -- Không dùng cột này
- **wholesale_unit**: text (Nullable: YES) DEFAULT 'Hộp'::text -- Không dùng cột này
- **retail_unit**: text (Nullable: YES) DEFAULT 'Vỉ'::text -- Không dùng cột này
- **conversion_factor**: integer (Nullable: YES) DEFAULT 1
- **wholesale_margin_value**: numeric (Nullable: YES) DEFAULT 0
- **wholesale_margin_type**: text (Nullable: YES) DEFAULT '%'::text
- **retail_margin_value**: numeric (Nullable: YES) DEFAULT 0
- **retail_margin_type**: text (Nullable: YES) DEFAULT '%'::text
- **items_per_carton**: integer (Nullable: YES) DEFAULT 1
- **carton_weight**: numeric (Nullable: YES) DEFAULT 0
- **carton_dimensions**: text (Nullable: YES)
- **purchasing_policy**: text (Nullable: YES) DEFAULT 'ALLOW_LOOSE'::text
- **registration_number**: text (Nullable: YES)
- **packing_spec**: text (Nullable: YES)
- **stock_management_type**: USER-DEFINED (Nullable: YES) DEFAULT 'lot_date'::stock_management_type
- **wholesale_margin_rate**: numeric (Nullable: YES) DEFAULT 0
- **retail_margin_rate**: numeric (Nullable: YES) DEFAULT 0
- **usage_instructions**: jsonb (Nullable: YES) DEFAULT '{}'::jsonb
- **updated_by**: uuid (Nullable: YES)
- **category_id**: integer (Nullable: YES)
- **manufacturer_id**: integer (Nullable: YES)
- **stock_status**: text (Nullable: YES) DEFAULT 'in_stock'::text

### Table: promotion_gifts

- **id**: bigint (Nullable: NO)
- **name**: text (Nullable: NO)
- **type**: USER-DEFINED (Nullable: NO)
- **quantity**: integer (Nullable: YES) DEFAULT 0
- **estimated_value**: numeric (Nullable: YES) DEFAULT 0
- **received_from_po_id**: bigint (Nullable: YES)
- **status**: text (Nullable: YES) DEFAULT 'active'::text
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **code**: text (Nullable: YES)
- **stock_quantity**: integer (Nullable: YES) DEFAULT 0
- **image_url**: text (Nullable: YES)
- **unit_name**: text (Nullable: YES) DEFAULT 'Cái'::text
- **description**: text (Nullable: YES)
- **min_stock**: integer (Nullable: YES) DEFAULT 0
- **supplier_id**: bigint (Nullable: YES)

### Table: promotion_targets

- **id**: bigint (Nullable: NO)
- **promotion_id**: uuid (Nullable: NO)
- **target_type**: text (Nullable: NO)
- **target_id**: bigint (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: promotion_usages

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **promotion_id**: uuid (Nullable: NO)
- **customer_id**: bigint (Nullable: NO)
- **order_id**: uuid (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **discount_amount**: numeric (Nullable: NO) DEFAULT 0

### Table: promotions

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **code**: text (Nullable: NO)
- **name**: text (Nullable: NO)
- **description**: text (Nullable: YES)
- **type**: text (Nullable: NO)
- **discount_type**: text (Nullable: NO)
- **discount_value**: numeric (Nullable: NO) DEFAULT 0
- **max_discount_value**: numeric (Nullable: YES)
- **min_order_value**: numeric (Nullable: YES) DEFAULT 0
- **apply_to_scope**: text (Nullable: YES) DEFAULT 'all'::text
- **apply_to_ids**: jsonb (Nullable: YES)
- **total_usage_limit**: integer (Nullable: YES)
- **usage_count**: integer (Nullable: YES) DEFAULT 0
- **usage_limit_per_user**: integer (Nullable: YES) DEFAULT 1
- **customer_id**: bigint (Nullable: YES)
- **valid_from**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **valid_to**: timestamp with time zone (Nullable: NO)
- **status**: text (Nullable: YES) DEFAULT 'active'::text
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **customer_type**: text (Nullable: YES) DEFAULT 'B2C'::text

### Table: purchase_order_items

- **id**: bigint (Nullable: NO)
- **po_id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **quantity_ordered**: integer (Nullable: NO)
- **quantity_received**: integer (Nullable: YES) DEFAULT 0
- **unit_price**: numeric (Nullable: NO)
- **unit**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **uom_ordered**: text (Nullable: YES)
- **conversion_factor**: integer (Nullable: YES) DEFAULT 1
- **base_quantity**: integer (Nullable: YES)
- **is_bonus**: boolean (Nullable: YES) DEFAULT false
- **vat_rate**: numeric (Nullable: YES) DEFAULT 0
- **rebate_rate**: numeric (Nullable: YES) DEFAULT 0
- **bonus_quantity**: integer (Nullable: YES) DEFAULT 0
- **allocated_shipping_fee**: numeric (Nullable: YES) DEFAULT 0
- **final_unit_cost**: numeric (Nullable: YES) DEFAULT 0

### Table: purchase_orders

- **id**: bigint (Nullable: NO)
- **code**: text (Nullable: NO)
- **supplier_id**: bigint (Nullable: NO)
- **creator_id**: uuid (Nullable: YES) DEFAULT auth.uid()
- **delivery_status**: text (Nullable: YES) DEFAULT 'pending'::text
- **payment_status**: text (Nullable: YES) DEFAULT 'unpaid'::text
- **total_amount**: numeric (Nullable: NO) DEFAULT 0
- **discount_amount**: numeric (Nullable: YES) DEFAULT 0
- **final_amount**: numeric (Nullable: NO) DEFAULT 0
- **total_paid**: numeric (Nullable: YES) DEFAULT 0
- **expected_delivery_date**: timestamp with time zone (Nullable: YES)
- **note**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **delivery_method**: text (Nullable: YES)
- **status**: text (Nullable: YES) DEFAULT 'DRAFT'::text
- **shipping_partner_id**: bigint (Nullable: YES)
- **shipping_fee**: numeric (Nullable: YES) DEFAULT 0
- **total_packages**: integer (Nullable: YES) DEFAULT 1
- **carrier_name**: text (Nullable: YES)
- **carrier_contact**: text (Nullable: YES)
- **carrier_phone**: text (Nullable: YES)
- **expected_delivery_time**: timestamp with time zone (Nullable: YES)
- **receipt_draft**: jsonb (Nullable: YES) DEFAULT '{}'::jsonb
- **costing_confirmed_at**: timestamp with time zone (Nullable: YES)

### Table: registration_requests

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **business_name**: text (Nullable: NO)
- **tax_code**: text (Nullable: YES)
- **phone**: text (Nullable: NO)
- **email**: text (Nullable: NO)
- **address**: text (Nullable: YES)
- **contact_name**: text (Nullable: NO)
- **contact_phone**: text (Nullable: YES)
- **contact_email**: text (Nullable: YES)
- **note**: text (Nullable: YES)
- **status**: text (Nullable: NO) DEFAULT 'pending'::text
- **rejection_reason**: text (Nullable: YES)
- **approved_customer_b2b_id**: integer (Nullable: YES)
- **approved_portal_user_id**: uuid (Nullable: YES)
- **approved_by**: uuid (Nullable: YES)
- **approved_at**: timestamp with time zone (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **auth_user_id**: uuid (Nullable: YES)

### Table: role_permissions

- **role_id**: uuid (Nullable: NO)
- **permission_key**: text (Nullable: NO)

### Table: roles

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **name**: text (Nullable: NO)
- **description**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: rpc_access_rules

- **function_name**: text (Nullable: NO)
- **required_permission**: text (Nullable: YES)
- **max_calls_per_minute**: integer (Nullable: YES) DEFAULT 60
- **is_write**: boolean (Nullable: YES) DEFAULT false
- **description**: text (Nullable: YES)

### Table: rpc_rate_log

- **id**: bigint (Nullable: NO) DEFAULT nextval('rpc_rate_log_id_seq'::regclass)
- **user_id**: uuid (Nullable: NO)
- **function_name**: text (Nullable: NO)
- **called_at**: timestamp with time zone (Nullable: NO) DEFAULT now()

### Table: sales_invoices

- **id**: bigint (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **invoice_date**: date (Nullable: NO)
- **invoice_number**: text (Nullable: YES)
- **invoice_serial**: text (Nullable: YES)
- **invoice_template_code**: text (Nullable: YES)
- **buyer_name**: text (Nullable: YES)
- **buyer_company_name**: text (Nullable: YES)
- **buyer_tax_code**: text (Nullable: YES)
- **buyer_address**: text (Nullable: YES)
- **buyer_email**: text (Nullable: YES)
- **payment_method**: text (Nullable: YES) DEFAULT 'TM/CK'::text
- **total_amount_pre_tax**: numeric (Nullable: YES) DEFAULT 0
- **vat_rate**: numeric (Nullable: YES) DEFAULT 0
- **vat_amount**: numeric (Nullable: YES) DEFAULT 0
- **final_amount**: numeric (Nullable: YES) DEFAULT 0
- **order_id**: uuid (Nullable: YES)
- **customer_id**: bigint (Nullable: YES)
- **customer_b2c_id**: bigint (Nullable: YES)
- **note**: text (Nullable: YES)
- **status**: text (Nullable: NO) DEFAULT 'pending'::text
- **tracking_code**: text (Nullable: YES)

### Table: sales_return_items

- **id**: bigint (Nullable: NO)
- **return_id**: uuid (Nullable: YES)
- **order_item_id**: uuid (Nullable: YES)
- **product_id**: bigint (Nullable: YES)
- **warehouse_id**: bigint (Nullable: YES)
- **quantity**: integer (Nullable: NO)
- **refund_price**: numeric (Nullable: YES) DEFAULT 0
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: sales_returns

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **code**: text (Nullable: NO)
- **order_id**: uuid (Nullable: YES)
- **customer_id**: bigint (Nullable: YES)
- **customer_b2c_id**: bigint (Nullable: YES)
- **status**: text (Nullable: YES) DEFAULT 'COMPLETED'::text
- **total_refund_amount**: numeric (Nullable: YES) DEFAULT 0
- **note**: text (Nullable: YES)
- **created_by**: uuid (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: service_consumables

- **id**: bigint (Nullable: NO)
- **service_product_id**: bigint (Nullable: YES)
- **consumable_product_id**: bigint (Nullable: YES)
- **quantity**: integer (Nullable: YES) DEFAULT 1
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: service_package_items

- **id**: bigint (Nullable: NO) DEFAULT nextval('service_package_items_id_seq'::regclass)
- **package_id**: bigint (Nullable: NO)
- **item_id**: bigint (Nullable: NO)
- **quantity**: numeric (Nullable: NO) DEFAULT 1
- **item_type**: text (Nullable: NO) DEFAULT 'consumable'::text
- **schedule_days**: integer (Nullable: YES) DEFAULT 0

### Table: service_packages

- **id**: bigint (Nullable: NO) DEFAULT nextval('service_packages_id_seq'::regclass)
- **name**: text (Nullable: NO)
- **sku**: text (Nullable: NO)
- **unit**: text (Nullable: NO) DEFAULT 'Lần'::text
- **type**: USER-DEFINED (Nullable: NO) DEFAULT 'service'::service_package_type
- **price**: numeric (Nullable: NO) DEFAULT 0
- **total_cost_price**: numeric (Nullable: NO) DEFAULT 0
- **revenue_account_id**: text (Nullable: YES)
- **valid_from**: date (Nullable: NO)
- **valid_to**: date (Nullable: NO)
- **status**: USER-DEFINED (Nullable: NO) DEFAULT 'active'::account_status
- **validity_days**: integer (Nullable: YES)
- **applicable_branches**: ARRAY (Nullable: YES)
- **applicable_channels**: text (Nullable: NO) DEFAULT 'all'::text
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **clinical_category**: text (Nullable: YES) DEFAULT 'none'::text

### Table: shipping_addresses

- **id**: bigint (Nullable: NO)
- **customer_b2b_id**: bigint (Nullable: NO)
- **label**: text (Nullable: YES)
- **province_code**: text (Nullable: NO)
- **district_code**: text (Nullable: NO)
- **ward_code**: text (Nullable: NO)
- **street**: text (Nullable: YES)
- **full_address**: text (Nullable: NO)
- **is_default**: boolean (Nullable: YES) DEFAULT false
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: shipping_fee_config

- **id**: bigint (Nullable: NO)
- **delivery_method**: text (Nullable: NO)
- **flat_fee**: numeric (Nullable: NO) DEFAULT 0
- **estimated_days_min**: integer (Nullable: NO) DEFAULT 0
- **estimated_days_max**: integer (Nullable: NO) DEFAULT 0
- **estimated_text**: text (Nullable: YES)
- **is_active**: boolean (Nullable: NO) DEFAULT true
- **updated_at**: timestamp with time zone (Nullable: NO) DEFAULT now()

### Table: shipping_partners

- **id**: bigint (Nullable: NO) DEFAULT nextval('shipping_partners_id_seq'::regclass)
- **name**: text (Nullable: NO)
- **type**: USER-DEFINED (Nullable: NO) DEFAULT 'app'::shipping_partner_type
- **contact_person**: text (Nullable: YES)
- **phone**: text (Nullable: YES)
- **email**: text (Nullable: YES)
- **address**: text (Nullable: YES)
- **notes**: text (Nullable: YES)
- **status**: USER-DEFINED (Nullable: NO) DEFAULT 'active'::account_status
- **cut_off_time**: time without time zone (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: shipping_rules

- **id**: bigint (Nullable: NO) DEFAULT nextval('shipping_rules_id_seq'::regclass)
- **partner_id**: bigint (Nullable: NO)
- **zone_name**: text (Nullable: NO)
- **speed_hours**: integer (Nullable: YES)
- **fee**: numeric (Nullable: YES) DEFAULT 0

### Table: supplier_program_groups

- **id**: bigint (Nullable: NO)
- **program_id**: bigint (Nullable: YES)
- **name**: text (Nullable: NO)
- **rule_type**: text (Nullable: YES)
- **rules**: jsonb (Nullable: YES) DEFAULT '{}'::jsonb
- **price_basis**: text (Nullable: YES) DEFAULT 'pre_vat'::text
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: supplier_program_products

- **group_id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: supplier_programs

- **id**: bigint (Nullable: NO)
- **supplier_id**: bigint (Nullable: NO)
- **code**: text (Nullable: YES)
- **name**: text (Nullable: NO)
- **type**: USER-DEFINED (Nullable: NO)
- **rebate_percentage**: numeric (Nullable: YES) DEFAULT 0
- **valid_from**: date (Nullable: NO)
- **valid_to**: date (Nullable: NO)
- **status**: text (Nullable: YES) DEFAULT 'active'::text
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **document_code**: text (Nullable: YES)
- **attachment_url**: text (Nullable: YES)
- **description**: text (Nullable: YES)

### Table: supplier_wallet_transactions

- **id**: bigint (Nullable: NO)
- **supplier_id**: bigint (Nullable: YES)
- **amount**: numeric (Nullable: NO)
- **type**: text (Nullable: YES)
- **reference_id**: text (Nullable: YES)
- **description**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: supplier_wallets

- **supplier_id**: bigint (Nullable: NO)
- **balance**: numeric (Nullable: YES) DEFAULT 0
- **total_earned**: numeric (Nullable: YES) DEFAULT 0
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: suppliers

- **id**: bigint (Nullable: NO) DEFAULT nextval('suppliers_id_seq'::regclass)
- **name**: text (Nullable: NO)
- **contact_person**: text (Nullable: YES)
- **phone**: text (Nullable: YES)
- **email**: text (Nullable: YES)
- **address**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **tax_code**: text (Nullable: YES)
- **payment_term**: text (Nullable: YES)
- **bank_account**: text (Nullable: YES)
- **bank_name**: text (Nullable: YES)
- **bank_holder**: text (Nullable: YES)
- **delivery_method**: text (Nullable: YES)
- **lead_time**: integer (Nullable: YES)
- **status**: text (Nullable: NO) DEFAULT 'active'::text
- **notes**: text (Nullable: YES) DEFAULT 'active'::text
- **bank_bin**: text (Nullable: YES)

### Table: system_logs

- **id**: bigint (Nullable: NO)
- **user_id**: uuid (Nullable: YES)
- **module**: text (Nullable: NO)
- **action**: text (Nullable: NO)
- **record_id**: text (Nullable: YES)
- **old_data**: jsonb (Nullable: YES)
- **new_data**: jsonb (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **user_name**: text (Nullable: YES)

### Table: system_settings

- **key**: text (Nullable: NO)
- **value**: jsonb (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **description**: text (Nullable: YES)

### Table: tasks

- **id**: uuid (Nullable: NO) DEFAULT gen_random_uuid()
- **title**: text (Nullable: NO)
- **description**: text (Nullable: YES)
- **status**: text (Nullable: YES) DEFAULT 'todo'::text
- **priority**: text (Nullable: YES) DEFAULT 'medium'::text
- **assigner_id**: uuid (Nullable: YES)
- **assignee_id**: uuid (Nullable: NO)
- **entity_type**: text (Nullable: YES) DEFAULT 'none'::text
- **entity_id**: text (Nullable: YES)
- **due_date**: timestamp with time zone (Nullable: NO)
- **completed_at**: timestamp with time zone (Nullable: YES)
- **kpi_points**: integer (Nullable: YES) DEFAULT 0
- **ai_metadata**: jsonb (Nullable: YES) DEFAULT '{}'::jsonb
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: transaction_categories

- **id**: bigint (Nullable: NO) DEFAULT nextval('transaction_categories_id_seq'::regclass)
- **code**: text (Nullable: NO)
- **name**: text (Nullable: NO)
- **type**: USER-DEFINED (Nullable: NO)
- **account_id**: text (Nullable: YES)
- **status**: USER-DEFINED (Nullable: NO) DEFAULT 'active'::account_status
- **description**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: transport_vehicles

- **id**: bigint (Nullable: NO)
- **name**: text (Nullable: NO)
- **phone**: text (Nullable: YES)
- **route**: text (Nullable: YES)
- **status**: USER-DEFINED (Nullable: YES) DEFAULT 'active'::account_status
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: user_roles

- **id**: bigint (Nullable: NO) DEFAULT nextval('user_roles_id_seq'::regclass)
- **user_id**: uuid (Nullable: NO)
- **role_id**: uuid (Nullable: NO)
- **branch_id**: bigint (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: users

- **id**: uuid (Nullable: NO)
- **email**: text (Nullable: YES)
- **full_name**: text (Nullable: YES)
- **avatar_url**: text (Nullable: YES)
- **employee_code**: text (Nullable: YES)
- **position**: text (Nullable: YES)
- **status**: USER-DEFINED (Nullable: NO) DEFAULT 'pending_approval'::employee_status
- **dob**: date (Nullable: YES)
- **phone**: text (Nullable: YES)
- **gender**: text (Nullable: YES)
- **cccd**: text (Nullable: YES)
- **cccd_issue_date**: date (Nullable: YES)
- **address**: text (Nullable: YES)
- **marital_status**: text (Nullable: YES)
- **cccd_front_url**: text (Nullable: YES)
- **cccd_back_url**: text (Nullable: YES)
- **education_level**: text (Nullable: YES)
- **specialization**: text (Nullable: YES)
- **bank_name**: text (Nullable: YES)
- **bank_account_number**: text (Nullable: YES)
- **bank_account_name**: text (Nullable: YES)
- **hobbies**: text (Nullable: YES)
- **limitations**: text (Nullable: YES)
- **strengths**: text (Nullable: YES)
- **needs**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **profile_updated_at**: timestamp with time zone (Nullable: YES)
- **work_state**: text (Nullable: YES) DEFAULT 'working'::text
- **role_id**: uuid (Nullable: YES)
- **company_id**: bigint (Nullable: YES)
- **warehouse_id**: bigint (Nullable: YES)

### Table: v_active_deals

- **product_id**: integer (Nullable: YES)
- **deal_id**: integer (Nullable: YES)
- **deal_name**: text (Nullable: YES)
- **deal_slug**: text (Nullable: YES)
- **discount_type**: text (Nullable: YES)
- **discount_value**: numeric (Nullable: YES)
- **start_date**: timestamp with time zone (Nullable: YES)
- **end_date**: timestamp with time zone (Nullable: YES)

### Table: vaccination_template_items

- **id**: bigint (Nullable: NO)
- **template_id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **shot_name**: text (Nullable: NO)
- **days_after_start**: integer (Nullable: YES) DEFAULT 0
- **note**: text (Nullable: YES)

### Table: vaccination_templates

- **id**: bigint (Nullable: NO)
- **name**: text (Nullable: NO)
- **description**: text (Nullable: YES)
- **min_age_months**: integer (Nullable: YES)
- **max_age_months**: integer (Nullable: YES)
- **status**: text (Nullable: YES) DEFAULT 'active'::text
- **created_at**: timestamp with time zone (Nullable: NO) DEFAULT now()
- **updated_at**: timestamp with time zone (Nullable: NO) DEFAULT now()

### Table: vat_inventory_ledger

- **id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **vat_rate**: numeric (Nullable: NO) DEFAULT 0
- **quantity_balance**: numeric (Nullable: NO) DEFAULT 0
- **total_value_balance**: numeric (Nullable: NO) DEFAULT 0
- **updated_at**: timestamp with time zone (Nullable: YES) DEFAULT now()

### Table: vendor_product_mappings

- **id**: bigint (Nullable: NO)
- **vendor_tax_code**: text (Nullable: NO)
- **vendor_product_name**: text (Nullable: NO)
- **internal_product_id**: bigint (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **last_used_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **updated_by**: uuid (Nullable: YES)
- **vendor_unit**: text (Nullable: YES)
- **internal_unit**: text (Nullable: YES)

### Table: vw_task_board

- **id**: uuid (Nullable: YES)
- **title**: text (Nullable: YES)
- **description**: text (Nullable: YES)
- **status**: text (Nullable: YES)
- **priority**: text (Nullable: YES)
- **assigner_id**: uuid (Nullable: YES)
- **assignee_id**: uuid (Nullable: YES)
- **entity_type**: text (Nullable: YES)
- **entity_id**: text (Nullable: YES)
- **due_date**: timestamp with time zone (Nullable: YES)
- **completed_at**: timestamp with time zone (Nullable: YES)
- **kpi_points**: integer (Nullable: YES)
- **ai_metadata**: jsonb (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **assignee_name**: text (Nullable: YES)
- **assignee_avatar**: text (Nullable: YES)
- **assigner_name**: text (Nullable: YES)
- **assigner_avatar**: text (Nullable: YES)

### Table: warehouses

- **id**: bigint (Nullable: NO) DEFAULT nextval('warehouses_id_seq'::regclass)
- **key**: text (Nullable: NO)
- **name**: text (Nullable: NO)
- **unit**: text (Nullable: NO) DEFAULT 'Hộp'::text
- **created_at**: timestamp with time zone (Nullable: YES) DEFAULT now()
- **address**: text (Nullable: YES)
- **type**: text (Nullable: NO) DEFAULT 'retail'::text
- **latitude**: numeric (Nullable: YES)
- **longitude**: numeric (Nullable: YES)
- **code**: text (Nullable: YES)
- **manager**: text (Nullable: YES)
- **phone**: text (Nullable: YES)
- **status**: text (Nullable: NO) DEFAULT 'active'::text

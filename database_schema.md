# Database Schema

Cập nhật tự động.


## Table: _revert_double_deduct_20260417
_Backup snapshot trước khi revert 10 đơn double-deduct (2026-04-17). Giữ để rollback. An toàn xóa sau 30 ngày nếu không cần rollback._

- **id**: bigint (Nullable: NO)
- **snapshot_at**: timestamp with time zone (Nullable: NO)
- **action**: text (Nullable: NO)
- **payload**: jsonb (Nullable: NO)

## Table: _revert_double_deduct_20260418
_Backup đợt 2 (2026-04-18): 5 đơn double-deduct do bug case-sensitivity 20260417115000. Giữ để rollback._

- **id**: bigint (Nullable: NO)
- **snapshot_at**: timestamp with time zone (Nullable: NO)
- **action**: text (Nullable: NO)
- **payload**: jsonb (Nullable: NO)

## Table: _revert_double_deduct_20260423
_Backup snapshot trước khi revert 6 đơn double-deduct batch 3 (2026-04-23). Giữ để rollback. An toàn xóa sau 30 ngày nếu không cần._

- **id**: bigint (Nullable: NO)
- **snapshot_at**: timestamp with time zone (Nullable: NO)
- **action**: text (Nullable: NO)
- **payload**: jsonb (Nullable: NO)

## Table: _stock_adjust_oversell_failures

- **id**: bigint (Nullable: NO)
- **order_code**: text (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **uom**: text (Nullable: NO)
- **missing_base_qty**: numeric (Nullable: NO)
- **error_message**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO)

## Table: _unit_normalize_skipped

- **id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: YES)
- **variant**: text (Nullable: YES)
- **canonical**: text (Nullable: YES)
- **variant_conv**: numeric (Nullable: YES)
- **existing_canonical_conv**: numeric (Nullable: YES)
- **unit_type**: text (Nullable: YES)
- **reason**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: appointments

- **id**: uuid (Nullable: NO)
- **customer_id**: bigint (Nullable: NO)
- **doctor_id**: uuid (Nullable: YES)
- **service_type**: USER-DEFINED (Nullable: YES)
- **appointment_time**: timestamp with time zone (Nullable: NO)
- **status**: USER-DEFINED (Nullable: YES)
- **symptoms**: jsonb (Nullable: YES)
- **note**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **priority**: text (Nullable: YES)
- **contact_status**: text (Nullable: YES)
- **room_id**: bigint (Nullable: YES)
- **service_ids**: ARRAY (Nullable: YES)
- **created_by**: uuid (Nullable: YES)
- **check_in_time**: timestamp with time zone (Nullable: YES)

## Table: asset_maintenance_history

- **id**: bigint (Nullable: NO)
- **asset_id**: bigint (Nullable: NO) - id định danh cho tài sản
- **maintenance_date**: date (Nullable: NO)
- **content**: text (Nullable: NO)
- **cost**: numeric (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: asset_maintenance_plans

- **id**: bigint (Nullable: NO)
- **asset_id**: bigint (Nullable: NO)
- **content**: text (Nullable: NO)
- **frequency_months**: integer (Nullable: NO)
- **exec_type**: USER-DEFINED (Nullable: NO)
- **assigned_user_id**: uuid (Nullable: YES)
- **provider_name**: text (Nullable: YES)
- **provider_phone**: text (Nullable: YES)
- **provider_note**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: asset_types

- **id**: bigint (Nullable: NO)
- **name**: text (Nullable: NO)
- **description**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: assets

- **id**: bigint (Nullable: NO)
- **asset_code**: text (Nullable: YES)
- **name**: text (Nullable: NO)
- **description**: text (Nullable: YES)
- **serial_number**: text (Nullable: YES)
- **image_url**: text (Nullable: YES)
- **asset_type_id**: bigint (Nullable: YES)
- **branch_id**: bigint (Nullable: YES)
- **user_id**: uuid (Nullable: YES)
- **status**: USER-DEFINED (Nullable: NO)
- **handed_over_date**: date (Nullable: YES)
- **purchase_date**: date (Nullable: YES)
- **supplier_id**: bigint (Nullable: YES)
- **cost**: numeric (Nullable: YES)
- **depreciation_months**: integer (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: b2b_customer_debt_view

- **customer_id**: bigint (Nullable: YES)
- **customer_code**: text (Nullable: YES)
- **customer_name**: text (Nullable: YES)
- **customer_phone**: text (Nullable: YES)
- **total_invoiced**: numeric (Nullable: YES)
- **total_paid**: numeric (Nullable: YES)
- **actual_current_debt**: numeric (Nullable: YES)

## Table: b2b_notifications
_Thông báo cho khách hàng B2B trên Portal_

- **id**: uuid (Nullable: NO)
- **customer_b2b_id**: bigint (Nullable: YES) - NULL = broadcast cho tất cả khách hàng
- **type**: USER-DEFINED (Nullable: NO)
- **title**: text (Nullable: NO)
- **body**: text (Nullable: YES)
- **data**: jsonb (Nullable: YES) - JSON context: order_id, invoice_id, url, ...
- **is_read**: boolean (Nullable: NO)
- **read_at**: timestamp with time zone (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO)

## Table: b2b_push_subscriptions
_Web Push subscriptions cho portal users_

- **id**: uuid (Nullable: NO)
- **portal_user_id**: uuid (Nullable: NO)
- **endpoint**: text (Nullable: NO)
- **p256dh**: text (Nullable: NO)
- **auth**: text (Nullable: NO)
- **user_agent**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO)

## Table: banks

- **id**: bigint (Nullable: NO)
- **name**: text (Nullable: NO)
- **code**: text (Nullable: NO)
- **bin**: text (Nullable: NO)
- **short_name**: text (Nullable: NO)
- **logo**: text (Nullable: YES)
- **status**: text (Nullable: NO)
- **transfer_supported**: boolean (Nullable: YES)
- **lookup_supported**: boolean (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: batch_revaluations
_Audit trail cho mọi lần điều chỉnh giá vốn theo lô (batches.inbound_price)_

- **id**: bigint (Nullable: NO)
- **batch_id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **warehouse_id**: bigint (Nullable: YES)
- **old_price**: numeric (Nullable: NO)
- **new_price**: numeric (Nullable: NO)
- **qty_at_change**: integer (Nullable: NO)
- **delta_value**: numeric (Nullable: YES)
- **reason_code**: text (Nullable: NO)
- **note**: text (Nullable: YES)
- **vat_synced**: boolean (Nullable: NO)
- **user_id**: uuid (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO)

## Table: batches

- **id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: YES)
- **batch_code**: text (Nullable: NO)
- **expiry_date**: date (Nullable: NO)
- **manufacturing_date**: date (Nullable: YES)
- **inbound_price**: numeric (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: categories

- **id**: integer (Nullable: NO)
- **name**: text (Nullable: NO)
- **slug**: text (Nullable: NO)
- **parent_id**: integer (Nullable: YES)
- **image_url**: text (Nullable: YES)
- **sort_order**: integer (Nullable: YES)
- **status**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO)
- **updated_at**: timestamp with time zone (Nullable: NO)

## Table: chart_of_accounts

- **id**: uuid (Nullable: NO)
- **account_code**: text (Nullable: NO)
- **name**: text (Nullable: NO)
- **parent_id**: uuid (Nullable: YES)
- **type**: USER-DEFINED (Nullable: NO)
- **balance_type**: USER-DEFINED (Nullable: NO)
- **status**: USER-DEFINED (Nullable: NO)
- **allow_posting**: boolean (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: chat_cache
_Response cache 10 phút cho chatbot — key = sha256(user_id|normalized_query). RLS chỉ service_role._

- **cache_key**: text (Nullable: NO)
- **response**: jsonb (Nullable: NO)
- **hits**: integer (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: NO)
- **expires_at**: timestamp with time zone (Nullable: NO)

## Table: chat_compliance_audits

- **id**: uuid (Nullable: NO)
- **message_id**: uuid (Nullable: NO)
- **session_id**: uuid (Nullable: NO)
- **rule_code**: text (Nullable: NO)
- **severity**: text (Nullable: NO)
- **matched_keywords**: ARRAY (Nullable: YES)
- **excerpt**: text (Nullable: YES)
- **status**: text (Nullable: NO)
- **reviewer_id**: uuid (Nullable: YES)
- **reviewed_at**: timestamp with time zone (Nullable: YES)
- **reviewer_note**: text (Nullable: YES)
- **audited_at**: timestamp with time zone (Nullable: NO)

## Table: chat_feedback
_Phản hồi sales về chất lượng bot — dùng cho training data._

- **id**: uuid (Nullable: NO)
- **message_id**: uuid (Nullable: NO)
- **reporter_id**: uuid (Nullable: NO)
- **feedback_type**: text (Nullable: NO)
- **note**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO)

## Table: chat_feedback_weekly_clusters
_C7 feedback loop: cụm keyword frequent từ wrong_answer feedback theo tuần._

- **id**: bigint (Nullable: NO)
- **week_start**: date (Nullable: NO)
- **pattern_keyword**: text (Nullable: NO)
- **sample_message_ids**: ARRAY (Nullable: NO)
- **feedback_count**: integer (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: NO)

## Table: chat_handoffs
_Yêu cầu chuyển phiên chat từ bot sang sales — resolved_at NULL = chờ xử lý._

- **id**: uuid (Nullable: NO)
- **session_id**: uuid (Nullable: NO)
- **reason**: text (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: NO)
- **resolved_at**: timestamp with time zone (Nullable: YES)

## Table: chat_messages
_Tin nhắn trong phiên chat — soft delete qua deleted_at để audit._

- **id**: uuid (Nullable: NO)
- **session_id**: uuid (Nullable: NO)
- **role**: text (Nullable: NO)
- **content_type**: text (Nullable: NO)
- **content**: text (Nullable: YES)
- **attachments**: jsonb (Nullable: YES)
- **llm_meta**: jsonb (Nullable: YES)
- **intent**: text (Nullable: YES)
- **entities**: jsonb (Nullable: YES)
- **deleted_at**: timestamp with time zone (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO)

## Table: chat_sessions
_Phiên chat Phase 1 MVP — 1 user có thể có nhiều phiên (mỗi platform 1 phiên active)._

- **id**: uuid (Nullable: NO)
- **user_id**: uuid (Nullable: NO)
- **status**: text (Nullable: NO)
- **assigned_sales_id**: uuid (Nullable: YES)
- **draft_cart_id**: uuid (Nullable: YES)
- **platform**: text (Nullable: NO)
- **context**: jsonb (Nullable: NO)
- **started_at**: timestamp with time zone (Nullable: NO)
- **last_activity_at**: timestamp with time zone (Nullable: NO)
- **closed_at**: timestamp with time zone (Nullable: YES)

## Table: clinical_prescription_items

- **id**: uuid (Nullable: NO)
- **prescription_id**: uuid (Nullable: YES)
- **product_id**: bigint (Nullable: YES)
- **product_unit_id**: bigint (Nullable: YES)
- **quantity**: numeric (Nullable: NO)
- **usage_note**: text (Nullable: YES)
- **unit_price_snapshot**: numeric (Nullable: YES)

## Table: clinical_prescriptions

- **id**: uuid (Nullable: NO)
- **visit_id**: uuid (Nullable: YES)
- **customer_id**: bigint (Nullable: YES)
- **doctor_id**: uuid (Nullable: YES)
- **code**: text (Nullable: YES)
- **advice**: text (Nullable: YES)
- **re_exam_date**: date (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: clinical_queues

- **id**: bigint (Nullable: NO)
- **appointment_id**: uuid (Nullable: YES)
- **customer_id**: bigint (Nullable: NO)
- **doctor_id**: uuid (Nullable: YES)
- **queue_number**: integer (Nullable: NO)
- **status**: USER-DEFINED (Nullable: YES)
- **priority_level**: USER-DEFINED (Nullable: YES)
- **checked_in_at**: timestamp with time zone (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: clinical_service_requests

- **id**: bigint (Nullable: NO)
- **medical_visit_id**: uuid (Nullable: YES)
- **patient_id**: bigint (Nullable: YES)
- **doctor_id**: uuid (Nullable: YES)
- **service_package_id**: bigint (Nullable: YES)
- **service_name_snapshot**: text (Nullable: YES)
- **category**: text (Nullable: YES)
- **status**: text (Nullable: YES)
- **results_json**: jsonb (Nullable: YES)
- **imaging_result**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **created_by**: uuid (Nullable: YES)
- **payment_order_id**: uuid (Nullable: YES)

## Table: companies

- **id**: uuid (Nullable: NO)
- **tax_code**: text (Nullable: NO)
- **name**: text (Nullable: NO)
- **short_name**: text (Nullable: YES)
- **address**: text (Nullable: NO)
- **phone**: text (Nullable: NO)
- **email**: text (Nullable: NO)
- **logo_url**: text (Nullable: YES)
- **representative_name**: text (Nullable: NO)
- **business_license_url**: ARRAY (Nullable: YES)
- **mission**: text (Nullable: YES)
- **vision**: text (Nullable: YES)
- **status**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **deleted_at**: timestamp with time zone (Nullable: YES)

## Table: connect_comments

- **id**: bigint (Nullable: NO)
- **post_id**: bigint (Nullable: NO)
- **user_id**: uuid (Nullable: NO)
- **content**: text (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: connect_likes

- **id**: bigint (Nullable: NO)
- **post_id**: bigint (Nullable: NO)
- **user_id**: uuid (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: connect_posts
_Lưu trữ Thông báo, Góp ý và Tài liệu nội bộ_

- **id**: bigint (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES)
- **creator_id**: uuid (Nullable: YES)
- **category**: text (Nullable: NO)
- **title**: text (Nullable: NO)
- **summary**: text (Nullable: YES)
- **content**: text (Nullable: YES)
- **is_pinned**: boolean (Nullable: YES)
- **is_anonymous**: boolean (Nullable: YES)
- **priority**: text (Nullable: YES)
- **status**: text (Nullable: YES)
- **must_confirm**: boolean (Nullable: YES)
- **reward_points**: integer (Nullable: YES)
- **feedback_response**: text (Nullable: YES)
- **response_by**: uuid (Nullable: YES)
- **responded_at**: timestamp with time zone (Nullable: YES)
- **tags**: ARRAY (Nullable: YES)
- **attachments**: ARRAY (Nullable: YES)
- **is_locked**: boolean (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: connect_reads

- **post_id**: bigint (Nullable: NO)
- **user_id**: uuid (Nullable: NO)
- **confirmed_at**: timestamp with time zone (Nullable: YES)

## Table: customer_b2b_contacts

- **id**: bigint (Nullable: NO)
- **customer_b2b_id**: bigint (Nullable: NO)
- **name**: text (Nullable: NO)
- **position**: text (Nullable: YES)
- **phone**: text (Nullable: YES)
- **email**: text (Nullable: YES)
- **is_primary**: boolean (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: customer_favorites

- **id**: uuid (Nullable: NO)
- **customer_b2b_id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: customer_guardians

- **id**: bigint (Nullable: NO)
- **customer_id**: bigint (Nullable: NO)
- **guardian_id**: bigint (Nullable: NO)
- **relationship**: text (Nullable: YES)

## Table: customer_segment_members

- **id**: bigint (Nullable: NO)
- **segment_id**: bigint (Nullable: NO)
- **customer_id**: bigint (Nullable: NO)
- **added_at**: timestamp with time zone (Nullable: YES)

## Table: customer_segments
_Lưu trữ các nhóm khách hàng (Tĩnh và Động)_

- **id**: bigint (Nullable: NO)
- **name**: text (Nullable: NO)
- **description**: text (Nullable: YES)
- **type**: text (Nullable: NO)
- **criteria**: jsonb (Nullable: YES)
- **is_active**: boolean (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: customer_service_wallets

- **id**: bigint (Nullable: NO)
- **customer_id**: bigint (Nullable: NO)
- **order_id**: uuid (Nullable: YES)
- **package_id**: bigint (Nullable: YES)
- **product_id**: bigint (Nullable: NO)
- **total_quantity**: integer (Nullable: NO)
- **used_quantity**: integer (Nullable: YES)
- **expiry_date**: date (Nullable: YES)
- **status**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: customer_vaccination_records

- **id**: bigint (Nullable: NO)
- **customer_id**: bigint (Nullable: NO)
- **order_id**: uuid (Nullable: YES)
- **medical_visit_id**: uuid (Nullable: YES)
- **package_id**: bigint (Nullable: YES)
- **product_id**: bigint (Nullable: NO)
- **dose_number**: integer (Nullable: NO)
- **expected_date**: date (Nullable: NO)
- **actual_date**: date (Nullable: YES)
- **appointment_id**: uuid (Nullable: YES)
- **status**: text (Nullable: YES)
- **consulted_by**: uuid (Nullable: YES)
- **administered_by**: uuid (Nullable: YES)
- **updated_by**: uuid (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: customer_vouchers

- **id**: bigint (Nullable: NO)
- **customer_id**: bigint (Nullable: NO)
- **promotion_id**: uuid (Nullable: NO)
- **code**: text (Nullable: NO)
- **status**: text (Nullable: NO)
- **used_at**: timestamp with time zone (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **usage_remaining**: integer (Nullable: YES)

## Table: customers

- **id**: bigint (Nullable: NO)
- **customer_code**: text (Nullable: YES)
- **name**: text (Nullable: NO)
- **type**: USER-DEFINED (Nullable: NO)
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
- **loyalty_points**: integer (Nullable: YES)
- **status**: USER-DEFINED (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **contact_person_phone**: text (Nullable: YES)
- **last_purchase_at**: timestamp with time zone (Nullable: YES) - Thời điểm hoàn thành đơn hàng gần nhất (Dùng cho CRM Retention)
- **updated_by**: uuid (Nullable: YES)

## Table: customers_b2b

- **id**: bigint (Nullable: NO)
- **customer_code**: text (Nullable: YES)
- **name**: text (Nullable: NO)
- **tax_code**: text (Nullable: YES)
- **debt_limit**: numeric (Nullable: YES)
- **payment_term**: integer (Nullable: YES)
- **ranking**: text (Nullable: YES)
- **business_license_number**: text (Nullable: YES)
- **business_license_url**: text (Nullable: YES)
- **sales_staff_id**: uuid (Nullable: YES)
- **status**: USER-DEFINED (Nullable: NO)
- **phone**: text (Nullable: YES)
- **email**: text (Nullable: YES)
- **vat_address**: text (Nullable: YES)
- **shipping_address**: text (Nullable: YES)
- **gps_lat**: numeric (Nullable: YES)
- **gps_long**: numeric (Nullable: YES)
- **bank_name**: text (Nullable: YES)
- **bank_account_name**: text (Nullable: YES)
- **bank_account_number**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **loyalty_points**: integer (Nullable: YES)
- **current_debt**: numeric (Nullable: YES)
- **current_debt_bak**: numeric (Nullable: YES)

## Table: deal_items

- **id**: integer (Nullable: NO)
- **deal_id**: integer (Nullable: NO)
- **product_id**: integer (Nullable: NO)
- **override_discount_type**: text (Nullable: YES)
- **override_discount_value**: numeric (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO)

## Table: delivery_routes

- **id**: bigint (Nullable: NO)
- **day_of_week**: smallint (Nullable: NO)
- **route_name**: text (Nullable: NO)
- **district_codes**: ARRAY (Nullable: NO)
- **is_active**: boolean (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: delivery_schedule_overrides

- **id**: bigint (Nullable: NO)
- **override_date**: date (Nullable: NO)
- **route_name**: text (Nullable: YES)
- **district_codes**: ARRAY (Nullable: YES)
- **reason**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: document_templates

- **id**: bigint (Nullable: NO)
- **name**: text (Nullable: NO)
- **module**: USER-DEFINED (Nullable: NO)
- **type**: USER-DEFINED (Nullable: NO)
- **status**: USER-DEFINED (Nullable: NO)
- **content**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: finance_invoice_allocations

- **id**: bigint (Nullable: NO)
- **invoice_id**: bigint (Nullable: YES)
- **po_id**: bigint (Nullable: YES)
- **allocated_amount**: numeric (Nullable: YES)
- **note**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: finance_invoices

- **id**: bigint (Nullable: NO)
- **invoice_number**: text (Nullable: YES)
- **invoice_symbol**: text (Nullable: YES)
- **invoice_date**: date (Nullable: YES)
- **supplier_name_raw**: text (Nullable: YES)
- **supplier_tax_code**: text (Nullable: YES)
- **supplier_id**: bigint (Nullable: YES)
- **total_amount_pre_tax**: numeric (Nullable: YES)
- **tax_amount**: numeric (Nullable: YES)
- **total_amount_post_tax**: numeric (Nullable: YES)
- **items_json**: jsonb (Nullable: YES) - Chứa mảng items: [{name, unit, qty, price, total, vat_rate, lot, exp}]
- **parsed_data**: jsonb (Nullable: YES)
- **file_url**: text (Nullable: YES)
- **file_type**: text (Nullable: YES)
- **status**: text (Nullable: YES)
- **created_by**: uuid (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **supplier_address_raw**: text (Nullable: YES)
- **direction**: text (Nullable: YES)
- **buyer_tax_code**: text (Nullable: YES)
- **raw_items**: jsonb (Nullable: YES)

## Table: finance_transactions

- **id**: bigint (Nullable: NO)
- **code**: text (Nullable: NO)
- **transaction_date**: timestamp with time zone (Nullable: NO)
- **flow**: USER-DEFINED (Nullable: NO)
- **business_type**: USER-DEFINED (Nullable: NO)
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
- **created_by**: uuid (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **status**: USER-DEFINED (Nullable: NO)
- **cash_tally**: jsonb (Nullable: YES)
- **ref_advance_id**: bigint (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **target_bank_info**: jsonb (Nullable: YES)
- **bank_reference_id**: text (Nullable: YES) - Mã giao dịch từ ngân hàng (VD: FT26079200907740) dùng để chống trùng lặp

## Table: fund_accounts

- **id**: bigint (Nullable: NO)
- **name**: text (Nullable: NO)
- **type**: USER-DEFINED (Nullable: NO)
- **location**: text (Nullable: YES)
- **account_number**: text (Nullable: YES)
- **bank_id**: bigint (Nullable: YES)
- **initial_balance**: numeric (Nullable: NO)
- **status**: USER-DEFINED (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **currency**: text (Nullable: YES)
- **balance**: numeric (Nullable: NO)
- **bank_info**: jsonb (Nullable: YES)
- **description**: text (Nullable: YES)

## Table: inventory_batches

- **id**: bigint (Nullable: NO)
- **warehouse_id**: bigint (Nullable: YES)
- **product_id**: bigint (Nullable: YES)
- **batch_id**: bigint (Nullable: YES)
- **quantity**: numeric (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: inventory_check_items

- **id**: bigint (Nullable: NO)
- **check_id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **batch_code**: text (Nullable: YES)
- **expiry_date**: date (Nullable: YES)
- **system_quantity**: numeric (Nullable: YES)
- **actual_quantity**: numeric (Nullable: YES)
- **cost_price**: numeric (Nullable: YES)
- **location_snapshot**: text (Nullable: YES)
- **difference_reason**: text (Nullable: YES)
- **counted_by**: uuid (Nullable: YES)
- **counted_at**: timestamp with time zone (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **created_by**: uuid (Nullable: YES)
- **diff_quantity**: numeric (Nullable: YES)

## Table: inventory_checks

- **id**: bigint (Nullable: NO)
- **code**: text (Nullable: NO)
- **warehouse_id**: bigint (Nullable: NO)
- **total_system_value**: numeric (Nullable: YES)
- **total_actual_value**: numeric (Nullable: YES)
- **total_diff_value**: numeric (Nullable: YES)
- **status**: text (Nullable: YES)
- **note**: text (Nullable: YES)
- **created_by**: uuid (Nullable: YES)
- **verified_by**: uuid (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **completed_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: inventory_receipt_items

- **id**: bigint (Nullable: NO)
- **receipt_id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **quantity**: integer (Nullable: NO)
- **lot_number**: text (Nullable: YES)
- **expiry_date**: date (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **serial_number**: text (Nullable: YES)
- **qc_status**: text (Nullable: YES)
- **unit_price**: numeric (Nullable: NO)
- **discount_amount**: numeric (Nullable: YES)
- **vat_rate**: numeric (Nullable: YES)
- **sub_total**: numeric (Nullable: YES)
- **allocated_cost**: numeric (Nullable: YES)
- **final_unit_cost**: numeric (Nullable: YES)

## Table: inventory_receipts

- **id**: bigint (Nullable: NO)
- **code**: text (Nullable: NO)
- **po_id**: bigint (Nullable: YES)
- **warehouse_id**: bigint (Nullable: NO)
- **creator_id**: uuid (Nullable: YES)
- **receipt_date**: timestamp with time zone (Nullable: YES)
- **note**: text (Nullable: YES)
- **status**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **total_goods_amount**: numeric (Nullable: YES)
- **discount_order**: numeric (Nullable: YES)
- **shipping_fee**: numeric (Nullable: YES)
- **other_fee**: numeric (Nullable: YES)
- **final_amount**: numeric (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: inventory_transactions

- **id**: bigint (Nullable: NO)
- **warehouse_id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **batch_id**: bigint (Nullable: YES)
- **type**: text (Nullable: NO)
- **quantity**: numeric (Nullable: NO)
- **ref_id**: text (Nullable: YES)
- **note**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **created_by**: uuid (Nullable: YES)
- **description**: text (Nullable: YES)
- **action_group**: text (Nullable: YES)
- **unit_price**: numeric (Nullable: YES)
- **partner_id**: bigint (Nullable: YES)
- **total_value**: numeric (Nullable: YES)

## Table: inventory_transfer_batch_items
_Chi tiết Lô hàng được chỉ định để xuất kho (FEFO)_

- **id**: bigint (Nullable: NO)
- **transfer_item_id**: bigint (Nullable: NO)
- **batch_id**: bigint (Nullable: NO)
- **quantity**: integer (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: inventory_transfer_items
_Chi tiết sản phẩm cần chuyển (Chưa định danh Lô)_

- **id**: bigint (Nullable: NO)
- **transfer_id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **unit**: text (Nullable: YES)
- **conversion_factor**: integer (Nullable: YES)
- **qty_requested**: numeric (Nullable: YES)
- **qty_approved**: numeric (Nullable: YES)
- **qty_shipped**: numeric (Nullable: YES)
- **qty_received**: numeric (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: inventory_transfers
_Phiếu chuyển kho (Header)_

- **id**: bigint (Nullable: NO)
- **code**: text (Nullable: NO)
- **source_warehouse_id**: bigint (Nullable: NO)
- **dest_warehouse_id**: bigint (Nullable: NO)
- **status**: text (Nullable: NO)
- **created_by**: uuid (Nullable: YES)
- **note**: text (Nullable: YES)
- **carrier_name**: text (Nullable: YES)
- **carrier_contact**: text (Nullable: YES)
- **carrier_phone**: text (Nullable: YES)
- **expected_arrival_at**: timestamp with time zone (Nullable: YES)
- **is_urgent**: boolean (Nullable: YES)
- **urgency_approved**: boolean (Nullable: YES)
- **packages_sent**: integer (Nullable: YES)
- **packages_received**: integer (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **received_by**: uuid (Nullable: YES)
- **received_at**: timestamp with time zone (Nullable: YES)

## Table: lab_indicators_config

- **id**: bigint (Nullable: NO)
- **service_package_id**: bigint (Nullable: YES)
- **indicator_code**: text (Nullable: NO)
- **indicator_name**: text (Nullable: NO)
- **unit**: text (Nullable: YES)
- **value_type**: text (Nullable: YES)
- **gender_apply**: text (Nullable: YES)
- **age_min_days**: integer (Nullable: YES)
- **age_max_days**: integer (Nullable: YES)
- **min_normal**: numeric (Nullable: YES)
- **max_normal**: numeric (Nullable: YES)
- **qualitative_normal_value**: text (Nullable: YES)
- **absurd_min**: numeric (Nullable: YES)
- **absurd_max**: numeric (Nullable: YES)
- **display_order**: integer (Nullable: YES)
- **status**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: llm_request_log
_Log mỗi attempt gọi LLM provider (success/rate_limit/error/tool_use_failed). RLS chỉ chat_staff đọc._

- **id**: bigint (Nullable: NO)
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
- **created_at**: timestamp with time zone (Nullable: NO)

## Table: manufacturers

- **id**: integer (Nullable: NO)
- **name**: text (Nullable: NO)
- **slug**: text (Nullable: NO)
- **country**: text (Nullable: YES)
- **logo_url**: text (Nullable: YES)
- **status**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO)
- **updated_at**: timestamp with time zone (Nullable: NO)

## Table: medical_visits

- **id**: uuid (Nullable: NO)
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
- **status**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
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
- **red_flags**: jsonb (Nullable: YES)
- **vac_screening**: jsonb (Nullable: YES)

## Table: notifications

- **id**: uuid (Nullable: NO)
- **user_id**: uuid (Nullable: NO)
- **title**: text (Nullable: NO)
- **message**: text (Nullable: YES)
- **type**: text (Nullable: YES)
- **is_read**: boolean (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **reference_id**: uuid (Nullable: YES) - ID của thực thể liên quan (Ví dụ: Task ID) để điều hướng khi click
- **category**: text (Nullable: YES) - Loại thông báo để điều hướng: expense_approval, purchase_order, payment_received, portal_order, portal_registration, task_update
- **metadata**: jsonb (Nullable: YES) - Dữ liệu bổ sung cho navigation: entity id, code, ...

## Table: order_items

- **id**: uuid (Nullable: NO)
- **order_id**: uuid (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **quantity**: integer (Nullable: NO)
- **uom**: text (Nullable: NO)
- **conversion_factor**: integer (Nullable: YES)
- **base_quantity**: integer (Nullable: YES)
- **unit_price**: numeric (Nullable: NO)
- **discount**: numeric (Nullable: YES)
- **is_gift**: boolean (Nullable: YES)
- **note**: text (Nullable: YES)
- **batch_no**: text (Nullable: YES)
- **expiry_date**: date (Nullable: YES)
- **total_line**: numeric (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **quantity_picked**: integer (Nullable: YES)
- **quantity_returned**: integer (Nullable: YES)

## Table: order_status_history
_Audit log cho orders.status transitions. Trigger trg_order_status_history insert mỗi row update status. read-only cho authenticated._

- **id**: bigint (Nullable: NO)
- **order_id**: uuid (Nullable: NO)
- **old_status**: text (Nullable: YES)
- **new_status**: text (Nullable: NO)
- **changed_by**: uuid (Nullable: YES)
- **reason**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO)

## Table: orders

- **id**: uuid (Nullable: NO)
- **code**: text (Nullable: NO)
- **customer_id**: bigint (Nullable: YES)
- **creator_id**: uuid (Nullable: YES)
- **status**: text (Nullable: NO)
- **total_amount**: numeric (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **final_amount**: numeric (Nullable: YES)
- **paid_amount**: numeric (Nullable: YES)
- **shipping_fee**: numeric (Nullable: YES) - Phí ship snapshot lúc đặt đơn. Đơn cũ = 0 (default).
- **discount_amount**: numeric (Nullable: YES)
- **quote_expires_at**: timestamp with time zone (Nullable: YES)
- **delivery_address**: text (Nullable: YES)
- **delivery_time**: text (Nullable: YES)
- **fee_payer**: text (Nullable: YES)
- **shipping_partner_id**: bigint (Nullable: YES)
- **note**: text (Nullable: YES)
- **delivery_method**: text (Nullable: YES)
- **package_count**: integer (Nullable: YES)
- **order_type**: text (Nullable: YES)
- **customer_b2c_id**: bigint (Nullable: YES)
- **payment_status**: text (Nullable: YES)
- **remittance_status**: text (Nullable: YES)
- **remittance_transaction_id**: bigint (Nullable: YES)
- **payment_method**: text (Nullable: YES)
- **warehouse_id**: bigint (Nullable: YES)
- **invoice_status**: USER-DEFINED (Nullable: YES)
- **invoice_request_data**: jsonb (Nullable: YES)
- **shipping_address_id**: bigint (Nullable: YES)
- **transport_vehicle_id**: bigint (Nullable: YES)
- **custom_vehicle_name**: text (Nullable: YES)
- **custom_vehicle_phone**: text (Nullable: YES)
- **custom_vehicle_route**: text (Nullable: YES)
- **source**: text (Nullable: YES) - Origin of order: erp or portal. NULL treated as erp.

## Table: paraclinical_templates

- **id**: bigint (Nullable: NO)
- **service_package_id**: bigint (Nullable: YES)
- **name**: text (Nullable: NO)
- **category**: text (Nullable: NO)
- **description_html**: text (Nullable: YES)
- **conclusion**: text (Nullable: YES)
- **recommendation**: text (Nullable: YES)
- **status**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **created_by**: uuid (Nullable: YES)

## Table: permissions

- **key**: text (Nullable: NO)
- **name**: text (Nullable: NO)
- **module**: text (Nullable: NO)

## Table: portal_cart_items
_Giỏ hàng Portal — mỗi portal_user có giỏ riêng_

- **id**: uuid (Nullable: NO)
- **portal_user_id**: uuid (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **quantity**: integer (Nullable: NO)
- **uom**: text (Nullable: NO)
- **unit_price**: numeric (Nullable: NO)
- **conversion_factor**: integer (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: NO)
- **updated_at**: timestamp with time zone (Nullable: NO)

## Table: portal_users

- **id**: uuid (Nullable: NO)
- **auth_user_id**: uuid (Nullable: NO)
- **customer_b2b_id**: bigint (Nullable: NO)
- **display_name**: text (Nullable: YES)
- **email**: text (Nullable: NO)
- **phone**: text (Nullable: YES)
- **role**: text (Nullable: NO)
- **status**: text (Nullable: NO)
- **last_login_at**: timestamp with time zone (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: prescription_template_items

- **id**: bigint (Nullable: NO)
- **template_id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **quantity**: integer (Nullable: NO)
- **usage_instruction**: text (Nullable: NO)
- **product_unit_id**: bigint (Nullable: YES)

## Table: prescription_templates

- **id**: bigint (Nullable: NO)
- **name**: text (Nullable: NO)
- **diagnosis**: text (Nullable: YES)
- **note**: text (Nullable: YES)
- **status**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO)
- **updated_at**: timestamp with time zone (Nullable: NO)
- **doctor_id**: uuid (Nullable: YES)

## Table: product_activity_logs

- **id**: bigint (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES)
- **user_id**: uuid (Nullable: YES)
- **product_id**: bigint (Nullable: YES)
- **action_type**: text (Nullable: YES)
- **old_value**: text (Nullable: YES)
- **new_value**: text (Nullable: YES)
- **note**: text (Nullable: YES)

## Table: product_contents

- **id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: YES)
- **channel**: text (Nullable: NO) - Kênh phân phối: default, website, shopee, pos...
- **description_html**: text (Nullable: YES)
- **short_description**: text (Nullable: YES)
- **images**: jsonb (Nullable: YES)
- **is_published**: boolean (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **seo_title**: text (Nullable: YES)
- **seo_description**: text (Nullable: YES)
- **seo_keywords**: ARRAY (Nullable: YES)
- **language_code**: text (Nullable: YES)
- **updated_by**: uuid (Nullable: YES)

## Table: product_deals

- **id**: integer (Nullable: NO)
- **name**: text (Nullable: NO)
- **slug**: text (Nullable: NO)
- **description**: text (Nullable: YES)
- **discount_type**: text (Nullable: NO)
- **discount_value**: numeric (Nullable: NO)
- **start_date**: timestamp with time zone (Nullable: NO)
- **end_date**: timestamp with time zone (Nullable: YES)
- **status**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO)
- **updated_at**: timestamp with time zone (Nullable: NO)

## Table: product_inventory

- **id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **warehouse_id**: bigint (Nullable: NO)
- **stock_quantity**: numeric (Nullable: NO)
- **min_stock**: integer (Nullable: YES)
- **max_stock**: integer (Nullable: YES)
- **shelf_location**: text (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES) - Thời gian cập nhật tồn kho hoặc cấu hình Min/Max
- **location_cabinet**: text (Nullable: YES)
- **location_row**: text (Nullable: YES)
- **location_slot**: text (Nullable: YES)
- **updated_by**: uuid (Nullable: YES)

## Table: product_monthly_sales_view

- **product_id**: bigint (Nullable: YES)
- **monthly_sales_qty**: bigint (Nullable: YES)

## Table: product_synonyms
_Từ đồng nghĩa cho search SP qua chatbot — xa20, xarelto20, rivaroxaban... Master data, không user-specific._

- **id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **synonym**: text (Nullable: NO)
- **weight**: real (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: NO)

## Table: product_units

- **id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: YES)
- **unit_name**: text (Nullable: NO)
- **conversion_rate**: integer (Nullable: YES)
- **barcode**: text (Nullable: YES)
- **is_base**: boolean (Nullable: YES)
- **is_direct_sale**: boolean (Nullable: YES)
- **price_cost**: numeric (Nullable: YES)
- **price_sell**: numeric (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **unit_type**: text (Nullable: YES)
- **price**: numeric (Nullable: YES) - Giá bán ra áp dụng cho đơn vị này

## Table: products

- **id**: bigint (Nullable: NO)
- **name**: text (Nullable: NO)
- **sku**: text (Nullable: YES)
- **barcode**: text (Nullable: YES)
- **description**: text (Nullable: YES)
- **active_ingredient**: text (Nullable: YES)
- **image_url**: text (Nullable: YES)
- **status**: text (Nullable: NO)
- **fts**: tsvector (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **category_name**: text (Nullable: YES)
- **manufacturer_name**: text (Nullable: YES)
- **distributor_id**: bigint (Nullable: YES)
- **invoice_price**: numeric (Nullable: YES)
- **actual_cost**: numeric (Nullable: NO)
- **wholesale_unit**: text (Nullable: YES)
- **retail_unit**: text (Nullable: YES)
- **conversion_factor**: integer (Nullable: YES)
- **wholesale_margin_value**: numeric (Nullable: YES)
- **wholesale_margin_type**: text (Nullable: YES)
- **retail_margin_value**: numeric (Nullable: YES)
- **retail_margin_type**: text (Nullable: YES)
- **items_per_carton**: integer (Nullable: YES)
- **carton_weight**: numeric (Nullable: YES)
- **carton_dimensions**: text (Nullable: YES)
- **purchasing_policy**: text (Nullable: YES)
- **registration_number**: text (Nullable: YES)
- **packing_spec**: text (Nullable: YES)
- **stock_management_type**: USER-DEFINED (Nullable: YES)
- **wholesale_margin_rate**: numeric (Nullable: YES)
- **retail_margin_rate**: numeric (Nullable: YES)
- **usage_instructions**: jsonb (Nullable: YES) - HDSD phân theo nhóm tuổi: 0_2, 2_6, 6_18, 18_plus
- **updated_by**: uuid (Nullable: YES)
- **category_id**: integer (Nullable: YES)
- **manufacturer_id**: integer (Nullable: YES)
- **stock_status**: text (Nullable: YES)
- **product_images**: ARRAY (Nullable: YES)

## Table: promotion_gifts

- **id**: bigint (Nullable: NO)
- **name**: text (Nullable: NO)
- **type**: USER-DEFINED (Nullable: NO)
- **quantity**: integer (Nullable: YES)
- **estimated_value**: numeric (Nullable: YES)
- **received_from_po_id**: bigint (Nullable: YES)
- **status**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **code**: text (Nullable: YES)
- **stock_quantity**: integer (Nullable: YES)
- **image_url**: text (Nullable: YES)
- **unit_name**: text (Nullable: YES)
- **description**: text (Nullable: YES)
- **min_stock**: integer (Nullable: YES)
- **supplier_id**: bigint (Nullable: YES)

## Table: promotion_targets

- **id**: bigint (Nullable: NO)
- **promotion_id**: uuid (Nullable: NO)
- **target_type**: text (Nullable: NO)
- **target_id**: bigint (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: promotion_usages

- **id**: uuid (Nullable: NO)
- **promotion_id**: uuid (Nullable: NO)
- **customer_id**: bigint (Nullable: NO)
- **order_id**: uuid (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **discount_amount**: numeric (Nullable: NO)

## Table: promotions

- **id**: uuid (Nullable: NO)
- **code**: text (Nullable: NO)
- **name**: text (Nullable: NO)
- **description**: text (Nullable: YES)
- **type**: text (Nullable: NO)
- **discount_type**: text (Nullable: NO)
- **discount_value**: numeric (Nullable: NO)
- **max_discount_value**: numeric (Nullable: YES)
- **min_order_value**: numeric (Nullable: YES)
- **apply_to_scope**: text (Nullable: YES)
- **apply_to_ids**: jsonb (Nullable: YES)
- **total_usage_limit**: integer (Nullable: YES)
- **usage_count**: integer (Nullable: YES)
- **usage_limit_per_user**: integer (Nullable: YES)
- **customer_id**: bigint (Nullable: YES)
- **valid_from**: timestamp with time zone (Nullable: NO)
- **valid_to**: timestamp with time zone (Nullable: NO)
- **status**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **customer_type**: text (Nullable: YES)

## Table: purchase_order_items

- **id**: bigint (Nullable: NO)
- **po_id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **quantity_ordered**: integer (Nullable: NO)
- **quantity_received**: integer (Nullable: YES)
- **unit_price**: numeric (Nullable: NO)
- **unit**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **uom_ordered**: text (Nullable: YES)
- **conversion_factor**: integer (Nullable: YES)
- **base_quantity**: integer (Nullable: YES)
- **is_bonus**: boolean (Nullable: YES)
- **vat_rate**: numeric (Nullable: YES)
- **rebate_rate**: numeric (Nullable: YES)
- **bonus_quantity**: integer (Nullable: YES)
- **allocated_shipping_fee**: numeric (Nullable: YES)
- **final_unit_cost**: numeric (Nullable: YES)

## Table: purchase_orders

- **id**: bigint (Nullable: NO)
- **code**: text (Nullable: NO)
- **supplier_id**: bigint (Nullable: NO)
- **creator_id**: uuid (Nullable: YES)
- **delivery_status**: text (Nullable: YES)
- **payment_status**: text (Nullable: YES)
- **total_amount**: numeric (Nullable: NO)
- **discount_amount**: numeric (Nullable: YES)
- **final_amount**: numeric (Nullable: NO)
- **total_paid**: numeric (Nullable: YES)
- **expected_delivery_date**: timestamp with time zone (Nullable: YES)
- **note**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO)
- **updated_at**: timestamp with time zone (Nullable: NO)
- **delivery_method**: text (Nullable: YES)
- **status**: text (Nullable: YES)
- **shipping_partner_id**: bigint (Nullable: YES)
- **shipping_fee**: numeric (Nullable: YES)
- **total_packages**: integer (Nullable: YES)
- **carrier_name**: text (Nullable: YES)
- **carrier_contact**: text (Nullable: YES)
- **carrier_phone**: text (Nullable: YES)
- **expected_delivery_time**: timestamp with time zone (Nullable: YES)
- **receipt_draft**: jsonb (Nullable: YES)
- **costing_confirmed_at**: timestamp with time zone (Nullable: YES) - Thời điểm chốt giá vốn. NULL = chưa chốt. Khi đã set thì không cho chốt lại.

## Table: registration_requests
_Yêu cầu đăng ký tài khoản portal B2B - admin duyệt trước khi tạo account_

- **id**: uuid (Nullable: NO)
- **business_name**: text (Nullable: NO)
- **tax_code**: text (Nullable: YES)
- **phone**: text (Nullable: NO)
- **email**: text (Nullable: NO)
- **address**: text (Nullable: YES)
- **contact_name**: text (Nullable: NO)
- **contact_phone**: text (Nullable: YES)
- **contact_email**: text (Nullable: YES)
- **note**: text (Nullable: YES)
- **status**: text (Nullable: NO)
- **rejection_reason**: text (Nullable: YES)
- **approved_customer_b2b_id**: integer (Nullable: YES)
- **approved_portal_user_id**: uuid (Nullable: YES)
- **approved_by**: uuid (Nullable: YES)
- **approved_at**: timestamp with time zone (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO)
- **updated_at**: timestamp with time zone (Nullable: NO)
- **auth_user_id**: uuid (Nullable: YES)

## Table: role_permissions

- **role_id**: uuid (Nullable: NO)
- **permission_key**: text (Nullable: NO)

## Table: roles

- **id**: uuid (Nullable: NO)
- **name**: text (Nullable: NO)
- **description**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: rpc_access_rules

- **function_name**: text (Nullable: NO)
- **required_permission**: text (Nullable: YES)
- **max_calls_per_minute**: integer (Nullable: YES)
- **is_write**: boolean (Nullable: YES)
- **description**: text (Nullable: YES)

## Table: rpc_rate_log

- **id**: bigint (Nullable: NO)
- **user_id**: uuid (Nullable: NO)
- **function_name**: text (Nullable: NO)
- **called_at**: timestamp with time zone (Nullable: NO)

## Table: sales_invoices

- **id**: bigint (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **invoice_date**: date (Nullable: NO)
- **invoice_number**: text (Nullable: YES)
- **invoice_serial**: text (Nullable: YES)
- **invoice_template_code**: text (Nullable: YES)
- **buyer_name**: text (Nullable: YES)
- **buyer_company_name**: text (Nullable: YES)
- **buyer_tax_code**: text (Nullable: YES)
- **buyer_address**: text (Nullable: YES)
- **buyer_email**: text (Nullable: YES)
- **payment_method**: text (Nullable: YES)
- **total_amount_pre_tax**: numeric (Nullable: YES)
- **vat_rate**: numeric (Nullable: YES)
- **vat_amount**: numeric (Nullable: YES)
- **final_amount**: numeric (Nullable: YES)
- **order_id**: uuid (Nullable: YES)
- **customer_id**: bigint (Nullable: YES)
- **customer_b2c_id**: bigint (Nullable: YES)
- **note**: text (Nullable: YES)
- **status**: text (Nullable: NO) - pending: Mới tạo/Chờ xử lý      processing: Đang xử lý (Kế toán đã tải file)      issued: Đã phát hành (Trigger kích hoạt -> TRỪ KHO VAT)      verified: Đã đối soát xong
- **tracking_code**: text (Nullable: YES)

## Table: sales_return_items

- **id**: bigint (Nullable: NO)
- **return_id**: uuid (Nullable: YES)
- **order_item_id**: uuid (Nullable: YES)
- **product_id**: bigint (Nullable: YES)
- **warehouse_id**: bigint (Nullable: YES)
- **quantity**: integer (Nullable: NO)
- **refund_price**: numeric (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: sales_returns

- **id**: uuid (Nullable: NO)
- **code**: text (Nullable: NO)
- **order_id**: uuid (Nullable: YES)
- **customer_id**: bigint (Nullable: YES)
- **customer_b2c_id**: bigint (Nullable: YES)
- **status**: text (Nullable: YES)
- **total_refund_amount**: numeric (Nullable: YES)
- **note**: text (Nullable: YES)
- **created_by**: uuid (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: service_consumables

- **id**: bigint (Nullable: NO)
- **service_product_id**: bigint (Nullable: YES)
- **consumable_product_id**: bigint (Nullable: YES)
- **quantity**: integer (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: service_package_items

- **id**: bigint (Nullable: NO)
- **package_id**: bigint (Nullable: NO)
- **item_id**: bigint (Nullable: NO)
- **quantity**: numeric (Nullable: NO)
- **item_type**: text (Nullable: NO)
- **schedule_days**: integer (Nullable: YES)

## Table: service_packages

- **id**: bigint (Nullable: NO)
- **name**: text (Nullable: NO)
- **sku**: text (Nullable: NO)
- **unit**: text (Nullable: NO)
- **type**: USER-DEFINED (Nullable: NO)
- **price**: numeric (Nullable: NO)
- **total_cost_price**: numeric (Nullable: NO)
- **revenue_account_id**: text (Nullable: YES)
- **valid_from**: date (Nullable: NO)
- **valid_to**: date (Nullable: NO)
- **status**: USER-DEFINED (Nullable: NO)
- **validity_days**: integer (Nullable: YES)
- **applicable_branches**: ARRAY (Nullable: YES)
- **applicable_channels**: text (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **clinical_category**: text (Nullable: YES)

## Table: shipping_addresses

- **id**: bigint (Nullable: NO)
- **customer_b2b_id**: bigint (Nullable: NO)
- **label**: text (Nullable: YES)
- **province_code**: text (Nullable: NO)
- **district_code**: text (Nullable: NO)
- **ward_code**: text (Nullable: NO)
- **street**: text (Nullable: YES)
- **full_address**: text (Nullable: NO)
- **is_default**: boolean (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: shipping_fee_config
_Phí ship flat rate per method. Phase 1 — không zone, không weight. Admin update qua SQL/Studio._

- **id**: bigint (Nullable: NO)
- **delivery_method**: text (Nullable: NO)
- **flat_fee**: numeric (Nullable: NO)
- **estimated_days_min**: integer (Nullable: NO)
- **estimated_days_max**: integer (Nullable: NO)
- **estimated_text**: text (Nullable: YES)
- **is_active**: boolean (Nullable: NO)
- **updated_at**: timestamp with time zone (Nullable: NO)

## Table: shipping_partners

- **id**: bigint (Nullable: NO)
- **name**: text (Nullable: NO)
- **type**: USER-DEFINED (Nullable: NO)
- **contact_person**: text (Nullable: YES)
- **phone**: text (Nullable: YES)
- **email**: text (Nullable: YES)
- **address**: text (Nullable: YES)
- **notes**: text (Nullable: YES)
- **status**: USER-DEFINED (Nullable: NO)
- **cut_off_time**: time without time zone (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: shipping_rules

- **id**: bigint (Nullable: NO)
- **partner_id**: bigint (Nullable: NO)
- **zone_name**: text (Nullable: NO)
- **speed_hours**: integer (Nullable: YES)
- **fee**: numeric (Nullable: YES)

## Table: supplier_debt_view

- **supplier_id**: bigint (Nullable: YES)
- **total_invoiced**: numeric (Nullable: YES)
- **total_paid**: numeric (Nullable: YES)
- **current_debt**: numeric (Nullable: YES)

## Table: supplier_program_groups

- **id**: bigint (Nullable: NO)
- **program_id**: bigint (Nullable: YES)
- **name**: text (Nullable: NO)
- **rule_type**: text (Nullable: YES)
- **rules**: jsonb (Nullable: YES)
- **price_basis**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: supplier_program_products

- **group_id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: supplier_programs

- **id**: bigint (Nullable: NO)
- **supplier_id**: bigint (Nullable: NO)
- **code**: text (Nullable: YES)
- **name**: text (Nullable: NO)
- **type**: USER-DEFINED (Nullable: NO)
- **rebate_percentage**: numeric (Nullable: YES)
- **valid_from**: date (Nullable: NO)
- **valid_to**: date (Nullable: NO)
- **status**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **document_code**: text (Nullable: YES)
- **attachment_url**: text (Nullable: YES)
- **description**: text (Nullable: YES)

## Table: supplier_wallet_transactions

- **id**: bigint (Nullable: NO)
- **supplier_id**: bigint (Nullable: YES)
- **amount**: numeric (Nullable: NO)
- **type**: text (Nullable: YES)
- **reference_id**: text (Nullable: YES)
- **description**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: supplier_wallets

- **supplier_id**: bigint (Nullable: NO)
- **balance**: numeric (Nullable: YES)
- **total_earned**: numeric (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: suppliers

- **id**: bigint (Nullable: NO)
- **name**: text (Nullable: NO)
- **contact_person**: text (Nullable: YES)
- **phone**: text (Nullable: YES)
- **email**: text (Nullable: YES)
- **address**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **tax_code**: text (Nullable: YES)
- **payment_term**: text (Nullable: YES)
- **bank_account**: text (Nullable: YES)
- **bank_name**: text (Nullable: YES)
- **bank_holder**: text (Nullable: YES)
- **delivery_method**: text (Nullable: YES)
- **lead_time**: integer (Nullable: YES)
- **status**: text (Nullable: NO)
- **notes**: text (Nullable: YES)
- **bank_bin**: text (Nullable: YES)

## Table: system_logs

- **id**: bigint (Nullable: NO)
- **user_id**: uuid (Nullable: YES)
- **module**: text (Nullable: NO)
- **action**: text (Nullable: NO)
- **record_id**: text (Nullable: YES)
- **old_data**: jsonb (Nullable: YES)
- **new_data**: jsonb (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **user_name**: text (Nullable: YES)

## Table: system_settings

- **key**: text (Nullable: NO)
- **value**: jsonb (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **description**: text (Nullable: YES)

## Table: tasks
_Trung tâm quản lý tác vụ và giao việc tự động (Task Hub)_

- **id**: uuid (Nullable: NO)
- **title**: text (Nullable: NO)
- **description**: text (Nullable: YES)
- **status**: text (Nullable: YES)
- **priority**: text (Nullable: YES)
- **assigner_id**: uuid (Nullable: YES)
- **assignee_id**: uuid (Nullable: NO)
- **entity_type**: text (Nullable: YES) - Loại thực thể liên quan: order, customer, product, inventory_batch...
- **entity_id**: text (Nullable: YES)
- **due_date**: timestamp with time zone (Nullable: NO)
- **completed_at**: timestamp with time zone (Nullable: YES)
- **kpi_points**: integer (Nullable: YES) - Điểm thưởng Gamification: +10 (Sớm), +5 (Trễ hạn)
- **ai_metadata**: jsonb (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: transaction_categories

- **id**: bigint (Nullable: NO)
- **code**: text (Nullable: NO)
- **name**: text (Nullable: NO)
- **type**: USER-DEFINED (Nullable: NO)
- **account_id**: text (Nullable: YES)
- **status**: USER-DEFINED (Nullable: NO)
- **description**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: transport_vehicles

- **id**: bigint (Nullable: NO)
- **name**: text (Nullable: NO)
- **phone**: text (Nullable: YES)
- **route**: text (Nullable: YES)
- **status**: USER-DEFINED (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: user_roles

- **id**: bigint (Nullable: NO)
- **user_id**: uuid (Nullable: NO)
- **role_id**: uuid (Nullable: NO)
- **branch_id**: bigint (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES)

## Table: users

- **id**: uuid (Nullable: NO)
- **email**: text (Nullable: YES)
- **full_name**: text (Nullable: YES)
- **avatar_url**: text (Nullable: YES)
- **employee_code**: text (Nullable: YES)
- **position**: text (Nullable: YES)
- **status**: USER-DEFINED (Nullable: NO)
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
- **created_at**: timestamp with time zone (Nullable: YES)
- **updated_at**: timestamp with time zone (Nullable: YES)
- **profile_updated_at**: timestamp with time zone (Nullable: YES)
- **work_state**: text (Nullable: YES)
- **role_id**: uuid (Nullable: YES)
- **company_id**: uuid (Nullable: YES)
- **warehouse_id**: bigint (Nullable: YES)

## Table: v_active_deals

- **product_id**: integer (Nullable: YES)
- **deal_id**: integer (Nullable: YES)
- **deal_name**: text (Nullable: YES)
- **deal_slug**: text (Nullable: YES)
- **discount_type**: text (Nullable: YES)
- **discount_value**: numeric (Nullable: YES)
- **start_date**: timestamp with time zone (Nullable: YES)
- **end_date**: timestamp with time zone (Nullable: YES)

## Table: vaccination_template_items

- **id**: bigint (Nullable: NO)
- **template_id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **shot_name**: text (Nullable: NO)
- **days_after_start**: integer (Nullable: YES)
- **note**: text (Nullable: YES)

## Table: vaccination_templates

- **id**: bigint (Nullable: NO)
- **name**: text (Nullable: NO)
- **description**: text (Nullable: YES)
- **min_age_months**: integer (Nullable: YES)
- **max_age_months**: integer (Nullable: YES)
- **status**: text (Nullable: YES)
- **created_at**: timestamp with time zone (Nullable: NO)
- **updated_at**: timestamp with time zone (Nullable: NO)

## Table: vat_inventory_ledger
_Sổ cái theo dõi tồn kho Hóa đơn VAT (Lưu trữ theo Base Unit và Tax Rate)_

- **id**: bigint (Nullable: NO)
- **product_id**: bigint (Nullable: NO)
- **vat_rate**: numeric (Nullable: NO)
- **quantity_balance**: numeric (Nullable: NO)
- **total_value_balance**: numeric (Nullable: NO)
- **updated_at**: timestamp with time zone (Nullable: YES)

## Table: vendor_product_mappings

- **id**: bigint (Nullable: NO)
- **vendor_tax_code**: text (Nullable: NO)
- **vendor_product_name**: text (Nullable: NO)
- **internal_product_id**: bigint (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES)
- **last_used_at**: timestamp with time zone (Nullable: YES)
- **updated_by**: uuid (Nullable: YES)
- **vendor_unit**: text (Nullable: YES)
- **internal_unit**: text (Nullable: YES)

## Table: vw_task_board

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

## Table: warehouses

- **id**: bigint (Nullable: NO)
- **key**: text (Nullable: NO)
- **name**: text (Nullable: NO)
- **unit**: text (Nullable: NO)
- **created_at**: timestamp with time zone (Nullable: YES)
- **address**: text (Nullable: YES)
- **type**: text (Nullable: NO)
- **latitude**: numeric (Nullable: YES)
- **longitude**: numeric (Nullable: YES)
- **code**: text (Nullable: YES)
- **manager**: text (Nullable: YES)
- **phone**: text (Nullable: YES)
- **status**: text (Nullable: NO)
- **company_id**: uuid (Nullable: YES)

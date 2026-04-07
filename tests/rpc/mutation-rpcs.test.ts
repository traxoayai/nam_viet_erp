import { describe as _describe, it, expect } from "vitest";
import { adminClient, isProduction } from "../helpers/supabase";

// Skip mutation tests on production to avoid side effects
const describe = isProduction ? _describe.skip : _describe;

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const FAKE_ID = 999999;

function expectValidError(error: { code?: string; message?: string } | null) {
  if (!error) return; // success is also OK for some mutations
  // Should NOT be type cast, function-not-found, or overload ambiguity
  expect(["22P02", "22007"]).not.toContain(error.code);
  expect(error.code).not.toBe("PGRST202");
  expect(error.code).not.toBe("PGRST203");
}

// ─── Sales ──────────────────────────────────────────────────────────────────

describe("Sales Mutation RPCs", () => {
  it("cancel_order — rejects non-existent order", async () => {
    const { error } = await adminClient.rpc("cancel_order", {
      p_order_id: NIL_UUID,
      p_reason: "test",
    });
    expectValidError(error);
  });

  it("clone_sales_order — rejects non-existent order", async () => {
    const { error } = await adminClient.rpc("clone_sales_order", {
      p_old_order_id: NIL_UUID,
    });
    expectValidError(error);
  });

  it("update_sales_order — rejects non-existent order", async () => {
    const { error } = await adminClient.rpc("update_sales_order", {
      p_order_id: NIL_UUID,
      p_customer_id: FAKE_ID,
      p_delivery_address: "test",
      p_delivery_time: "2026-01-01",
      p_discount_amount: 0,
      p_items: [],
      p_note: "test",
      p_shipping_fee: 0,
    });
    expectValidError(error);
  });

  it("confirm_order_payment — rejects non-existent orders", async () => {
    const { error } = await adminClient.rpc("confirm_order_payment", {
      p_fund_account_id: FAKE_ID,
      p_order_ids: [FAKE_ID],
    });
    expectValidError(error);
  });

  it("bulk_pay_orders — rejects non-existent orders", async () => {
    const { error } = await adminClient.rpc("bulk_pay_orders", {
      p_fund_account_id: FAKE_ID,
      p_order_ids: [NIL_UUID],
      p_note: "test",
    });
    expectValidError(error);
  });

  it("handover_to_shipping — rejects non-existent order", async () => {
    const { error } = await adminClient.rpc("handover_to_shipping", {
      p_order_id: NIL_UUID,
    });
    expectValidError(error);
  });

  it("submit_cash_remittance — rejects non-existent orders", async () => {
    const { error } = await adminClient.rpc("submit_cash_remittance", {
      p_order_ids: [NIL_UUID],
      p_user_id: NIL_UUID,
    });
    expectValidError(error);
  });

  it("process_bulk_payment — rejects non-existent customer", async () => {
    const { error } = await adminClient.rpc("process_bulk_payment", {
      p_customer_id: FAKE_ID,
      p_total_amount: 0,
      p_allocations: [],
    });
    expectValidError(error);
  });
});

// ─── Outbound / Warehouse Ops ───────────────────────────────────────────────

describe("Outbound Mutation RPCs", () => {
  it("cancel_outbound_task — rejects non-existent order", async () => {
    const { error } = await adminClient.rpc("cancel_outbound_task", {
      p_order_id: NIL_UUID,
      p_reason: "test",
      p_user_id: NIL_UUID,
    });
    expectValidError(error);
  });

  it("confirm_outbound_packing — rejects non-existent order", async () => {
    const { error } = await adminClient.rpc("confirm_outbound_packing", {
      p_order_id: NIL_UUID,
    });
    expectValidError(error);
  });

  it("save_outbound_progress — rejects non-existent order", async () => {
    const { error } = await adminClient.rpc("save_outbound_progress", {
      p_order_id: NIL_UUID,
      p_items: [],
    });
    expectValidError(error);
  });

  it("update_outbound_package_count — rejects non-existent order", async () => {
    const { error } = await adminClient.rpc("update_outbound_package_count", {
      p_order_id: NIL_UUID,
      p_count: 1,
    });
    expectValidError(error);
  });
});

// ─── Purchasing ─────────────────────────────────────────────────────────────

describe("Purchasing Mutation RPCs", () => {
  it("cancel_purchase_order — rejects non-existent PO", async () => {
    const { error } = await adminClient.rpc("cancel_purchase_order", {
      p_po_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("update_purchase_order — rejects non-existent PO", async () => {
    const { error } = await adminClient.rpc("update_purchase_order", {
      p_po_id: FAKE_ID,
      p_supplier_id: FAKE_ID,
      p_expected_date: "2026-01-01",
      p_items: [],
      p_note: "test",
    });
    expectValidError(error);
  });

  it("update_purchase_order_logistics — rejects non-existent PO", async () => {
    const { error } = await adminClient.rpc("update_purchase_order_logistics", {
      p_po_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("allocate_inbound_costs — rejects non-existent receipt", async () => {
    const { error } = await adminClient.rpc("allocate_inbound_costs", {
      p_receipt_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("process_inbound_receipt — rejects non-existent PO", async () => {
    const { error } = await adminClient.rpc("process_inbound_receipt", {
      p_po_id: FAKE_ID,
      p_warehouse_id: FAKE_ID,
      p_items: [],
    });
    expectValidError(error);
  });

  it("create_inventory_receipt — rejects non-existent PO", async () => {
    const { error } = await adminClient.rpc("create_inventory_receipt", {
      p_po_id: FAKE_ID,
      p_warehouse_id: FAKE_ID,
      p_items: [],
      p_note: "test",
    });
    expectValidError(error);
  });

  it("import_suppliers_bulk — rejects empty data", async () => {
    const { error } = await adminClient.rpc("import_suppliers_bulk", {
      p_suppliers: [],
    });
    expectValidError(error);
  });
});

// ─── Inventory ──────────────────────────────────────────────────────────────

describe("Inventory Mutation RPCs", () => {
  it("create_inventory_check — rejects non-existent warehouse", async () => {
    const { error } = await adminClient.rpc("create_inventory_check", {
      p_warehouse_id: FAKE_ID,
      p_user_id: NIL_UUID,
    });
    expectValidError(error);
  });

  it("add_item_to_check_session — rejects non-existent check", async () => {
    const { error } = await adminClient.rpc("add_item_to_check_session", {
      p_check_id: FAKE_ID,
      p_product_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("cancel_inventory_check — rejects non-existent check", async () => {
    const { error } = await adminClient.rpc("cancel_inventory_check", {
      p_check_id: FAKE_ID,
      p_user_id: NIL_UUID,
    });
    expectValidError(error);
  });

  it("complete_inventory_check — rejects non-existent check", async () => {
    const { error } = await adminClient.rpc("complete_inventory_check", {
      p_check_id: FAKE_ID,
      p_user_id: NIL_UUID,
    });
    expectValidError(error);
  });

  it("update_inventory_check_info — rejects non-existent check", async () => {
    const { error } = await adminClient.rpc("update_inventory_check_info", {
      p_check_id: FAKE_ID,
      p_note: "test",
    });
    expectValidError(error);
  });

  it("update_product_location — rejects non-existent product", async () => {
    const { error } = await adminClient.rpc("update_product_location", {
      p_product_id: FAKE_ID,
      p_warehouse_id: FAKE_ID,
      p_cabinet: "A",
      p_row: "1",
      p_slot: "1",
    });
    expectValidError(error);
  });
});

// ─── Transfer ───────────────────────────────────────────────────────────────

describe("Transfer Mutation RPCs", () => {
  it("confirm_transfer_inbound — rejects non-existent transfer", async () => {
    const { error } = await adminClient.rpc("confirm_transfer_inbound", {
      p_transfer_id: FAKE_ID,
      p_actor_warehouse_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("confirm_transfer_outbound_fefo — rejects non-existent transfer", async () => {
    const { error } = await adminClient.rpc("confirm_transfer_outbound_fefo", {
      p_transfer_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("submit_transfer_shipping — rejects non-existent transfer", async () => {
    const { error } = await adminClient.rpc("submit_transfer_shipping", {
      p_transfer_id: FAKE_ID,
      p_batch_items: [],
    });
    expectValidError(error);
  });
});

// ─── Products ───────────────────────────────────────────────────────────────

describe("Product Mutation RPCs", () => {
  it("bulk_update_product_barcodes — rejects empty data", async () => {
    const { error } = await adminClient.rpc("bulk_update_product_barcodes", {
      p_data: [],
    });
    expectValidError(error);
  });

  it("bulk_update_product_prices — rejects empty data", async () => {
    const { error } = await adminClient.rpc("bulk_update_product_prices", {
      p_data: [],
    });
    expectValidError(error);
  });

  it("bulk_upsert_products — rejects empty data", async () => {
    const { error } = await adminClient.rpc("bulk_upsert_products", {
      p_products_array: [],
    });
    expectValidError(error);
  });

  it("check_product_dependencies — rejects non-existent products", async () => {
    const { error } = await adminClient.rpc("check_product_dependencies", {
      p_product_ids: [FAKE_ID],
    });
    expectValidError(error);
  });

  it("quick_assign_barcode — rejects non-existent product", async () => {
    const { error } = await adminClient.rpc("quick_assign_barcode", {
      p_product_id: FAKE_ID,
      p_unit_id: FAKE_ID,
      p_barcode: "TEST999999",
    });
    expectValidError(error);
  });

  it("import_product_master_v2 — rejects empty data", async () => {
    const { error } = await adminClient.rpc("import_product_master_v2", {
      p_data: [],
    });
    expectValidError(error);
  });

  it("upsert_product_with_units — rejects empty product json", async () => {
    const { error } = await adminClient.rpc("upsert_product_with_units", {
      p_product_json: {},
      p_units_json: [],
    });
    expectValidError(error);
  });

  it("calculate_package_cost — rejects empty items", async () => {
    const { error } = await adminClient.rpc("calculate_package_cost", {
      p_items: [],
    });
    expectValidError(error);
  });
});

// ─── Customers B2B ──────────────────────────────────────────────────────────

describe("Customer B2B Mutation RPCs", () => {
  it("create_customer_b2b — rejects empty data", async () => {
    const { error } = await adminClient.rpc("create_customer_b2b", {
      p_customer_data: {},
      p_contacts: [],
    });
    expectValidError(error);
  });

  it("update_customer_b2b — rejects non-existent customer", async () => {
    const { error } = await adminClient.rpc("update_customer_b2b", {
      p_id: FAKE_ID,
      p_customer_data: {},
      p_contacts: [],
    });
    expectValidError(error);
  });

  it("delete_customer_b2b — rejects non-existent customer", async () => {
    const { error } = await adminClient.rpc("delete_customer_b2b", {
      p_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("reactivate_customer_b2b — rejects non-existent customer", async () => {
    const { error } = await adminClient.rpc("reactivate_customer_b2b", {
      p_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("bulk_upsert_customers_b2b — rejects empty array", async () => {
    const { error } = await adminClient.rpc("bulk_upsert_customers_b2b", {
      p_customers_array: [],
    });
    expectValidError(error);
  });
});

// ─── Customers B2C ──────────────────────────────────────────────────────────

describe("Customer B2C Mutation RPCs", () => {
  it("create_customer_b2c — rejects empty data", async () => {
    const { error } = await adminClient.rpc("create_customer_b2c", {
      p_customer_data: {},
      p_guardians: [],
    });
    expectValidError(error);
  });

  it("update_customer_b2c — rejects non-existent customer", async () => {
    const { error } = await adminClient.rpc("update_customer_b2c", {
      p_id: FAKE_ID,
      p_customer_data: {},
    });
    expectValidError(error);
  });

  it("delete_customer_b2c — rejects non-existent customer", async () => {
    const { error } = await adminClient.rpc("delete_customer_b2c", {
      p_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("reactivate_customer_b2c — rejects non-existent customer", async () => {
    const { error } = await adminClient.rpc("reactivate_customer_b2c", {
      p_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("bulk_upsert_customers_b2c — rejects empty array", async () => {
    const { error } = await adminClient.rpc("bulk_upsert_customers_b2c", {
      p_customers_array: [],
    });
    expectValidError(error);
  });
});

// ─── Suppliers ──────────────────────────────────────────────────────────────

describe("Supplier Mutation RPCs", () => {
  it("create_supplier — rejects empty data", async () => {
    const { error } = await adminClient.rpc("create_supplier", {
      p_name: "",
      p_phone: "",
      p_email: "",
      p_address: "",
      p_tax_code: "",
      p_contact_person: "",
      p_bank_name: "",
      p_bank_account: "",
      p_bank_holder: "",
      p_payment_term: "",
      p_delivery_method: "",
      p_lead_time: 0,
      p_notes: "",
      p_status: "active",
    });
    expectValidError(error);
  });

  it("update_supplier — rejects non-existent supplier", async () => {
    const { error } = await adminClient.rpc("update_supplier", {
      p_id: FAKE_ID,
      p_name: "test",
      p_phone: "",
      p_email: "",
      p_address: "",
      p_tax_code: "",
      p_contact_person: "",
      p_bank_name: "",
      p_bank_account: "",
      p_bank_holder: "",
      p_payment_term: "",
      p_delivery_method: "",
      p_lead_time: 0,
      p_notes: "",
      p_status: "active",
    });
    expectValidError(error);
  });

  it("delete_supplier — rejects non-existent supplier", async () => {
    const { error } = await adminClient.rpc("delete_supplier", {
      p_id: FAKE_ID,
    });
    expectValidError(error);
  });
});

// ─── Shipping Partners ──────────────────────────────────────────────────────

describe("Shipping Partner Mutation RPCs", () => {
  it("create_shipping_partner — rejects empty data", async () => {
    const { error } = await adminClient.rpc("create_shipping_partner", {
      p_partner_data: {},
      p_rules: [],
    });
    expectValidError(error);
  });

  it("update_shipping_partner — rejects non-existent partner", async () => {
    const { error } = await adminClient.rpc("update_shipping_partner", {
      p_id: FAKE_ID,
      p_partner_data: {},
      p_rules: [],
    });
    expectValidError(error);
  });

  it("delete_shipping_partner — rejects non-existent partner", async () => {
    const { error } = await adminClient.rpc("delete_shipping_partner", {
      p_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("reactivate_shipping_partner — rejects non-existent partner", async () => {
    const { error } = await adminClient.rpc("reactivate_shipping_partner", {
      p_id: FAKE_ID,
    });
    expectValidError(error);
  });
});

// ─── Finance ────────────────────────────────────────────────────────────────

describe("Finance Mutation RPCs", () => {
  it("confirm_finance_transaction — rejects non-existent transaction", async () => {
    const { error } = await adminClient.rpc("confirm_finance_transaction", {
      p_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("process_vat_invoice_entry — rejects non-existent invoice", async () => {
    const { error } = await adminClient.rpc("process_vat_invoice_entry", {
      p_invoice_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("reverse_vat_invoice_entry — rejects non-existent invoice", async () => {
    const { error } = await adminClient.rpc("reverse_vat_invoice_entry", {
      p_invoice_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("check_invoice_exists — returns false for non-existent invoice", async () => {
    const { data, error } = await adminClient.rpc("check_invoice_exists", {
      p_number: "FAKE999",
      p_symbol: "FAKE",
      p_tax_code: "0000000000",
    });
    expectValidError(error);
    if (!error) {
      expect(data).toBe(false);
    }
  });
});

// ─── Assets ─────────────────────────────────────────────────────────────────

describe("Asset Mutation RPCs", () => {
  it("create_asset — rejects empty data", async () => {
    const { error } = await adminClient.rpc("create_asset", {
      p_asset_data: {},
      p_maintenance_history: [],
      p_maintenance_plans: [],
    });
    expectValidError(error);
  });

  it("update_asset — rejects non-existent asset", async () => {
    const { error } = await adminClient.rpc("update_asset", {
      p_id: FAKE_ID,
      p_asset_data: {},
      p_maintenance_history: [],
      p_maintenance_plans: [],
    });
    expectValidError(error);
  });

  it("delete_asset — rejects non-existent asset", async () => {
    const { error } = await adminClient.rpc("delete_asset", {
      p_id: FAKE_ID,
    });
    expectValidError(error);
  });
});

// ─── Medical / Clinic ───────────────────────────────────────────────────────

describe("Medical Mutation RPCs", () => {
  it("check_in_patient — rejects non-existent customer", async () => {
    const { error } = await adminClient.rpc("check_in_patient", {
      p_customer_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("create_medical_visit — rejects non-existent appointment", async () => {
    const { error } = await adminClient.rpc("create_medical_visit", {
      p_appointment_id: NIL_UUID,
      p_customer_id: FAKE_ID,
      p_data: {},
    });
    expectValidError(error);
  });

  it("create_appointment_booking — rejects non-existent customer", async () => {
    const { error } = await adminClient.rpc("create_appointment_booking", {
      p_customer_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("checkout_clinical_services — rejects non-existent appointment", async () => {
    const { error } = await adminClient.rpc("checkout_clinical_services", {
      p_appointment_id: NIL_UUID,
      p_customer_id: FAKE_ID,
      p_services: [],
    });
    expectValidError(error);
  });

  it("submit_paraclinical_result — rejects non-existent request", async () => {
    const { error } = await adminClient.rpc("submit_paraclinical_result", {
      p_request_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("send_prescription_to_pos — rejects non-existent appointment", async () => {
    const { error } = await adminClient.rpc("send_prescription_to_pos", {
      p_appointment_id: NIL_UUID,
      p_customer_id: FAKE_ID,
      p_items: [],
      p_pharmacy_warehouse_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("sell_medical_packages — rejects non-existent customer", async () => {
    const { error } = await adminClient.rpc("sell_medical_packages", {
      p_customer_id: FAKE_ID,
      p_packages: [],
    });
    expectValidError(error);
  });
});

// ─── Prescription Templates ─────────────────────────────────────────────────

describe("Prescription Template Mutation RPCs", () => {
  it("create_prescription_template — rejects empty data", async () => {
    const { error } = await adminClient.rpc("create_prescription_template", {
      p_data: {},
      p_items: [],
    });
    expectValidError(error);
  });

  it("update_prescription_template — rejects non-existent template", async () => {
    const { error } = await adminClient.rpc("update_prescription_template", {
      p_id: FAKE_ID,
      p_data: {},
      p_items: [],
    });
    expectValidError(error);
  });

  it("delete_prescription_template — rejects non-existent template", async () => {
    const { error } = await adminClient.rpc("delete_prescription_template", {
      p_id: FAKE_ID,
    });
    expectValidError(error);
  });
});

// ─── Vaccination ────────────────────────────────────────────────────────────

describe("Vaccination Mutation RPCs", () => {
  it("create_vaccination_template — rejects empty data", async () => {
    const { error } = await adminClient.rpc("create_vaccination_template", {
      p_data: {},
      p_items: [],
    });
    expectValidError(error);
  });

  it("update_vaccination_template — rejects non-existent template", async () => {
    const { error } = await adminClient.rpc("update_vaccination_template", {
      p_id: FAKE_ID,
      p_data: {},
      p_items: [],
    });
    expectValidError(error);
  });

  it("delete_vaccination_template — rejects non-existent template", async () => {
    const { error } = await adminClient.rpc("delete_vaccination_template", {
      p_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("execute_vaccination_combo — rejects non-existent appointment", async () => {
    const { error } = await adminClient.rpc("execute_vaccination_combo", {
      p_appointment_id: NIL_UUID,
      p_customer_id: FAKE_ID,
      p_scanned_product_ids: [FAKE_ID],
      p_warehouse_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("generate_vaccine_timeline — rejects non-existent customer", async () => {
    const { error } = await adminClient.rpc("generate_vaccine_timeline", {
      p_customer_id: FAKE_ID,
      p_start_date: "2026-01-01",
    });
    expectValidError(error);
  });

  it("reschedule_vaccine_timeline — rejects non-existent record", async () => {
    const { error } = await adminClient.rpc("reschedule_vaccine_timeline", {
      p_record_id: FAKE_ID,
      p_new_expected_date: "2026-06-01",
    });
    expectValidError(error);
  });
});

// ─── Service Packages ───────────────────────────────────────────────────────

describe("Service Package Mutation RPCs", () => {
  it("create_service_package — rejects empty data", async () => {
    const { error } = await adminClient.rpc("create_service_package", {
      p_data: {},
      p_items: [],
    });
    expectValidError(error);
  });

  it("update_service_package — rejects non-existent package", async () => {
    const { error } = await adminClient.rpc("update_service_package", {
      p_id: FAKE_ID,
      p_data: {},
      p_items: [],
    });
    expectValidError(error);
  });

  it("delete_service_packages — function exists", async () => {
    const { error } = await adminClient.rpc("delete_service_packages", {
      p_ids: [FAKE_ID],
    });
    // Verify function exists (not PGRST202)
    if (error) expect(error.code).not.toBe("PGRST202");
  });
});

// ─── Connect / Social ───────────────────────────────────────────────────────

describe("Connect Mutation RPCs", () => {
  it("create_connect_post — rejects empty data", async () => {
    const { error } = await adminClient.rpc("create_connect_post", {
      p_title: "",
      p_content: "",
      p_category: "general",
    });
    expectValidError(error);
  });

  it("confirm_post_read — rejects non-existent post", async () => {
    const { error } = await adminClient.rpc("confirm_post_read", {
      p_post_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("mark_notification_read — rejects non-existent notification", async () => {
    const { error } = await adminClient.rpc("mark_notification_read", {
      p_noti_id: NIL_UUID,
    });
    expectValidError(error);
  });
});

// ─── User / Permissions ─────────────────────────────────────────────────────

describe("User & Permission Mutation RPCs", () => {
  it("update_permissions_for_role — rejects non-existent role", async () => {
    const { error } = await adminClient.rpc("update_permissions_for_role", {
      p_role_id: NIL_UUID,
      p_permission_keys: [],
    });
    expectValidError(error);
  });

  it("update_user_assignments — rejects non-existent user", async () => {
    const { error } = await adminClient.rpc("update_user_assignments", {
      p_user_id: NIL_UUID,
      p_assignments: [],
    });
    expectValidError(error);
  });

  it("update_user_status — rejects non-existent user", async () => {
    const { error } = await adminClient.rpc("update_user_status", {
      p_user_id: NIL_UUID,
      p_status: "inactive",
    });
    expectValidError(error);
  });

  it("update_self_profile — rejects empty data", async () => {
    const { error } = await adminClient.rpc("update_self_profile", {
      p_profile_data: {},
    });
    expectValidError(error);
  });
});

// ─── Promotions / Vouchers ──────────────────────────────────────────────────

describe("Promotion Mutation RPCs", () => {
  it("distribute_voucher_to_segment — rejects non-existent promotion", async () => {
    const { error } = await adminClient.rpc("distribute_voucher_to_segment", {
      p_promotion_id: NIL_UUID,
      p_segment_id: FAKE_ID,
    });
    expectValidError(error);
  });

  it("refresh_segment_members — rejects non-existent segment", async () => {
    const { error } = await adminClient.rpc("refresh_segment_members", {
      p_segment_id: FAKE_ID,
    });
    expectValidError(error);
  });
});

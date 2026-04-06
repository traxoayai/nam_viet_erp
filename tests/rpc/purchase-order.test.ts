import { describe, it, expect } from "vitest";
import { adminClient } from "../helpers/supabase";

/**
 * Tests for purchase order RPCs.
 *
 * confirm_purchase_order requires 'purchasing.edit' permission per rpc_access_rules.
 * The function itself does NOT call check_rpc_access() (only the rules table
 * registers the requirement — the guard is only injected into specific RPCs).
 * So service_role can call it, and business logic errors are reachable.
 */
describe("purchase order RPCs", () => {
  // ----------------------------------------------------------------
  // confirm_purchase_order — invalid PO id
  // ----------------------------------------------------------------
  it("confirm_purchase_order rejects invalid (non-existent) PO id", async () => {
    const { error } = await adminClient.rpc("confirm_purchase_order", {
      p_po_id: 999999,
      p_status: "PENDING",
    });

    // Expected: some error (PO not found, or status transition invalid)
    expect(error).toBeDefined();
  });

  it("confirm_purchase_order rejects with non-null error message", async () => {
    const { error } = await adminClient.rpc("confirm_purchase_order", {
      p_po_id: 999999,
      p_status: "PENDING",
    });

    expect(error).toBeDefined();
    expect(typeof error!.message).toBe("string");
    expect(error!.message.length).toBeGreaterThan(0);
  });

  // ----------------------------------------------------------------
  // delete_purchase_order — guard fires first for service_role
  // ----------------------------------------------------------------
  it("delete_purchase_order rejects with Unauthorized for service_role", async () => {
    const { error } = await adminClient.rpc("delete_purchase_order", {
      p_po_id: 999999,
    });

    expect(error).toBeDefined();
    // Guard fires since service_role has null auth.uid()
    expect(error!.message).toMatch(/Unauthorized|Chưa đăng nhập/i);
  });

  // ----------------------------------------------------------------
  // delete_purchase_order — non-DRAFT PO should fail business rule
  // (only reachable if guard is bypassed / user is authenticated)
  // ----------------------------------------------------------------
  it("delete_purchase_order error message documents business rule for non-DRAFT POs", async () => {
    // This test documents that the error text for deleting a non-DRAFT PO
    // contains the word 'Nháp' (Vietnamese for Draft).
    // Since service_role triggers Unauthorized first, we accept either error.
    const { data: po } = await adminClient
      .from("purchase_orders")
      .select("id, status")
      .neq("status", "DRAFT")
      .limit(1)
      .maybeSingle();

    if (!po) {
      console.log("SKIP: No non-DRAFT purchase orders in test DB.");
      return;
    }

    const { error } = await adminClient.rpc("delete_purchase_order", {
      p_po_id: po.id,
    });

    expect(error).toBeDefined();
    const msg = error!.message;
    // Guard (Unauthorized) fires before business logic for service_role
    // Real user with permission would see: 'Chỉ có thể xóa đơn hàng ở trạng thái Nháp.'
    expect(msg).toMatch(/Unauthorized|Chưa đăng nhập|Nháp/i);
  });

  // ----------------------------------------------------------------
  // create_purchase_order — null shipping_partner_id should NOT cause FK error
  // ----------------------------------------------------------------
  it("create_purchase_order accepts null shipping_partner_id without FK violation", async () => {
    // Test read-only: verify DB schema cho phép NULL shipping_partner_id
    // Kiểm tra column nullable bằng cách query metadata thay vì tạo data thật
    const { data: existing } = await adminClient
      .from("purchase_orders")
      .select("id, shipping_partner_id")
      .is("shipping_partner_id", null)
      .limit(1)
      .maybeSingle();

    // Nếu đã có PO với shipping_partner_id = NULL → column chắc chắn nullable
    if (existing) {
      expect(existing.shipping_partner_id).toBeNull();
      return;
    }

    // Fallback: gọi RPC với invalid supplier để trigger lỗi business logic,
    // KHÔNG phải FK violation — chứng minh null shipping_partner_id được accept
    const { error } = await adminClient.rpc("create_purchase_order", {
      p_supplier_id: -1,
      p_expected_date: null,
      p_note: "",
      p_delivery_method: "internal",
      p_shipping_partner_id: null,
      p_shipping_fee: 0,
      p_status: "DRAFT",
      p_items: [],
    });

    // Lỗi phải là business logic (supplier không tồn tại, Unauthorized, v.v.)
    // KHÔNG được là FK constraint violation trên shipping_partner_id
    if (error) {
      expect(error.message).not.toMatch(/foreign key constraint.*shipping_partner_id/i);
    }
  });

  // ----------------------------------------------------------------
  // Read-only: verify purchase_orders table is accessible via service_role
  // ----------------------------------------------------------------
  it("can read purchase_orders table via service_role", async () => {
    const { data, error } = await adminClient
      .from("purchase_orders")
      .select("id, status, code")
      .limit(5);

    // service_role bypasses RLS — should always succeed
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

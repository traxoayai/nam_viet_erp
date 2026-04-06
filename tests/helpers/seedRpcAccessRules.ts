import { adminClient } from "./supabase";

/**
 * Seed rpc_access_rules nếu chưa có data (local DB chưa apply đủ migrations).
 * Dùng upsert ON CONFLICT DO NOTHING — idempotent, không ghi đè production data.
 */
export async function seedRpcAccessRules() {
  const { count } = await adminClient
    .from("rpc_access_rules")
    .select("*", { count: "exact", head: true });

  // Đã có data → skip
  if (count && count > 0) return;

  const rules = [
    // AUTH & USER MANAGEMENT
    { function_name: "approve_user", required_permission: "settings.permissions", max_calls_per_minute: 10, is_write: true, description: "Duyệt user mới" },
    { function_name: "update_user_status", required_permission: "settings.permissions", max_calls_per_minute: 20, is_write: true, description: "Cập nhật trạng thái user" },
    { function_name: "update_user_assignments", required_permission: "settings.permissions", max_calls_per_minute: 20, is_write: true, description: "Gán role cho user" },
    { function_name: "update_permissions_for_role", required_permission: "settings.permissions", max_calls_per_minute: 20, is_write: true, description: "Cập nhật quyền cho role" },
    { function_name: "delete_auth_user", required_permission: "settings.permissions", max_calls_per_minute: 5, is_write: true, description: "Xóa user" },
    { function_name: "invite_new_user", required_permission: "settings.permissions", max_calls_per_minute: 10, is_write: true, description: "Mời user mới" },
    { function_name: "create_new_auth_user", required_permission: "settings.permissions", max_calls_per_minute: 10, is_write: true, description: "Tạo user mới" },
    // PURCHASING
    { function_name: "create_purchase_order", required_permission: "purchasing.create", max_calls_per_minute: 30, is_write: true, description: "Tạo PO" },
    { function_name: "update_purchase_order", required_permission: "purchasing.edit", max_calls_per_minute: 30, is_write: true, description: "Cập nhật PO" },
    { function_name: "confirm_purchase_order", required_permission: "purchasing.edit", max_calls_per_minute: 20, is_write: true, description: "Xác nhận PO" },
    { function_name: "delete_purchase_order", required_permission: "purchasing.edit", max_calls_per_minute: 10, is_write: true, description: "Xóa PO" },
    { function_name: "cancel_purchase_order", required_permission: "purchasing.edit", max_calls_per_minute: 10, is_write: true, description: "Hủy đơn mua hàng" },
    { function_name: "confirm_purchase_costing", required_permission: "purchasing.costing", max_calls_per_minute: 20, is_write: true, description: "Chốt giá vốn" },
    // SALES & POS
    { function_name: "create_sales_order", required_permission: null, max_calls_per_minute: 60, is_write: true, description: "Tạo đơn bán hàng (POS)" },
    { function_name: "update_sales_order", required_permission: null, max_calls_per_minute: 30, is_write: true, description: "Cập nhật đơn bán" },
    { function_name: "cancel_order", required_permission: null, max_calls_per_minute: 20, is_write: true, description: "Hủy đơn hàng" },
    // FINANCE
    { function_name: "create_finance_transaction", required_permission: "finance.view_balance", max_calls_per_minute: 30, is_write: true, description: "Tạo phiếu thu/chi" },
    { function_name: "confirm_finance_transaction", required_permission: "finance.view_balance", max_calls_per_minute: 20, is_write: true, description: "Duyệt phiếu thu/chi" },
    { function_name: "delete_invoice_atomic", required_permission: "finance.view_balance", max_calls_per_minute: 10, is_write: true, description: "Xóa hóa đơn" },
    // VAT
    { function_name: "deduct_vat_for_pos_export", required_permission: null, max_calls_per_minute: 60, is_write: true, description: "Trừ kho VAT (đơn lẻ)" },
    { function_name: "batch_deduct_vat_for_pos", required_permission: null, max_calls_per_minute: 60, is_write: true, description: "Trừ kho VAT (batch atomic)" },
    { function_name: "process_vat_export_entry", required_permission: "finance.view_balance", max_calls_per_minute: 20, is_write: true, description: "Trừ kho VAT từ HĐ xuất" },
    // READ
    { function_name: "get_purchase_orders_master", required_permission: null, max_calls_per_minute: 120, is_write: false, description: "Danh sách PO" },
    { function_name: "search_products_pos", required_permission: null, max_calls_per_minute: 120, is_write: false, description: "Tìm SP POS" },
  ];

  const { error } = await adminClient
    .from("rpc_access_rules")
    .upsert(rules, { onConflict: "function_name", ignoreDuplicates: true });

  if (error) {
    console.warn("[seedRpcAccessRules] Failed to seed:", error.message);
  }
}

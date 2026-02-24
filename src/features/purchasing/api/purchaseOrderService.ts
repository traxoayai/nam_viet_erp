// src/services/purchaseOrderService.ts
import dayjs from "dayjs";

import { supabase } from "@/shared/lib/supabaseClient";

export const purchaseOrderService = {
  // 1. Lấy danh sách PO
  async getPOs(filters: any, page: number, pageSize: number) {
    const { data, error } = await supabase.rpc("get_purchase_orders_master", {
      p_page: page,
      p_page_size: pageSize,
      p_search: filters.search || null,
      p_status_delivery:
        filters.delivery_status || filters.deliveryStatus || null, // Support cả 2 kiểu naming
      p_status_payment: filters.payment_status || filters.paymentStatus || null,
      p_date_from: filters.date_from || null,
      p_date_to: filters.date_to || null,
    });

    if (error) throw error;
    const totalCount = data && data.length > 0 ? data[0].full_count : 0;
    return { data: data || [], totalCount };
  },

  // 2. Lấy chi tiết PO
  async getPODetail(id: number) {
    const { data, error } = await supabase.rpc("get_purchase_order_detail", {
      p_po_id: id,
    });
    if (error) throw error;
    return data;
  },

  // 3. Tạo Đơn Nháp (Create) - [UPDATE] Hàm tạo đơn mua hàng (Khớp với RPC V29.1 của Core)
  async createPO(payload: {
    supplier_id: number;
    expected_date?: string;
    note?: string;
    delivery_method?: string;
    shipping_partner_id?: number;
    shipping_fee?: number;
    items: any[];
    status: "DRAFT" | "PENDING";
  }) {
    // Mapping tham số chuẩn xác 100% với RPC create_purchase_order
    const rpcPayload = {
      p_supplier_id: payload.supplier_id,
      p_expected_date: payload.expected_date || null,
      p_note: payload.note || "",
      p_delivery_method: payload.delivery_method || "self_shipping",
      p_shipping_partner_id: payload.shipping_partner_id || null,
      p_shipping_fee: payload.shipping_fee || 0,
      p_status: payload.status,

      // Map Items Array
      p_items: payload.items.map((i) => ({
        product_id: i.product_id || i.id,
        // Frontend gửi 'quantity', Backend V29.1 sẽ tự map vào 'quantity_ordered'
        quantity: i.quantity,
        // Giá nhập
        unit_price: i.unit_price || i.price,
        // Đơn vị (Backend sẽ lưu vào uom_ordered và unit)
        unit: i.unit || i.uom,
        // [QUAN TRỌNG] Hàng tặng/Khuyến mãi (Core V20)
        is_bonus: i.is_bonus || false,
      })),
    };

    console.log("📤 Creating PO with Payload:", rpcPayload);

    const { data, error } = await supabase.rpc(
      "create_purchase_order",
      rpcPayload
    );

    if (error) {
      console.error("RPC Error:", error);
      throw error;
    }
    return data; // Trả về { id, code, status, message }
  },

  // 4. Cập nhật Đơn Nháp (Update)
  async updatePO(id: number, payload: any, items: any[]) {
    // [LOGIC] Combine Date + Time for p_expected_delivery_time
    let fullDateTime = null;
    if (payload.expected_delivery_date) {
      const dateStr = dayjs(payload.expected_delivery_date).format(
        "YYYY-MM-DD"
      );
      const timeStr = payload.expected_delivery_time || "00:00";
      fullDateTime = dayjs(`${dateStr}T${timeStr}`).toISOString();
    }

    const params = {
      p_po_id: id,
      // [UPDATE V35.9] Items moved up
      p_items: items.map((item: any) => ({
        product_id: item.product_id,
        quantity_ordered:
          item.quantity && Number(item.quantity) > 0
            ? Number(item.quantity)
            : 1,
        uom_ordered: item.uom,
        unit_price: item.unit_price || 0,
        is_bonus: item.is_bonus || false, // [FIX] Add bonus flag
      })),

      p_supplier_id: payload.supplier_id,
      p_expected_date: payload.expected_delivery_date, // Keep legacy param if needed by core, or maybe core uses p_expected_delivery_time now? User said RPC V35.9 adds p_expected_delivery_time. I will keep both if unsure, or just follow user list. User listed p_expected_delivery_time. I will include everything.
      p_expected_delivery_time: fullDateTime,

      p_note: payload.note,
      p_delivery_method: payload.delivery_method,
      p_shipping_partner_id: payload.shipping_partner_id || null,
      p_shipping_fee: payload.shipping_fee || 0,
      p_status: "DRAFT",

      // [UPDATE V35.9] Logistics Fields
      p_carrier_name: payload.carrier_name || null,
      p_carrier_contact: payload.carrier_contact || null,
      p_carrier_phone: payload.carrier_phone || null,
      p_total_packages: payload.total_packages || 0,
    };

    const { error } = await supabase.rpc("update_purchase_order", params);
    if (error) throw error;
    return true;
  },

  // 5. Xác nhận Đặt Hàng
  async confirmPO(id: number) {
    const { error } = await supabase.rpc("confirm_purchase_order", {
      p_po_id: id,
      p_status: "PENDING",
    });
    if (error) throw error;
    return true;
  },

  // 6. Xóa PO
  async deletePO(id: number) {
    const { error } = await supabase.rpc("delete_purchase_order", { p_id: id });
    if (error) throw error;
    return true;
  },

  // 7. Xóa Hàng Loạt
  async bulkDeleteOrders(ids: React.Key[]) {
    const { error } = await supabase
      .from("purchase_orders")
      .delete()
      .in("id", ids);
    if (error) throw error;
    return true;
  },

  // 8. Cập nhật Vận chuyển Hàng Loạt
  async bulkUpdateLogistics(ids: React.Key[], method: string) {
    const { error } = await supabase
      .from("purchase_orders")
      .update({ delivery_method: method })
      .in("id", ids);
    if (error) throw error;
    return true;
  },

  // 9. Tạo tự động Min Max kho B2b (Placeholder)
  // async createAutoMinMaxB2B() {
  //   // TODO: Implement later
  // },

  // 9b. [NEW] Lấy danh sách chương trình/hợp đồng của NCC
  async getActiveProgramsBySupplier(supplierId: number) {
    const { data, error } = await supabase
      .from("supplier_programs")
      .select("id, name, code, description")
      .eq("supplier_id", supplierId)
      .eq("status", "active");

    if (error) {
      console.error("Error loading programs:", error);
      return [];
    }
    return data;
  },

  // 9c. [NEW] Lấy chi tiết chương trình (Bao gồm Groups & Rules) - [FIX] Chuẩn query theo Group ID
  async getProgramDetail(programId: number | string) {
    try {
      // 1. Fetch Groups trước
      const { data: groups, error: errGroups } = await supabase
        .from("supplier_program_groups")
        .select("*")
        .eq("program_id", programId);

      if (errGroups) throw errGroups;
      if (!groups || groups.length === 0) return { groups: [], items: [] };

      // 2. Lấy danh sách Group IDs
      const groupIds = groups.map((g: any) => g.id);

      // 3. Fetch Products theo Group IDs
      const { data: items, error: errItems } = await supabase
        .from("supplier_program_products")
        .select("*")
        .in("group_id", groupIds); // Query theo group_id

      if (errItems) throw errItems;

      return { groups, items };
    } catch (error) {
      console.error("Error loading program detail:", error);
      return null;
    }
  },

  // 10. Chốt nhập kho & Tính giá vốn (V34)
  async confirmPOFinancials(poId: number, itemsData: any[]) {
    const { data, error } = await supabase.rpc(
      "confirm_purchase_order_financials",
      {
        p_po_id: poId,
        p_items_data: itemsData,
      }
    );
    if (error) throw error;
    return data;
  },

  // 11. [NEW] V35 Core Costing Confirmation
  async confirmCosting(payload: {
    p_po_id: number;
    p_total_shipping_fee: number;
    p_items_data: {
      id: number;
      product_id: number;
      final_unit_cost: number;
      rebate_rate: number;
      vat_rate: number;
      quantity_received: number;
      bonus_quantity: number;
    }[];
    p_gifts_data: {
      name: string;
      code?: string;
      quantity: number;
      estimated_value: number;
      image_url?: string;
      unit_name: string;
    }[];
  }) {
    console.log("🚀 Submitting Costing V35:", payload);
    const { data, error } = await supabase.rpc(
      "confirm_purchase_costing",
      payload
    );
    if (error) throw error;
    return data;
  },

  // 12. [NEW] Snapshot Price before Update (Fix Costing V35.8)
  async getProductCostsSnapshot(productIds: number[]) {
    const { data, error } = await supabase
      .from("products")
      .select("id, actual_cost") // Chỉ cần lấy actual_cost hiện tại
      .in("id", productIds);
    if (error) throw error;
    return data;
  },
};

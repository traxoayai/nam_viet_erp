// src/services/purchaseOrderService.ts
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
    status: 'DRAFT' | 'PENDING';
  }) {
    // Mapping tham số chuẩn xác 100% với RPC create_purchase_order
    const rpcPayload = {
      p_supplier_id: payload.supplier_id,
      p_expected_date: payload.expected_date || null,
      p_note: payload.note || '',
      p_delivery_method: payload.delivery_method || 'self_shipping',
      p_shipping_partner_id: payload.shipping_partner_id || null,
      p_shipping_fee: payload.shipping_fee || 0,
      p_status: payload.status,
      
      // Map Items Array
      p_items: payload.items.map(i => ({
          product_id: i.product_id || i.id,
          // Frontend gửi 'quantity', Backend V29.1 sẽ tự map vào 'quantity_ordered'
          quantity: i.quantity, 
          // Giá nhập
          unit_price: i.unit_price || i.price,
          // Đơn vị (Backend sẽ lưu vào uom_ordered và unit)
          unit: i.unit || i.uom,
          // [QUAN TRỌNG] Hàng tặng/Khuyến mãi (Core V20)
          is_bonus: i.is_bonus || false 
      }))
    };

    console.log("📤 Creating PO with Payload:", rpcPayload);

    const { data, error } = await supabase.rpc('create_purchase_order', rpcPayload);
    
    if (error) {
        console.error("RPC Error:", error);
        throw error;
    }
    return data; // Trả về { id, code, status, message }
  },

  // 4. Cập nhật Đơn Nháp (Update)
  async updatePO(id: number, payload: any, items: any[]) {
    const params = {
      p_po_id: id,
      p_supplier_id: payload.supplier_id,
      p_expected_date: payload.expected_delivery_date,
      p_note: payload.note,
      p_delivery_method: payload.delivery_method,
      p_shipping_partner_id: payload.shipping_partner_id || null,
      p_shipping_fee: payload.shipping_fee || 0,
      p_status: "DRAFT",
      p_items: items.map((item: any) => ({
        product_id: item.product_id,
        quantity_ordered:
          item.quantity && Number(item.quantity) > 0
            ? Number(item.quantity)
            : 1,
        uom_ordered: item.uom,
        unit_price: item.unit_price || 0,
      })),
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

  // 9. Tạo tự động Min Max kho B2b
  async autoCreateMinMax() {
    const { data, error } = await supabase.rpc(
      "auto_create_purchase_orders_min_max"
    );
    if (error) throw new Error(error.message);
    return data as number;
  },
};

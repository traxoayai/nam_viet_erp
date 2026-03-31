// src/features/inventory/api/inventoryService.ts
import { v4 as uuidv4 } from "uuid";

import {
  InventoryCheckItem,
  InventoryCheckSession,
} from "../types/inventory.types";

import { safeRpc } from "@/shared/lib/safeRpc";
import { supabase } from "@/shared/lib/supabaseClient";
// Đảm bảo đường dẫn import types đúng với dự án

// [NEW] Interface cho Thẻ kho (Spec V41)
export interface ProductCardexItem {
  transaction_date: string; // ISO String
  type: "in" | "out"; // 'in' = Nhập, 'out' = Xuất
  business_type: string; // 'sale', 'purchase', 'import', 'export', 'check'...
  quantity: number; // Luôn là số dương
  unit_price: number; // Giá tại thời điểm giao dịch
  ref_code: string | null; // Mã phiếu (VD: SO-260202-1234)
  partner_name: string; // [MỚI] Tên NCC hoặc Khách hàng liên quan (Đã xử lý N/A ở BE)
  description: string | null;
  created_by_name: string; // Tên nhân viên thực hiện
}

export const inventoryService = {
  // =================================================================
  // PHẦN 1: NGHIỆP VỤ NHẬP KHO (INBOUND & AI) - [GIỮ NGUYÊN TỪ CODE CŨ]
  // =================================================================

  // 1. Tạo Phiếu Nhập Kho (Gọi RPC)
  async createReceipt(payload: any) {
    const { data } = await safeRpc("create_inventory_receipt", {
      p_po_id: payload.po_id,
      p_warehouse_id: payload.warehouse_id,
      p_note: payload.note,
      p_items: payload.items, // Array [{product_id, quantity, lot_number, expiry_date}]
    });
    return data;
  },

  // [NEW] Check Tồn kho khả dụng (V20 Logic)
  async getAvailability(warehouseId: number, productIds: number[]) {
    const { data } = await safeRpc("get_product_available_stock", {
      p_warehouse_id: warehouseId,
      p_product_ids: productIds,
    });
    return data;
  },

  // 2. Scan Label AI (Đọc vỏ hộp thuốc)
  async scanProductLabel(file: File) {
    // Upload ảnh tạm
    const fileName = `temp/${uuidv4()}.${file.name.split(".").pop()}`;
    const { error: uploadError } = await supabase.storage
      .from("invoices")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("invoices")
      .getPublicUrl(fileName);

    // Gọi AI
    const { data, error } = await supabase.functions.invoke(
      "scan-product-label",
      {
        body: { file_url: urlData.publicUrl },
      }
    );

    if (error) throw error;
    return { ...data, file_url: urlData.publicUrl };
  },

  // 3. Lấy phiếu nhập theo PO ID
  async getReceiptByPO(poId: number) {
    const { data, error } = await supabase
      .from("inventory_receipts")
      .select(
        `
        *,
        items:inventory_receipt_items (
          product_id, quantity, lot_number, expiry_date,
          product:products (name, sku, retail_unit)
        )
      `
      )
      .eq("po_id", poId)
      .single();

    if (error) throw error;
    return data;
  },

  // =================================================================
  // PHẦN 2: NGHIỆP VỤ CÀI ĐẶT VỊ TRÍ (QUICK LOCATION)
  // =================================================================

  // 4. Tìm kiếm sản phẩm (Hàm này cần thiết cho giao diện Quick Location)
  async searchProducts(keyword: string, warehouseId: number) {
    const { data, error } = await supabase
      .from("product_inventory")
      .select(
        `
            product_id,
            stock_quantity,
            location_cabinet,
            location_row,
            location_slot,
            product:products!inner(id, name, sku, image_url, category_name)
        `
      )
      .eq("warehouse_id", warehouseId)
      .ilike("product.name", `%${keyword}%`)
      .limit(20);

    if (error) throw error;

    // Map dữ liệu cho UI
    return data.map((item: any) => ({
      id: item.product_id,
      name: item.product.name,
      sku: item.product.sku,
      image_url: item.product.image_url,
      category: item.product.category_name,
      stock: item.stock_quantity,
      cabinet: item.location_cabinet,
      row: item.location_row,
      slot: item.location_slot,
    }));
  },

  // 5. Cập nhật vị trí sản phẩm (Giữ nguyên signature cũ của Sếp)
  async updateProductLocation(
    warehouseId: number,
    productId: number,
    location: { cabinet?: string; row?: string; slot?: string }
  ) {
    const { data } = await safeRpc("update_product_location", {
      p_warehouse_id: warehouseId,
      p_product_id: productId,
      p_cabinet: location.cabinet || "",
      p_row: location.row || "",
      p_slot: location.slot || "",
    });
    return data;
  },

  // =================================================================
  // PHẦN 3: NGHIỆP VỤ KIỂM KÊ (STOCKTAKE) - [MỚI BỔ SUNG]
  // =================================================================

  // [UPDATE V3] Lấy danh sách phiếu kiểm (Full Filter + Pagination + Search User)
  async getCheckSessions(params: {
    warehouseId?: number | null;
    search?: string;
    status?: string;
    startDate?: string; // ISO string
    endDate?: string; // ISO string
    page?: number;
    pageSize?: number;
  }) {
    const {
      warehouseId,
      search,
      status,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
    } = params;

    const { data } = await safeRpc("get_inventory_checks_list", {
      p_warehouse_id: warehouseId || null,
      p_search: search || null, // Tìm kiếm (Mã, Note, Tên User)
      p_status: status || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    });

    // Ép kiểu về Interface mới
    return data as InventoryCheckSession[];
  },

  // 7. Tạo phiếu kiểm (Hỗ trợ lọc MANUFACTURER)
  async createCheckSession(params: {
    warehouseId: number;
    note?: string;
    scope: "ALL" | "CATEGORY" | "MANUFACTURER" | "CABINET" | "SUPPLIER";
    textVal?: string;
    intVal?: number;
  }) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Chưa đăng nhập");

    const { data } = await safeRpc("create_inventory_check", {
      p_warehouse_id: params.warehouseId,
      p_user_id: user.user.id,
      p_note: params.note,
      p_scope: params.scope,
      p_text_val: params.textVal || null,
      p_int_val: params.intVal || null,
    });
    return data;
  },

  // 8. Lấy danh sách Tủ/Kệ (Cho Dropdown Modal)
  async getCabinets(warehouseId: number) {
    const { data } = await safeRpc("get_warehouse_cabinets", {
      p_warehouse_id: warehouseId,
    });
    return data.map((i: any) => i.cabinet_name);
  },

  // 9. Các hàm hỗ trợ lấy danh mục/Hãng SX (Unique & Not Null)
  async getCategories() {
    const { data } = await supabase
      .from("products")
      .select("category_name")
      .not("category_name", "is", null);

    const uniqueCats = [
      ...new Set(data?.map((i: any) => i.category_name)),
    ].filter(Boolean);
    return uniqueCats as string[];
  },

  async getManufacturers() {
    const { data } = await supabase
      .from("products")
      .select("manufacturer_name")
      .not("manufacturer_name", "is", null);

    const uniqueMans = [
      ...new Set(data?.map((i: any) => i.manufacturer_name)),
    ].filter(Boolean);
    return uniqueMans as string[];
  },

  async getDistributors() {
    const { data } = await supabase.from("distributors").select("id, name");
    return data || [];
  },

  // 10. Hủy phiếu
  async cancelCheck(checkId: number) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Chưa đăng nhập");

    await safeRpc("cancel_inventory_check", {
      p_check_id: checkId,
      p_user_id: user.user.id,
    });
  },

  // 11. Lưu tạm
  async updateCheckInfo(checkId: number, note: string) {
    await safeRpc("update_inventory_check_info", {
      p_check_id: checkId,
      p_note: note,
    });
  },

  // Xóa item khỏi phiếu kiểm kê
  async removeCheckItem(itemId: number) {
    const { error } = await supabase
      .from("inventory_check_items")
      .delete()
      .eq("id", itemId);
    if (error) throw error;
  },

  // Tách lô mới (Tạo dòng zero quantity trùng product_id)
  async splitCheckItem(checkId: number, productId: number) {
    const { data: user } = await supabase.auth.getUser();
    
    // Tạo record mới toanh với số lượng bằng 0
    const { data, error } = await supabase
      .from("inventory_check_items")
      .insert({
        check_id: checkId,
        product_id: productId,
        system_quantity: 0,
        actual_quantity: 0,
        location_snapshot: "Tách lô",
        created_by: user.user?.id || null,
      })
      .select("id")
      .single();

    if (error) throw error;
    return data;
  },

  // 12. Lấy chi tiết phiếu (Header + Items với Join phức tạp)
  async getCheckSession(checkId: number) {
    const { data: session, error: sessError } = await supabase
      .from("inventory_checks")
      .select("*")
      .eq("id", checkId)
      .single();
    if (sessError) throw sessError;

    const { data: items, error: itemError } = await supabase
      .from("inventory_check_items")
      .select(
        `
        *,
        product:products (
            name, sku, image_url,
            units:product_units (unit_name, conversion_rate, is_base, is_direct_sale, unit_type)
        )
      `
      )
      .eq("check_id", checkId)
      .order("location_snapshot", { ascending: true });
    if (itemError) throw itemError;

    // Map dữ liệu Hộp/Lẻ/Viên
    const formattedItems: InventoryCheckItem[] = items.map((i: any) => {
      const units = i.product?.units || [];
      
      // 1. Tìm Base Unit
      const baseUnitObj = units.find((u: any) => u.is_base || u.unit_type === "base" || u.conversion_rate === 1);
      
      // 2. Lọc bỏ các Unit trùng tên với Base Unit (để tránh lặp)
      const nonBaseUnits = units.filter((u: any) => u.unit_name !== baseUnitObj?.unit_name);

      // 3. Tìm Retail và Wholesale trong danh sách còn lại
      let retailUnitObj = nonBaseUnits.find((u: any) => u.unit_type === "retail");
      let wholesaleUnitObj = nonBaseUnits.find((u: any) => u.unit_type === "wholesale");

      // Nếu ko có wholesale/retail mà có các unit khác > 1, tự map vào
      if (!wholesaleUnitObj && !retailUnitObj && nonBaseUnits.length > 0) {
          const sorted = nonBaseUnits.sort((a:any, b:any) => b.conversion_rate - a.conversion_rate);
          if (sorted.length >= 2) {
              wholesaleUnitObj = sorted[0];
              retailUnitObj = sorted[1];
          } else if (sorted.length === 1) {
              wholesaleUnitObj = sorted[0];
          }
      }

      const retailRate = retailUnitObj?.conversion_rate || 1;
      const wholesaleRate = wholesaleUnitObj?.conversion_rate || retailRate;

      // Bóc tách số lượng
      let remaining = i.counted_at ? i.actual_quantity : (i.system_quantity || 0);
      let inputWholesale = 0;
      let inputRetail = 0;

      if (wholesaleUnitObj && wholesaleRate > 1) {
        inputWholesale = Math.floor(remaining / wholesaleRate);
        remaining -= inputWholesale * wholesaleRate;
      }
      
      if (retailUnitObj && retailRate > 1 && retailRate !== wholesaleRate) {
        inputRetail = Math.floor(remaining / retailRate);
        remaining -= inputRetail * retailRate;
      }

      const inputBase = remaining;

      return {
        id: i.id,
        check_id: i.check_id,
        product_id: i.product_id,
        product_name: i.product?.name || "Sản phẩm ẩn",
        sku: i.product?.sku || "",
        image_url: i.product?.image_url,
        
        product_units: units,
        base_unit_name: baseUnitObj?.unit_name || "Viên",
        retail_unit_name: retailUnitObj?.unit_name,
        retail_unit_rate: retailRate,
        wholesale_unit_name: wholesaleUnitObj?.unit_name,
        wholesale_unit_rate: wholesaleRate,

        input_wholesale_qty: inputWholesale,
        input_retail_qty: inputRetail,
        input_base_qty: inputBase,

        batch_code: i.batch_code,
        expiry_date: i.expiry_date,
        system_quantity: i.system_quantity,
        actual_quantity: i.actual_quantity,
        counted_at: i.counted_at, // Map trường này để check
        cost_price: i.cost_price,
        location_snapshot: i.location_snapshot,
        diff_quantity: (i.counted_at ? i.actual_quantity : (i.system_quantity || 0)) - (i.system_quantity || 0),
      };
    });
    return { session, items: formattedItems };
  },

  // 13. Cập nhật số lượng kiểm kê
  async updateCheckItemQuantity(
    itemId: number,
    payload: {
      wholesale_qty?: number;
      retail_qty?: number;
      base_qty?: number;
      lot_number?: string;
      expiry_date?: string;
    }
  ) {
    const { data } = await safeRpc(
      "update_inventory_check_item_quantity",
      {
        p_item_id: itemId,
        p_payload: payload,
      }
    );
    return data;
  },

  // 14. Hoàn tất kiểm kho
  async completeCheck(checkId: number, userId: string) {
    await safeRpc("complete_inventory_check", {
      p_check_id: checkId,
      p_user_id: userId,
    });
  },

  // =================================================================
  // PHẦN 4: ACTIVE SCANNING (KIỂM KÊ CHỦ ĐỘNG) - [NEW V37]
  // =================================================================

  // 15. Tìm kiếm sản phẩm để thêm vào phiếu (Có unaccent, system snapshot)
  async searchProductForCheck(keyword: string, warehouseId: number) {
    const { data } = await safeRpc(
      "search_products_for_stocktake",
      {
        p_keyword: keyword,
        p_warehouse_id: warehouseId,
      }
    );
    return data; // Trả về mảng [{id, name, sku, system_stock, location...}]
  },

  // 16. Thêm sản phẩm vào phiếu (Snapshot tồn kho & giá vốn)
  async addItemToCheck(checkId: number, productId: number) {
    const { data } = await safeRpc("add_item_to_check_session", {
      p_check_id: checkId,
      p_product_id: productId,
    });
    return data; // { status: 'success'|'exists', item_id, message }
  },

  // 17. [HOTFIX] Lấy thẻ kho (Spec V41)
  async getProductCardex(
    productId: number,
    warehouseId: number,
    fromDate?: string,
    toDate?: string
  ): Promise<ProductCardexItem[]> {
    try {
      const { data } = await safeRpc("get_product_cardex", {
        p_product_id: productId,
        p_warehouse_id: warehouseId,
        p_from_date: fromDate || null,
        p_to_date: toDate || null,
      });
      return data || [];
    } catch {
      return [];
    }
  },
};

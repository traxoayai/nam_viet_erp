import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/shared/lib/supabaseClient";
// Đảm bảo đường dẫn import types đúng với dự án
import { InventoryCheckItem, InventoryCheckSession } from "../types/inventory.types"; 

export const inventoryService = {
  // =================================================================
  // PHẦN 1: NGHIỆP VỤ NHẬP KHO (INBOUND & AI) - [GIỮ NGUYÊN TỪ CODE CŨ]
  // =================================================================

  // 1. Tạo Phiếu Nhập Kho (Gọi RPC)
  async createReceipt(payload: any) {
    const { data, error } = await supabase.rpc("create_inventory_receipt", {
      p_po_id: payload.po_id,
      p_warehouse_id: payload.warehouse_id,
      p_note: payload.note,
      p_items: payload.items, // Array [{product_id, quantity, lot_number, expiry_date}]
    });
    if (error) throw error;
    return data;
  },

  // [NEW] Check Tồn kho khả dụng (V20 Logic)
  async getAvailability(warehouseId: number, productIds: number[]) {
      const { data, error } = await supabase.rpc('get_product_available_stock', {
        p_warehouse_id: warehouseId,
        p_product_ids: productIds
      });
      if (error) throw error;
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
        .from('product_inventory')
        .select(`
            product_id,
            stock_quantity,
            location_cabinet,
            location_row,
            location_slot,
            product:products!inner(id, name, sku, image_url, category_name)
        `)
        .eq('warehouse_id', warehouseId)
        .ilike('product.name', `%${keyword}%`)
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
        slot: item.location_slot
    }));
  },

  // 5. Cập nhật vị trí sản phẩm (Giữ nguyên signature cũ của Sếp)
  async updateProductLocation(warehouseId: number, productId: number, location: { cabinet?: string; row?: string; slot?: string }) {
    const { data, error } = await supabase.rpc("update_product_location", {
      p_warehouse_id: warehouseId,
      p_product_id: productId,
      p_cabinet: location.cabinet || '',
      p_row: location.row || '',
      p_slot: location.slot || ''
    });

    if (error) throw error;
    return data;
  },

  // =================================================================
  // PHẦN 3: NGHIỆP VỤ KIỂM KÊ (STOCKTAKE) - [MỚI BỔ SUNG]
  // =================================================================

  // [UPDATE V3] Lấy danh sách phiếu kiểm (Full Filter + Pagination + Search User)
  async getCheckSessions(params: {
      warehouseId?: number | null,
      search?: string,
      status?: string,
      startDate?: string, // ISO string
      endDate?: string,   // ISO string
      page?: number,
      pageSize?: number
  }) {
    const { warehouseId, search, status, startDate, endDate, page = 1, pageSize = 20 } = params;

    const { data, error } = await supabase.rpc('get_inventory_checks_list', {
      p_warehouse_id: warehouseId || null,
      p_search: search || null,      // Tìm kiếm (Mã, Note, Tên User)
      p_status: status || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize
    });

    if (error) throw error;
    
    // Ép kiểu về Interface mới
    return data as InventoryCheckSession[];
  },

  // 7. Tạo phiếu kiểm (Hỗ trợ lọc MANUFACTURER)
  async createCheckSession(params: {
    warehouseId: number, 
    note?: string,
    scope: 'ALL' | 'CATEGORY' | 'MANUFACTURER' | 'CABINET' | 'SUPPLIER', 
    textVal?: string, 
    intVal?: number
  }) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Chưa đăng nhập");

    const { data, error } = await supabase.rpc('create_inventory_check', {
      p_warehouse_id: params.warehouseId,
      p_user_id: user.user.id,
      p_note: params.note,
      p_scope: params.scope,
      p_text_val: params.textVal || null,
      p_int_val: params.intVal || null
    });

    if (error) throw error;
    return data;
  },

  // 8. Lấy danh sách Tủ/Kệ (Cho Dropdown Modal)
  async getCabinets(warehouseId: number) {
      const { data, error } = await supabase.rpc('get_warehouse_cabinets', {
          p_warehouse_id: warehouseId
      });
      if (error) throw error;
      return data.map((i: any) => i.cabinet_name);
  },

  // 9. Các hàm hỗ trợ lấy danh mục/Hãng SX (Unique & Not Null)
  async getCategories() {
      const { data } = await supabase
        .from('products')
        .select('category_name')
        .not('category_name', 'is', null);
      
      const uniqueCats = [...new Set(data?.map((i: any) => i.category_name))].filter(Boolean);
      return uniqueCats as string[];
  },

  async getManufacturers() {
      const { data } = await supabase
        .from('products')
        .select('manufacturer_name')
        .not('manufacturer_name', 'is', null);

      const uniqueMans = [...new Set(data?.map((i: any) => i.manufacturer_name))].filter(Boolean);
      return uniqueMans as string[];
  },

  async getDistributors() {
      const { data } = await supabase.from('distributors').select('id, name');
      return data || [];
  },

  // 10. Hủy phiếu
  async cancelCheck(checkId: number) {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Chưa đăng nhập");

      const { error } = await supabase.rpc('cancel_inventory_check', {
          p_check_id: checkId,
          p_user_id: user.user.id
      });
      if (error) throw error;
  },

  // 11. Lưu tạm
  async updateCheckInfo(checkId: number, note: string) {
      const { error } = await supabase.rpc('update_inventory_check_info', {
          p_check_id: checkId,
          p_note: note
      });
      if (error) throw error;
  },

  // 12. Lấy chi tiết phiếu (Header + Items với Join phức tạp)
  async getCheckSession(checkId: number) {
    const { data: session, error: sessError } = await supabase
      .from('inventory_checks')
      .select('*')
      .eq('id', checkId)
      .single();
    if (sessError) throw sessError;

    const { data: items, error: itemError } = await supabase
      .from('inventory_check_items')
      .select(`
        *,
        product:products (
            name, sku, image_url,
            units:product_units (unit_name, conversion_rate, is_base, is_direct_sale)
        )
      `)
      .eq('check_id', checkId)
      .order('location_snapshot', { ascending: true });
    if (itemError) throw itemError;

    // Map dữ liệu Hộp/Lẻ
    const formattedItems: InventoryCheckItem[] = items.map((i: any) => {
        const units = i.product?.units || [];
        const baseUnitObj = units.find((u: any) => u.is_base) || units.find((u: any) => u.conversion_rate === 1);
        const largeUnitObj = units.filter((u: any) => u.conversion_rate > 1).sort((a: any, b: any) => b.conversion_rate - a.conversion_rate)[0];

        return {
            id: i.id,
            check_id: i.check_id,
            product_id: i.product_id,
            product_name: i.product?.name || 'Sản phẩm ẩn',
            sku: i.product?.sku || '',
            image_url: i.product?.image_url,
            unit: baseUnitObj?.unit_name || 'Đv',
            large_unit: largeUnitObj?.unit_name || 'Hộp',
            retail_unit_rate: largeUnitObj?.conversion_rate || 1,
            batch_code: i.batch_code,
            expiry_date: i.expiry_date,
            system_quantity: i.system_quantity,
            actual_quantity: i.actual_quantity,
            cost_price: i.cost_price,
            location_snapshot: i.location_snapshot,
            diff_quantity: i.actual_quantity - i.system_quantity
        };
    });
    return { session, items: formattedItems };
  },

  // 13. Cập nhật số lượng kiểm kê
  async updateCheckItemQty(itemId: number, actualQty: number) {
    const { error } = await supabase.from('inventory_check_items').update({ actual_quantity: actualQty }).eq('id', itemId);
    if (error) throw error;
  },

  // 14. Hoàn tất kiểm kho
  async completeCheck(checkId: number, userId: string) {
    const { error } = await supabase.rpc('complete_inventory_check', { p_check_id: checkId, p_user_id: userId });
    if (error) throw error;
  }
};
// src/services/warehouseService.ts
import { supabase } from "@/lib/supabaseClient";
import { WarehouseFilters } from "@/types/warehouse";

// 1. CỖ MÁY API: ĐỌC DANH SÁCH (Đã nâng cấp)
export const getWarehouses = async (
  filters: WarehouseFilters,
  page: number,
  pageSize: number
) => {
  let query = supabase.from("warehouses").select("*", { count: "exact" }); // 'exact' để lấy totalCount

  // Lọc tìm kiếm
  if (filters.search_query) {
    query = query.or(
      `name.ilike.%${filters.search_query}%,` +
        `code.ilike.%${filters.search_query}%,` +
        `phone.ilike.%${filters.search_query}%`
    );
  }
  // Lọc loại kho
  if (filters.type_filter) {
    query = query.eq("type", filters.type_filter);
  }
  // Lọc trạng thái
  if (filters.status_filter) {
    query = query.eq("status", filters.status_filter);
  }

  // Phân trang
  const { data, error, count } = await query
    .order("id", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) {
    console.error("Lỗi khi tải Kho hàng:", error);
    throw error;
  }
  return { data: data || [], totalCount: count || 0 };
};

// 2. CỖ MÁY API: TẠO MỚI
export const addWarehouse = async (values: any) => {
  const { error } = await supabase.from("warehouses").insert({
    name: values.name,
    code: values.code || null,
    type: values.type,
    manager: values.manager || null,
    phone: values.phone || null,
    address: values.address || null,
    latitude: values.latitude || null,
    longitude: values.longitude || null,
    status: values.status,
    key: values.name.toLowerCase().replace(/\s+/g, "_"), // Tạm tạo key
  });
  if (error) throw error;
  return true;
};

// 3. CỖ MÁY API: CẬP NHẬT
export const updateWarehouse = async (id: number, values: any) => {
  const { error } = await supabase
    .from("warehouses")
    .update({
      name: values.name,
      code: values.code || null,
      type: values.type,
      manager: values.manager || null,
      phone: values.phone || null,
      address: values.address || null,
      latitude: values.latitude || null,
      longitude: values.longitude || null,
      status: values.status,
    })
    .eq("id", id);
  if (error) throw error;
  return true;
};

// 4. CỖ MÁY API: XÓA
export const deleteWarehouse = async (id: number) => {
  const { error } = await supabase.from("warehouses").delete().eq("id", id);
  if (error) throw error;
  return true;
};

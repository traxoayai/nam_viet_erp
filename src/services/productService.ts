// src/services/productService.ts
import { supabase } from "@/lib/supabaseClient";
import { ProductFilters } from "@/types/product";

interface FetchParams {
  filters: ProductFilters;
  page: number;
  pageSize: number;
}

export const getProducts = async ({ filters, page, pageSize }: FetchParams) => {
  // Gọi "cỗ máy" RPC Sếp đã tạo trong SQL
  const { data, error } = await supabase.rpc("get_products_list", {
    search_query: filters.search_query || null,
    category_filter: filters.category_filter || null,
    manufacturer_filter: filters.manufacturer_filter || null,
    status_filter: filters.status_filter || null,
    page_num: page,
    page_size: pageSize,
  });

  if (error) {
    console.error("Lỗi khi gọi RPC get_products_list:", error);
    throw error;
  }

  // Lấy tổng số lượng (total_count) từ bản ghi đầu tiên (nếu có)
  const totalCount = data && data.length > 0 ? data[0].total_count : 0;

  return { data: data || [], totalCount };
};

export const addProduct = async (formValues: any) => {
  // 1. Chuẩn bị dữ liệu
  const params = {
    p_name: formValues.productName,
    p_sku: formValues.sku,
    p_barcode: formValues.barcode,
    p_active_ingredient: formValues.tags, // Tạm dùng 'tags' cho 'hoạt chất'
    p_image_url: formValues.imageUrl || null, // Sẽ lấy từ state
    p_category_name: formValues.category,
    p_manufacturer_name: formValues.manufacturer,
    p_status: "active", // Mặc định

    // Giá & Kinh doanh
    p_invoice_price: formValues.invoicePrice,
    p_actual_cost: formValues.actualCost,
    p_wholesale_unit: formValues.wholesaleUnit,
    p_retail_unit: formValues.retailUnit,
    p_conversion_factor: formValues.conversionFactor,
    p_wholesale_margin_value: formValues.wholesaleMarginValue,
    p_wholesale_margin_type: formValues.wholesaleMarginType,
    p_retail_margin_value: formValues.retailMarginValue,
    p_retail_margin_type: formValues.retailMarginType,

    // Cài đặt tồn kho (JSON)
    p_inventory_settings: formValues.inventorySettings || {},
  };

  // 2. Gọi "cỗ máy" RPC
  const { data, error } = await supabase.rpc(
    "create_product_with_details",
    params
  );

  if (error) {
    console.error("Lỗi khi tạo sản phẩm:", error);
    throw error;
  }

  return data; // Trả về ID sản phẩm mới
};

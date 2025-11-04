// src/services/productService.ts
import { supabase } from "@/lib/supabaseClient";
import { ProductFilters } from "@/types/product";

interface FetchParams {
  filters: ProductFilters;
  page: number;
  pageSize: number;
}

// Hàm Đọc (Đã cập nhật)
export const getProducts = async ({ filters, page, pageSize }: FetchParams) => {
  const { data, error, count } = await supabase.rpc("get_products_list", {
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
  const totalCount = data && data.length > 0 ? data[0].total_count : 0;
  return { data: data || [], totalCount };
};

// Hàm Tạo (Đã cập nhật)
export const addProduct = async (formValues: any) => {
  const params = {
    p_name: formValues.productName,
    p_sku: formValues.sku || null,
    p_barcode: formValues.barcode || null,
    p_active_ingredient: formValues.tags || null,
    p_image_url: formValues.imageUrl || null,
    p_category_name: formValues.category || null,
    p_manufacturer_name: formValues.manufacturer || null,
    p_distributor_id: formValues.distributor || null, // Đã đổi
    p_status: "active",
    p_invoice_price: formValues.invoicePrice || 0,
    p_actual_cost: formValues.actualCost || 0,
    p_wholesale_unit: formValues.wholesaleUnit || "Hộp",
    p_retail_unit: formValues.retailUnit || "Vỉ",
    p_conversion_factor: formValues.conversionFactor || 1,
    p_wholesale_margin_value: formValues.wholesaleMarginValue || 0,
    p_wholesale_margin_type: formValues.wholesaleMarginType || "%",
    p_retail_margin_value: formValues.retailMarginValue || 0,
    p_retail_margin_type: formValues.retailMarginType || "%",
    p_inventory_settings: formValues.inventorySettings || {},
  };

  console.log("Tham số ĐÃ CHUẨN HÓA gửi đi:", params); // Log để Sếp kiểm tra

  const { data, error } = await supabase.rpc("create_product", params); // Đổi tên hàm RPC

  if (error) {
    console.error("Lỗi khi tạo sản phẩm:", error);
    throw error;
  }
  return data;
};

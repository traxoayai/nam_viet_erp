// src/services/productService.ts
import { v4 as uuidv4 } from "uuid"; // Import UUID

import { supabase } from "@/lib/supabaseClient";
import { ProductFilters } from "@/types/product";

interface FetchParams {
  filters: ProductFilters;
  page: number;
  pageSize: number;
}

// 1. HÀM ĐỌC DANH SÁCH (Phân trang)
export const getProducts = async ({ filters, page, pageSize }: FetchParams) => {
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
  const totalCount = data && data.length > 0 ? data[0].total_count : 0;
  return { data: data || [], totalCount };
};

// 2. HÀM ĐỌC CHI TIẾT (CHO FORM SỬA)
export const getProductDetails = async (id: number) => {
  const { data, error } = await supabase.rpc("get_product_details", {
    p_id: id,
  });
  if (error) {
    console.error("Lỗi khi tải chi tiết sản phẩm:", error);
    throw error;
  }
  return data;
};

// 3. HÀM TẠO MỚI SẢN PHẨM
export const addProduct = async (formValues: any) => {
  const params = {
    p_name: formValues.productName,
    p_sku: formValues.sku || null,
    p_barcode: formValues.barcode || null,
    p_active_ingredient: formValues.tags || null,
    p_image_url: formValues.imageUrl || null,
    p_category_name: formValues.category || null,
    p_manufacturer_name: formValues.manufacturer || null,
    p_distributor_id: formValues.distributor || null,
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

  const { data, error } = await supabase.rpc("create_product", params);

  if (error) {
    console.error("Lỗi khi tạo sản phẩm:", error);
    throw error;
  }
  return data;
};

// 4. HÀM CẬP NHẬT SẢN PHẨM (CHO FORM SỬA)
export const updateProduct = async (id: number, formValues: any) => {
  const params = {
    p_id: id,
    p_name: formValues.productName,
    p_sku: formValues.sku || null,
    p_barcode: formValues.barcode || null,
    p_active_ingredient: formValues.tags || null,
    p_image_url: formValues.imageUrl || null,
    p_category_name: formValues.category || null,
    p_manufacturer_name: formValues.manufacturer || null,
    p_distributor_id: formValues.distributor || null,
    p_status: formValues.status || "active",
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

  const { error } = await supabase.rpc("update_product", params);

  if (error) {
    console.error("Lỗi khi cập nhật sản phẩm:", error);
    throw error;
  }
  return true;
};

// 5. HÀM CẬP NHẬT TRẠNG THÁI (HÀNG LOẠT)
export const updateProductsStatus = async (
  ids: React.Key[],
  status: "active" | "inactive"
) => {
  const { error } = await supabase.rpc("update_product_status", {
    p_ids: ids as number[],
    p_status: status,
  });
  if (error) {
    console.error("Lỗi khi cập nhật trạng thái:", error);
    throw error;
  }
  return true;
};

// 6. HÀM XÓA SẢN PHẨM (HÀNG LOẠT)
export const deleteProducts = async (ids: React.Key[]) => {
  const { error } = await supabase.rpc("delete_products", {
    p_ids: ids as number[],
  });
  if (error) {
    console.error("Lỗi khi xóa sản phẩm:", error);
    throw error;
  }
  return true;
};

// 7. HÀM XUẤT EXCEL (GỌI RPC MỚI)
export const exportProducts = async (filters: ProductFilters) => {
  const { data, error } = await supabase.rpc("export_products_list", {
    search_query: filters.search_query || null,
    category_filter: filters.category_filter || null,
    manufacturer_filter: filters.manufacturer_filter || null,
    status_filter: filters.status_filter || null,
  });

  if (error) {
    console.error("Lỗi khi xuất excel:", error);
    throw error;
  }
  return data || [];
};

// 8. HÀM TẢI ẢNH (TỪ storageService.ts)
// (Em di chuyển luôn vào đây cho tiện quản lý)
export const uploadProductImage = async (file: File) => {
  const bucket = "product_images";
  const fileExt = file.name.split(".").pop();
  const fileName = `${uuidv4()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, file);

  if (uploadError) {
    console.error("Lỗi tải ảnh:", uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);

  return data.publicUrl;
};

// 9. HÀM NHẬP EXCEL (TẠM THỜI)
export const importProducts = async (file: File) => {
  // (SENKO: Logic này rất phức tạp, cần 1 API microservice trên Cloud Run
  // để đọc file Excel và gọi Upsert. Tạm thời Em sẽ mô phỏng.)
  console.log("File to import:", file.name);
  return new Promise((resolve) => setTimeout(resolve, 1000));
};

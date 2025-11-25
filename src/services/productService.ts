// src/services/productService.ts
import { v4 as uuidv4 } from "uuid";
import * as XLSX from "xlsx";

import { supabase } from "@/lib/supabaseClient";
import { ProductFilters } from "@/types/product";

interface FetchParams {
  filters: ProductFilters;
  page: number;
  pageSize: number;
}

// 1. HÀM ĐỌC DANH SÁCH
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
    console.error("Lỗi RPC get_products_list:", error);
    throw error;
  }
  const totalCount = data && data.length > 0 ? data[0].total_count : 0;
  return { data: data || [], totalCount };
};

// 2. HÀM ĐỌC CHI TIẾT (ĐÃ FIX MAPPING DỮ LIỆU)
export const getProductDetails = async (id: number) => {
  // A. Lấy thông tin sản phẩm từ bảng products
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Lỗi tải chi tiết sản phẩm:", error);
    throw error;
  }

  // B. Lấy thông tin tồn kho chi tiết (Min/Max) từ bảng product_inventory
  const { data: inventoryData } = await supabase
    .from("product_inventory")
    .select(
      "stock_quantity, min_stock, max_stock, warehouse_id, warehouses(key)"
    )
    .eq("product_id", id);

  // C. Chuyển đổi cấu trúc Tồn kho DB -> Form
  // DB trả về mảng -> Form cần object: { "kho_b2b": { min: 10, max: 20 } }
  const inventorySettings: Record<string, any> = {};
  if (inventoryData) {
    inventoryData.forEach((inv: any) => {
      if (inv.warehouses && inv.warehouses.key) {
        inventorySettings[inv.warehouses.key] = {
          min: inv.min_stock,
          max: inv.max_stock,
        };
      }
    });
  }

  // D. MAP DỮ LIỆU DB (Snake_case) -> FORM (CamelCase)
  return {
    ...data,
    productName: data.name,
    category: data.category_name,
    manufacturer: data.manufacturer_name,
    distributor: data.distributor_id,
    imageUrl: data.image_url,

    // Giá & Đơn vị
    invoicePrice: data.invoice_price,
    actualCost: data.actual_cost,
    wholesaleUnit: data.wholesale_unit,
    retailUnit: data.retail_unit,
    conversionFactor: data.conversion_factor,
    wholesaleMarginValue: data.wholesale_margin_value,
    wholesaleMarginType: data.wholesale_margin_type,
    retailMarginValue: data.retail_margin_value,
    retailMarginType: data.retail_margin_type,
    estimatedWholesalePrice: 0, // Sẽ được tính lại bởi Form
    estimatedRetailPrice: 0, // Sẽ được tính lại bởi Form

    // Thông tin bổ sung (FIX LỖI KHÔNG HIỂN THỊ)
    description: data.description,
    registrationNumber: data.registration_number, // Map snake_case -> camelCase
    packingSpec: data.packing_spec, // Map snake_case -> camelCase
    tags: data.active_ingredient, // Map tags

    // Logistics
    items_per_carton: data.items_per_carton,
    carton_weight: data.carton_weight,
    purchasing_policy: data.purchasing_policy,
    carton_dimensions: data.carton_dimensions,

    // Tồn kho
    inventorySettings: inventorySettings,
  };
};

// 3. HÀM TẠO MỚI SẢN PHẨM (ĐÃ BỔ SUNG THAM SỐ THIẾU)
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

    // Logistics
    p_items_per_carton: formValues.items_per_carton || 1,
    p_carton_weight: formValues.carton_weight || 0,
    p_carton_dimensions: formValues.carton_dimensions || null,
    p_purchasing_policy: formValues.purchasing_policy || "ALLOW_LOOSE",

    // --- CÁC TRƯỜNG MỚI BỔ SUNG (THEO YÊU CẦU CORE) ---
    p_description: formValues.description || null,
    p_registration_number: formValues.registrationNumber || null,
    p_packing_spec: formValues.packingSpec || null,

    // Tồn kho
    p_inventory_settings: formValues.inventorySettings || {},
  };

  const { data, error } = await supabase.rpc("create_product", params);
  if (error) {
    console.error("Lỗi create_product:", error);
    throw error;
  }
  return data;
};

// 4. HÀM CẬP NHẬT SẢN PHẨM (ĐÃ BỔ SUNG THAM SỐ THIẾU)
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

    p_invoice_price: formValues.invoicePrice,
    p_actual_cost: formValues.actualCost,
    p_wholesale_unit: formValues.wholesaleUnit,
    p_retail_unit: formValues.retailUnit,
    p_conversion_factor: formValues.conversionFactor,
    p_wholesale_margin_value: formValues.wholesaleMarginValue,
    p_wholesale_margin_type: formValues.wholesaleMarginType,
    p_retail_margin_value: formValues.retailMarginValue,
    p_retail_margin_type: formValues.retailMarginType,

    // Logistics
    p_items_per_carton: formValues.items_per_carton,
    p_carton_weight: formValues.carton_weight,
    p_carton_dimensions: formValues.carton_dimensions,
    p_purchasing_policy: formValues.purchasing_policy,

    // --- CÁC TRƯỜNG MỚI BỔ SUNG ---
    p_description: formValues.description || null,
    p_registration_number: formValues.registrationNumber || null,
    p_packing_spec: formValues.packingSpec || null,

    p_inventory_settings: formValues.inventorySettings || {},
  };

  const { error } = await supabase.rpc("update_product", params);
  if (error) {
    console.error("Lỗi update_product:", error);
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

// 7. HÀM XUẤT EXCEL
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

// 8. HÀM TẢI ẢNH
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

// 9. HÀM NHẬP EXCEL
export const importProducts = async (file: File) => {
  return new Promise(async (resolve, reject) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonArray: any[] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
      });

      const headers: string[] = jsonArray[0] as string[];
      const rawProducts = jsonArray.slice(1);

      const { data: warehouses } = await supabase
        .from("warehouses")
        .select("key, id");
      const safeWarehouses = warehouses || [];
      const warehouseKeys = safeWarehouses.map((w) => w.key);

      const productsToUpsert = rawProducts.map((row: any[]) => {
        const product: any = { inventory_settings: {} };
        row.forEach((value, index) => {
          const header = headers[index];
          if (warehouseKeys.includes(header)) {
            product.inventory_settings[header] = value;
          } else {
            product[header] = value;
          }
        });
        return product;
      });

      const { error: rpcError } = await supabase.rpc("bulk_upsert_products", {
        p_products_array: productsToUpsert,
      });

      if (rpcError) throw rpcError;
      resolve(productsToUpsert.length);
    } catch (error) {
      console.error("Import Error:", error);
      reject(error);
    }
  });
};

// 10. HÀM TÌM KIẾM ĐA NĂNG
export const searchProductsForDropdown = async (
  keyword: string,
  types: string[] = ["service", "bundle"]
) => {
  const searchTerm = keyword?.trim().toLowerCase() || "";
  const validServiceTypes = types.filter((t) =>
    ["service", "bundle"].includes(t)
  );

  const queries = [];

  if (types.includes("product") || types.length === 0) {
    let productQuery = supabase
      .from("products")
      .select("id, name, sku, retail_unit, actual_cost, image_url")
      .eq("status", "active")
      .limit(20);

    if (searchTerm) {
      productQuery = productQuery.or(
        `name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`
      );
    } else {
      productQuery = productQuery.order("created_at", { ascending: false });
    }
    queries.push(productQuery.then((res) => ({ type: "product", res })));
  }

  if (validServiceTypes.length > 0) {
    let serviceQuery = supabase
      .from("service_packages")
      .select("id, name, sku, unit, total_cost_price, price, type, created_at")
      .in("type", validServiceTypes)
      .eq("status", "active")
      .limit(20);

    if (searchTerm) {
      serviceQuery = serviceQuery.or(
        `name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`
      );
    } else {
      serviceQuery = serviceQuery.order("created_at", { ascending: false });
    }
    queries.push(serviceQuery.then((res) => ({ type: "service", res })));
  }

  const results = await Promise.all(queries);
  const prodRes = results.find((r) => r.type === "product")?.res;
  const svcRes = results.find((r) => r.type === "service")?.res;

  const products = (prodRes?.data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    unit: p.retail_unit,
    price: p.actual_cost,
    retail_price: 0,
    image: p.image_url,
    type: "product",
  }));

  const services = (svcRes?.data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    sku: s.sku,
    unit: s.unit,
    price: s.total_cost_price,
    retail_price: s.price,
    image: null,
    type: s.type,
  }));

  return [...services, ...products];
};

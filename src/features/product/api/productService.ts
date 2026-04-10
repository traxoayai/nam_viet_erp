// src/features/product/api/productService.ts
import { v4 as uuidv4 } from "uuid";
import * as XLSX from "xlsx";

import { ProductFilters } from "@/features/product/types/product.types";
import { safeRpc } from "@/shared/lib/safeRpc";
import { supabase } from "@/shared/lib/supabaseClient";

interface FetchParams {
  filters: ProductFilters;
  page: number;
  pageSize: number;
}

// 1. HÀM ĐỌC DANH SÁCH (SMART SEARCH V2)
export const getProducts = async ({ filters, page, pageSize }: FetchParams) => {
  const { data } = await safeRpc("search_products_v2", {
    p_keyword: filters.search_query ?? undefined,
    p_category: filters.category_filter ?? undefined,
    p_manufacturer: filters.manufacturer_filter ?? undefined,
    p_status: filters.status_filter ?? undefined,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });

  // search_products_v2 trả về { data: [...], total_count: number }
  const result = data as unknown as { data: unknown[]; total_count: number } | null;
  return {
    data: result?.data || [],
    totalCount: result?.total_count || 0,
  };
};

// 2. HÀM ĐỌC CHI TIẾT
export const getProductDetails = async (id: number) => {
  // A. Lấy thông tin sản phẩm từ bảng products (Kèm Units và Contents)
  const { data, error } = await supabase
    .from("products")
    .select("*, product_units(*), product_contents(*)")
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
      "stock_quantity, min_stock, max_stock, shelf_location, location_cabinet, location_row, location_slot, warehouse_id, warehouses(key)"
    )
    .eq("product_id", id);

  // C. Chuyển đổi cấu trúc Tồn kho DB -> Form
  const inventorySettings: Record<string, unknown> = {};
  if (inventoryData) {
    inventoryData.forEach((inv: Record<string, unknown>) => {
      const wh = inv.warehouses as Record<string, unknown> | null;
      if (wh && wh.key) {
        inventorySettings[wh.key as string] = {
          warehouse_id: inv.warehouse_id,
          min: inv.min_stock,
          max: inv.max_stock,
          shelf_location: inv.shelf_location,
          location_cabinet: inv.location_cabinet,
          location_row: inv.location_row,
          location_slot: inv.location_slot,
        };
      }
    });
  }

  // [FIX] Lấy dữ liệu Marketing (Tìm bản ghi channel='website')
  const marketingData =
    data.product_contents && data.product_contents.length > 0
      ? (data.product_contents.find((c) => c.channel === "website") as Record<string, unknown> | undefined) ?? {}
      : {} as Record<string, unknown>;

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
    estimatedWholesalePrice: 0,
    estimatedRetailPrice: 0,

    // Thông tin bổ sung
    description: data.description,
    registrationNumber: data.registration_number,
    packingSpec: data.packing_spec,
    tags: data.active_ingredient,

    // [FIX] Map Usage Instructions (Đảm bảo luôn có object để Form bind dữ liệu)
    usageInstructions: data.usage_instructions || {
      "0_2": "",
      "2_6": "",
      "6_12": "",
      "18_plus": "",
      contraindication: "",
    },

    // Logistics
    items_per_carton: data.items_per_carton,
    carton_weight: data.carton_weight,
    purchasing_policy: data.purchasing_policy,
    carton_dimensions: data.carton_dimensions,

    // Tồn kho
    inventorySettings: inventorySettings,

    // Units
    units: data.product_units || [],

    // [FIX] Map Marketing Content vào object content
    content: {
      description_html: (marketingData as Record<string, unknown>).description_html || "",
      short_description: (marketingData as Record<string, unknown>).short_description || "",
      seo_title: (marketingData as Record<string, unknown>).seo_title || "",
      seo_description: (marketingData as Record<string, unknown>).seo_description || "",
      seo_keywords: (marketingData as Record<string, unknown>).seo_keywords || [],
    },
  };
};

// 3. HÀM TẠO MỚI & CẬP NHẬT (Unified Upsert RPC V7)
export const upsertProduct = async (formValues: any) => {
  console.log("🚀 Starting upsertProduct (V7) with payload:", formValues);

  // 1. CHUẨN BỊ PAYLOAD PRODUCT (Tham số 1)
  const productJson = {
    id: formValues.id,
    sku: formValues.sku,
    name: formValues.productName,
    barcode: formValues.barcode,
    registration_number: formValues.registrationNumber,
    manufacturer_name: formValues.manufacturer,
    category_name: formValues.category,
    packing_spec: formValues.packingSpec,
    active_ingredient: formValues.tags,
    status: formValues.status || "active",
    image_url: formValues.image_url || formValues.imageUrl || null,

    // [FIX] Thêm distributor_id (Quan trọng)
    distributor_id: formValues.distributor || null,

    // Financials (V7 - Auto Pricing)
    actual_cost: formValues.actualCost || 0,
    wholesale_margin_value: formValues.wholesaleMarginValue || 0,
    wholesale_margin_type: formValues.wholesaleMarginType || "amount",
    retail_margin_value: formValues.retailMarginValue || 0,
    retail_margin_type: formValues.retailMarginType || "amount",

    // Logistics
    items_per_carton: formValues.items_per_carton || 1,
    carton_weight: formValues.carton_weight || 0,
    carton_dimensions: formValues.carton_dimensions || null,
    purchasing_policy: formValues.purchasing_policy || "ALLOW_LOOSE",

    // Usage Instructions (JSON)
    usage_instructions: formValues.usageInstructions || {
      "0_2": formValues.usage_0_2 || "",
      "2_6": formValues.usage_2_6 || "",
      "6_12": formValues.usage_6_12 || "",
      "18_plus": formValues.usage_18_plus || "",
      contraindication: formValues.usage_contraindication || "",
    },
  };

  // 2. CHUẨN BỊ PAYLOAD UNITS (Tham số 2)
  const unitsJson = (formValues.units || []).map((u: any) => ({
    id: u.id,
    unit_name: u.unit_name,
    unit_type: u.unit_type,
    conversion_rate: u.conversion_rate,
    price: u.price, // Nếu = 0 -> Backend tự tính theo Margin
    barcode: u.barcode,
    is_base: u.is_base,
    is_direct_sale: u.is_direct_sale,
  }));

  // Handle Legacy implicit unit logic (Optional - Keep for safety)
  if (formValues.retailUnit && !unitsJson.some((u: any) => u.is_base)) {
    unitsJson.push({
      unit_name: formValues.retailUnit,
      conversion_rate: 1,
      unit_type: "base",
      price: formValues.actualCost, // Base price
      is_base: true,
      is_direct_sale: true,
    });
  }

  // 3. CHUẨN BỊ PAYLOAD CONTENT (Tham số 3 - Marketing)
  const contentsJson = {
    description_html: formValues.content?.description_html,
    short_description: formValues.content?.short_description,
    seo_title: formValues.content?.seo_title,
    seo_description: formValues.content?.seo_description,
    seo_keywords: formValues.content?.seo_keywords || [],
    is_published: true,
  };

  // 4. CHUẨN BỊ PAYLOAD INVENTORY (Tham số 4 - Cấu hình kho)
  let inventoryJson = formValues.inventorySettings || [];

  // Transformation Logic: Object -> Array (nếu client gửi dạng Map)
  if (!Array.isArray(inventoryJson) && typeof inventoryJson === "object") {
    inventoryJson = Object.values(inventoryJson)
      .map((item: any) => {
        if (!item.warehouse_id) return null;
        return {
          warehouse_id: item.warehouse_id,
          min_stock: item.min,
          max_stock: item.max,
          shelf_location: item.shelf_location,
          location_cabinet: item.location_cabinet,
          location_row: item.location_row,
          location_slot: item.location_slot,
        };
      })
      .filter(Boolean);
  }

  // 5. GỌI RPC V7 (upsert_product_with_units)
  const { data } = await safeRpc("upsert_product_with_units", {
    p_product_json: productJson,
    p_units_json: unitsJson,
    p_contents_json: contentsJson,
    p_inventory_json: inventoryJson,
  });

  return data;
};

// Wrapper backward compatibility
export const addProduct = async (
  formValues: any,
  inventoryPayload: any[] = []
) => {
  if (inventoryPayload && inventoryPayload.length > 0) {
    formValues.inventorySettings = inventoryPayload;
  }
  return upsertProduct(formValues);
};

export const updateProduct = async (
  id: number,
  formValues: any,
  inventoryPayload: any[] = []
) => {
  formValues.id = id;
  if (inventoryPayload && inventoryPayload.length > 0) {
    formValues.inventorySettings = inventoryPayload;
  }
  await upsertProduct(formValues);
  return true;
};

// 5. HÀM CẬP NHẬT TRẠNG THÁI (HÀNG LOẠT)
export const updateProductsStatus = async (
  ids: React.Key[],
  status: "active" | "inactive"
) => {
  const { error } = await supabase
    .from("products")
    .update({ status: status })
    .in("id", ids as number[]);

  if (error) {
    console.error("Lỗi khi cập nhật trạng thái:", error);
    throw error;
  }
  return true;
};

// 6. CHECK DEPENDENCIES (Safe Delete Check)
export const checkDependencies = async (ids: React.Key[]) => {
  const { data } = await safeRpc("check_product_dependencies", {
    p_product_ids: ids as number[],
  });
  return data || [];
};

// 7. HÀM XÓA SẢN PHẨM (SOFT DELETE)
export const deleteProducts = async (ids: React.Key[]) => {
  const { error } = await supabase
    .from("products")
    .update({ status: "deleted" })
    .in("id", ids as number[]);

  if (error) {
    console.error("Lỗi khi xóa sản phẩm (Soft Delete):", error);
    throw error;
  }
  return true;
};

// 8. HÀM XUẤT EXCEL
export const exportProducts = async (filters: ProductFilters) => {
  const { data } = await safeRpc("export_products_list", {
    search_query: filters.search_query || "",
    category_filter: filters.category_filter || "",
    manufacturer_filter: filters.manufacturer_filter || "",
    status_filter: filters.status_filter || "",
  });
  return data || [];
};

// 9. HÀM Upload ẢNH
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

// 10. HÀM NHẬP EXCEL
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
      const warehouseKeys: string[] = safeWarehouses.map((w) => w.key);

      const productsToUpsert = rawProducts.map((row: unknown[]) => {
        const product: Record<string, unknown> = { inventory_settings: {} };
        row.forEach((value, index) => {
          const header = headers[index];
          if (warehouseKeys.includes(header)) {
            (product.inventory_settings as Record<string, unknown>)[header] = value;
          } else {
            product[header] = value;
          }
        });
        return product;
      });

      await safeRpc("bulk_upsert_products", {
        p_products_array: productsToUpsert as unknown as import("@/shared/lib/database.types").Json,
      });
      resolve(productsToUpsert.length);
    } catch (error) {
      console.error("Import Error:", error);
      reject(error);
    }
  });
};

// 11. HÀM TÌM KIẾM ĐA NĂNG (CHO DROPDOWN)
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
      .in("type", validServiceTypes as ("service" | "bundle")[])
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

// 12. HÀM TÌM KIẾM CHUYÊN BIỆT CHO MUA HÀNG
export const searchProductsForPurchase = async (keyword: string) => {
  const { data } = await safeRpc("search_products_for_purchase", {
    p_keyword: keyword || "",
  });

  const items = (data || []) as Record<string, unknown>[];
  return items.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    unit: p.wholesale_unit || "Hộp",
    price: p.actual_cost,
    retail_price: 0,
    image: p.image_url,
    type: "product",
    items_per_carton: p.items_per_carton,
    wholesale_unit: p.wholesale_unit,
    retail_unit: p.retail_unit,
    last_price: p.latest_purchase_price,
    total_stock: p.total_stock,
    avg_monthly_sold: p.avg_monthly_sold,
  }));
};

// 13. HÀM LẤY TOÀN BỘ SẢN PHẨM được phân trang Server-side Pagination

export const getAllProductsLite = async (
  page: number = 1,
  pageSize: number = 20
) => {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("products")
    .select(
      `
        id, name, sku, barcode, image_url, status,
        wholesale_unit, retail_unit, actual_cost, items_per_carton,
        product_units(id, unit_name, conversion_rate, unit_type, is_base),
        product_inventory(warehouse_id, min_stock, max_stock)
    `,
      { count: "exact" }
    ) // [NEW] Yêu cầu đếm tổng số
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(from, to); // [NEW] Chỉ lấy trong khoảng này

  if (error) {
    console.error("Lỗi getAllProductsLite:", error.message);
    return { data: [], total: 0 };
  }
  return { data: data || [], total: count || 0 };
  if (error) {
    console.error("Lỗi getAllProductsLite:", error?.message);
    return { data: [], total: 0 };
  }
  return { data: data || [], total: count || 0 };
};

// 14. HÀM TÌM KIẾM CHUYÊN BIỆT CHO CHUYỂN KHO (Có tồn kho & Đơn vị)
export const searchProductsForTransfer = async (
  keyword: string,
  warehouseId: number
) => {
  // Gọi RPC V32.3 Final của Core
  const { data } = await safeRpc("search_products_for_transfer", {
    p_warehouse_id: warehouseId,
    p_keyword: keyword,
    p_limit: 20,
  });
  return data || [];
};

// 15. [NEW] CẬP NHẬT GIÁ BÁN (Bulk Update - V35.6)
// 15. [NEW] CẬP NHẬT GIÁ BÁN (Bulk Update - V35.6)
export const updateProductPrices = async (
  updates: { id: number; price: number }[]
) => {
  if (!updates || updates.length === 0) return { success: true, count: 0 };

  // Sử dụng Promise.all để chạy song song (vì số lượng ít)
  // Nếu số lượng lớn cần dùng RPC hoặc chunk
  try {
    const promises = updates.map(
      (u) =>
        supabase
          .from("product_units")
          .update({
            price: u.price, // Cột cũ
            price_sell: u.price, // Cột mới (Update cả 2 để đồng bộ)
            updated_at: new Date().toISOString(),
          })
          .eq("id", u.id)
          .select() // Quan trọng: Return data để kiểm tra có update thật không
    );

    const results = await Promise.all(promises);

    // Đếm số dòng thực sự được update (data not null)
    const successCount = results.filter(
      (r) => r.data && r.data.length > 0
    ).length;

    if (successCount < updates.length) {
      console.warn(
        `Chỉ update được ${successCount}/${updates.length} dòng. Có thể do lỗi quyền (RLS).`
      );
    }

    return { success: true, count: successCount };
  } catch (err) {
    console.error("Lỗi cập nhật giá bán:", err);
    throw err;
  }
};

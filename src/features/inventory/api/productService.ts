// src/services/productService.ts
import { v4 as uuidv4 } from "uuid";
import * as XLSX from "xlsx";

import { supabase } from "@/shared/lib/supabaseClient";
import { ProductFilters } from "@/features/inventory/types/product";

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

// 2. HÀM ĐỌC CHI TIẾT
export const getProductDetails = async (id: number) => {
  // A. Lấy thông tin sản phẩm từ bảng products
  const { data, error } = await supabase
    .from("products")
    .select("*, product_units(*)")
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

    // Thông tin bổ sung
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
    // Tồn kho
    inventorySettings: inventorySettings,
    
    // Units
    units: data.product_units || []
  };
};

// 3. HÀM TẠO MỚI SẢN PHẨM (ĐÃ BỔ SUNG THAM SỐ THIẾU)
export const addProduct = async (formValues: any, inventoryPayload: any[] = []) => {
  // 1. Construct Units Payload (Consolidate Base + Additional)
  const unitsPayload = [];
  
  // A. Handle Legacy/Implicit Base Unit (if passed from form via hidden field or migration)
  if (formValues.retailUnit) {
      unitsPayload.push({
          unit_name: formValues.retailUnit,
          conversion_rate: 1,
          unit_type: 'base',
          price: formValues.actualCost, // Base unit price = Cost (or retail price if defined)
          is_base: true,
          is_direct_sale: true
      });
  }
  
  // B. Handle Units from List
  const listUnits = (formValues.units || []).map((u: any) => ({
      unit_name: u.unit_name,
      conversion_rate: u.conversion_rate,
      barcode: u.barcode || null,
      unit_type: u.unit_type || 'wholesale',
      price: u.price || 0,
      is_base: u.unit_type === 'base',
      is_direct_sale: true
  }));
  unitsPayload.push(...listUnits);

  // 2. Construct Clean Product Payload
  const productPayload = {
    name: formValues.productName,
    sku: formValues.sku || null,
    barcode: formValues.barcode || null,
    active_ingredient: formValues.tags || null,
    image_url: formValues.imageUrl || null,
    category_name: formValues.category || null,
    manufacturer_name: formValues.manufacturer || null,
    distributor_id: formValues.distributor || null,
    status: "active",

    // Financials
    // Financials
    // invoice_price removed from header (Prices are in units now)
    actual_cost: formValues.actualCost || 0,
    wholesale_margin_value: formValues.wholesaleMarginValue || 0, 
    wholesale_margin_type: formValues.wholesaleMarginType || 'amount',
    retail_margin_value: formValues.retailMarginValue || 0,       
    retail_margin_type: formValues.retailMarginType || 'amount',
    
    // Legacy fields removed: wholesale_unit, retail_unit, conversion_factor, etc.

    // Logistics
    items_per_carton: formValues.items_per_carton || 1,
    carton_weight: formValues.carton_weight || 0,
    carton_dimensions: formValues.carton_dimensions || null,
    purchasing_policy: formValues.purchasing_policy || "ALLOW_LOOSE",

    // Desc
    description: formValues.description || null,
    registration_number: formValues.registrationNumber || null,
    packing_spec: formValues.packingSpec || null,
    inventory_settings: formValues.inventorySettings || {},
  };

  const { data, error } = await supabase.rpc("upsert_product_with_units", {
    p_product_json: productPayload,
    p_units_json: unitsPayload,
    p_inventory_json: inventoryPayload
  });

  if (error) {
    console.error("Lỗi upsert_product_with_units (Add):", error);
    throw error;
  }
  return data;
};

// 4. HÀM CẬP NHẬT SẢN PHẨM (ĐÃ BỔ SUNG THAM SỐ THIẾU)
export const updateProduct = async (id: number, formValues: any, inventoryPayload: any[] = []) => {
  // 1. Construct Units Payload
  const unitsPayload = [];
  
  if (formValues.retailUnit) {
      unitsPayload.push({
          unit_name: formValues.retailUnit,
          conversion_rate: 1,
          unit_type: 'base',
          price: formValues.actualCost,
          is_base: true,
          is_direct_sale: true
      });
  }

  const listUnits = (formValues.units || []).map((u: any) => ({
      id: u.id,
      unit_name: u.unit_name,
      conversion_rate: u.conversion_rate,
      barcode: u.barcode || null,
      unit_type: u.unit_type || 'wholesale',
      price: u.price || 0,
      is_base: u.unit_type === 'base',
      is_direct_sale: true
  }));
  unitsPayload.push(...listUnits);

  // 2. Construct Clean Product Payload
  const productPayload = {
    id: id,
    name: formValues.productName,
    sku: formValues.sku || null,
    barcode: formValues.barcode || null,
    active_ingredient: formValues.tags || null,
    image_url: formValues.imageUrl || null,
    category_name: formValues.category || null,
    manufacturer_name: formValues.manufacturer || null,
    distributor_id: formValues.distributor || null,
    status: formValues.status || "active",

    // invoice_price removed
    actual_cost: formValues.actualCost,
    wholesale_margin_value: formValues.wholesaleMarginValue, 
    wholesale_margin_type: formValues.wholesaleMarginType,
    retail_margin_value: formValues.retailMarginValue,       
    retail_margin_type: formValues.retailMarginType,
    
    // Logistics
    items_per_carton: formValues.items_per_carton,
    carton_weight: formValues.carton_weight,
    carton_dimensions: formValues.carton_dimensions,
    purchasing_policy: formValues.purchasing_policy,

    description: formValues.description || null,
    registration_number: formValues.registrationNumber || null,
    packing_spec: formValues.packingSpec || null,
    inventory_settings: formValues.inventorySettings || {},
  };

  const { error } = await supabase.rpc("upsert_product_with_units", {
    p_product_json: productPayload,
    p_units_json: unitsPayload,
    p_inventory_json: inventoryPayload
  });

  if (error) {
    console.error("Lỗi upsert_product_with_units (Update):", error);
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

// 8. HÀM Upload ẢNH
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

// 11. HÀM TÌM KIẾM CHUYÊN BIỆT CHO MUA HÀNG (Wholesale)
// Gọi RPC mới search_products_for_purchase của CORE
export const searchProductsForPurchase = async (keyword: string) => {
  const { data, error } = await supabase.rpc("search_products_for_purchase", {
    p_keyword: keyword || "",
  });

  if (error) {
    console.error("Lỗi tìm kiếm mua hàng:", error);
    return [];
  }

  // Map dữ liệu trả về chuẩn format cho Dropdown
  return data.map((p: any) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    // LOGIC QUAN TRỌNG: Mua hàng thì ưu tiên hiện Đơn vị Bán buôn
    unit: p.wholesale_unit || "Hộp",
    price: p.actual_cost, // Giá vốn hiện tại
    retail_price: 0,
    image: p.image_url,
    type: "product",

    // Dữ liệu gốc quan trọng để tính toán
    items_per_carton: p.items_per_carton,
    wholesale_unit: p.wholesale_unit,
    retail_unit: p.retail_unit,
    last_price: p.latest_purchase_price, // Giá nhập lần cuối (từ CORE)
  }));
};

// [NEW] 12. HÀM LẤY TOÀN BỘ SẢN PHẨM RÚT GỌN (CHO DROPDOWN & AI MATCHING)
export const getAllProductsLite = async () => {
  // Lấy tối đa 5000 sản phẩm active, chỉ lấy các trường cần thiết để nhẹ payload
  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, barcode, wholesale_unit, retail_unit, actual_cost, items_per_carton")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(5000); 

  if (error) {
    console.error("Lỗi getAllProductsLite:", error);
    return [];
  }
  return data || [];
};

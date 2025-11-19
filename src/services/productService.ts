// src/services/productService.ts
import { v4 as uuidv4 } from "uuid"; // Import UUID
import * as XLSX from "xlsx";

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

// 9. HÀM NHẬP EXCEL ((Bulk Import))
export const importProducts = async (file: File) => {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Đọc file Excel thành dữ liệu thô
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName]; // 2. Chuyển đổi dữ liệu thành mảng JSON
      const jsonArray: any[] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
      });

      const headers: string[] = jsonArray[0] as string[];
      const rawProducts = jsonArray.slice(1); // -- SỬA LỖI TẠI ĐÂY --
      // 3. Lấy danh sách kho an toàn (loại bỏ khả năng null)
      const { data: warehouses } = await supabase
        .from("warehouses")
        .select("key, id"); // Thêm kiểm tra: nếu warehouses là null, dùng mảng rỗng []
      const safeWarehouses = warehouses || [];
      const warehouseKeys = safeWarehouses.map((w) => w.key); // Không còn lỗi
      // 4. Format dữ liệu thành định dạng RPC mong muốn

      const productsToUpsert = rawProducts.map((row: any[]) => {
        const product: any = { inventory_settings: {} };
        row.forEach((value, index) => {
          const header = headers[index]; // Xử lý các cột tồn kho
          if (warehouseKeys.includes(header)) {
            product.inventory_settings[header] = value;
          } // Xử lý các cột sản phẩm
          else {
            product[header] = value;
          }
        });
        return product;
      }); // 5. Gửi mảng JSON đến hàm RPC

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

/**
 * 10. HÀM TÌM KIẾM ĐA NĂNG (Nâng cấp V2)
 * @param keyword Từ khóa tìm kiếm
 * @param types Mảng các loại dịch vụ cần tìm (vd: ['service'] hoặc ['service', 'bundle'])
 * Mặc định tìm tất cả nếu không truyền.
 */
export const searchProductsForDropdown = async (
  keyword: string,
  types: string[] = ["service", "bundle"] // Mặc định tìm cả Gói và Dịch vụ lẻ
) => {
  const searchTerm = keyword?.trim().toLowerCase() || "";

  // 1. Tìm trong bảng Sản phẩm (Vật tư) - Luôn tìm
  let productQuery = supabase
    .from("products")
    .select("id, name, sku, retail_unit, actual_cost, image_url")
    .eq("status", "active") // Chỉ lấy SP đang hoạt động
    .limit(20);

  // 2. Tìm trong bảng Dịch vụ (Theo loại yêu cầu)
  let serviceQuery = supabase
    .from("service_packages")
    .select("id, name, sku, unit, total_cost_price, price, type, created_at")
    .in("type", types) // Lọc theo loại (service/bundle)
    .eq("status", "active")
    .limit(20);

  // Áp dụng bộ lọc tìm kiếm
  if (searchTerm) {
    productQuery = productQuery.or(
      `name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`
    );
    serviceQuery = serviceQuery.or(
      `name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`
    );
  } else {
    // Nếu không gõ gì -> Lấy mới nhất
    productQuery = productQuery.order("created_at", { ascending: false });
    serviceQuery = serviceQuery.order("created_at", { ascending: false });
  }

  // Chạy song song
  const [prodRes, svcRes] = await Promise.all([productQuery, serviceQuery]);

  if (prodRes.error) console.error("Lỗi tìm SP:", prodRes.error);
  if (svcRes.error) console.error("Lỗi tìm DV:", svcRes.error);

  // Chuẩn hóa dữ liệu đầu ra
  const products = (prodRes.data || []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    unit: p.retail_unit,
    price: p.actual_cost, // Giá vốn
    retail_price: 0, // SP ko có giá bán cố định ở đây
    image: p.image_url,
    type: "product",
  }));

  const services = (svcRes.data || []).map((s) => ({
    id: s.id,
    name: s.name,
    sku: s.sku,
    unit: s.unit,
    price: s.total_cost_price, // Giá vốn
    retail_price: s.price, // Giá bán
    image: null,
    type: s.type, // 'service' hoặc 'bundle'
  }));

  // Trả về danh sách gộp (Dịch vụ lên đầu)
  return [...services, ...products];
};

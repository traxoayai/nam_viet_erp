// src/features/medical/api/vaccineService.ts
import { supabase } from "@/shared/lib/supabaseClient";

// Lấy danh sách lịch sử tiêm (Timeline) của 1 khách hàng
export const getCustomerTimeline = async (customerId: number) => {
  const { data, error } = await supabase
    .from("customer_vaccination_records")
    .select(
      `
            id,
            customer_id,
            order_id,
            package_id,
            product_id,
            dose_number,
            expected_date,
            actual_date,
            status,
            products(name, sku)
        `
    )
    .eq("customer_id", customerId)
    .order("expected_date", { ascending: true });

  if (error) {
    console.error("Error fetching vaccination timeline:", error);
    throw error;
  }

  return data;
};

// 1. Lấy danh sách Mũi lẻ (Single Vaccine Service)
export const getVaccines = async (keyword?: string) => {
  const query = supabase
    .from("service_packages")
    .select(`
      id, 
      name, 
      price, 
      sku,
      service_package_items!inner(
        item_id
      )
    `)
    .eq("status", "active")
    .eq("clinical_category", "vaccination") // Chỉ lấy Vắc-xin
    .eq("type", "service")                  // 'service' là dịch vụ/mũi lẻ
    .ilike("name", `%${keyword || ""}%`)
    .limit(20);

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching single vaccines:", error);
    throw error;
  }
  
  // Format lại data: Lấy item_id (ID lõi của lọ vắc xin) ra ngoài để nhét vào Sổ tiêm chủng
  return data?.map((item: any) => ({
      id: item.id,       // ID của Dịch vụ (Để tính tiền)
      name: item.name,
      price: item.price,
      sku: item.sku,
      product_id: item.service_package_items?.[0]?.item_id // Lấy ID lõi vắc-xin
  })) || [];
};

// 2. Lấy danh sách Gói tiêm (Vaccine Bundles)
export const getVaccinePackages = async (keyword?: string) => {
  const query = supabase
    .from("service_packages")
    .select(`
      id, 
      name, 
      price, 
      status,
      clinical_category,
      service_package_items(
        item_id,
        products(name),
        quantity,
        schedule_days
      )
    `)
    .eq("status", "active")
    .eq("clinical_category", "vaccination") // Chỉ lấy Vắc-xin
    .eq("type", "bundle")                   // 'bundle' là Gói combo
    .ilike("name", `%${keyword || ""}%`)
    .limit(20);

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching vaccine bundles:", error);
    throw error;
  }
  return data;
};

// Gọi RPC Generate Timeline
export const generateTimeline = async (payload: {
  p_customer_id: number;
  p_start_date: string;
  p_order_id?: string;
  p_package_id?: number;
  p_product_id?: number;
  p_consulted_by?: string;
}) => {
  // Ép kiểu do RPC có thể chưa được auto-generated chính xác 100% về type nếu dev cập nhật bằng tay
  const { data, error } = await supabase.rpc(
    "generate_vaccine_timeline",
    payload as any
  );

  if (error) {
    console.error("Error generating vaccine timeline:", error);
    throw error;
  }

  return data;
};

// Gọi RPC dời lịch
export const rescheduleDose = async (
  recordId: number,
  newExpectedDate: string
) => {
  const { data, error } = await supabase.rpc("reschedule_vaccine_timeline", {
    p_record_id: recordId,
    p_new_expected_date: newExpectedDate,
  });

  if (error) {
    console.error("Error rescheduling vaccine dose:", error);
    throw error;
  }

  return data;
};

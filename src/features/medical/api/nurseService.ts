// src/features/medical/api/nurseService.ts
import { supabase } from "@/shared/lib/supabaseClient";

export const nurseService = {
  getNurseExecutionQueue: async (dateStr?: string) => {
    // Nếu không truyền date, API tự dùng CURRENT_DATE
    const { data, error } = await supabase.rpc("get_nurse_execution_queue", {
      p_date: dateStr,
    });
    if (error) throw error;
    return data || [];
  },

  executeVaccinationCombo: async (
    appointmentId: string,
    customerId: number,
    scannedProductIds: number[],
    warehouseId: number,
    nurseId?: string
  ) => {
    const payload: any = {
      p_appointment_id: appointmentId,
      p_customer_id: customerId,
      p_scanned_product_ids: scannedProductIds,
      p_warehouse_id: warehouseId,
    };
    if (nurseId) payload.p_nurse_id = nurseId;

    const { data, error } = await supabase.rpc(
      "execute_vaccination_combo",
      payload
    );
    if (error) throw error;
    return data;
  },
};

import type {
  //   PrescriptionTemplate,
  PrescriptionTemplateInput,
  PrescriptionItemInput,
  TemplateDetailResponse,
} from "@/types/prescriptionTemplate"; // Nhớ trỏ đúng đường dẫn

import { supabase } from "@/lib/supabaseClient";

export const prescriptionTemplateService = {
  /**
   * Lấy danh sách mẫu đơn thuốc
   */
  async getTemplates(searchText: string = "", status?: string) {
    const { data, error } = await supabase.rpc("get_prescription_templates", {
      p_search: searchText || null,
      p_status: status || null,
    });

    if (error) throw new Error(`Get Templates Error: ${error.message}`);
    return data as any[]; // Hoặc Type PrescriptionTemplate[]
  },

  /**
   * Lấy chi tiết mẫu (Header + Items)
   */
  async getTemplateDetails(id: number) {
    const { data, error } = await supabase.rpc(
      "get_prescription_template_details",
      {
        p_id: id,
      }
    );

    if (error) throw new Error(`Get Detail Error: ${error.message}`);
    // Parse JSON trả về từ RPC
    return data as TemplateDetailResponse;
  },

  /**
   * Tạo mẫu mới (Transaction)
   */
  async createTemplate(
    templateData: PrescriptionTemplateInput,
    items: PrescriptionItemInput[]
  ) {
    const { data, error } = await supabase.rpc("create_prescription_template", {
      p_data: templateData,
      p_items: items,
    });

    if (error) throw new Error(`Create Template Error: ${error.message}`);
    return data as number; // Trả về ID mới
  },

  /**
   * Cập nhật mẫu (Transaction)
   */
  async updateTemplate(
    id: number,
    templateData: PrescriptionTemplateInput,
    items: PrescriptionItemInput[]
  ) {
    const { data, error } = await supabase.rpc("update_prescription_template", {
      p_id: id,
      p_data: templateData,
      p_items: items,
    });

    if (error) throw new Error(`Update Template Error: ${error.message}`);
    return data as boolean;
  },

  /**
   * Xóa mẫu
   */
  async deleteTemplate(id: number) {
    const { data, error } = await supabase.rpc("delete_prescription_template", {
      p_id: id,
    });

    if (error) throw new Error(`Delete Template Error: ${error.message}`);
    return data as boolean;
  },
};

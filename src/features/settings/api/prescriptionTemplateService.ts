import type {
  //   PrescriptionTemplate,
  PrescriptionTemplateInput,
  PrescriptionItemInput,
  TemplateDetailResponse,
} from "@/features/settings/types/prescriptionTemplate"; // Nhớ trỏ đúng đường dẫn

import { safeRpc } from "@/shared/lib/safeRpc";

export const prescriptionTemplateService = {
  /**
   * Lấy danh sách mẫu đơn thuốc
   */
  async getTemplates(searchText: string = "", status?: string) {
    const { data } = await safeRpc("get_prescription_templates", {
      p_search: searchText || null,
      p_status: status || null,
    });
    return (data ?? []) as any[]; // Hoặc Type PrescriptionTemplate[]
  },

  /**
   * Lấy chi tiết mẫu (Header + Items)
   */
  async getTemplateDetails(id: number) {
    const { data } = await safeRpc("get_prescription_template_details", {
      p_id: id,
    });
    return data as TemplateDetailResponse;
  },

  /**
   * Tạo mẫu mới (Transaction)
   */
  async createTemplate(
    templateData: PrescriptionTemplateInput,
    items: PrescriptionItemInput[]
  ) {
    const { data } = await safeRpc("create_prescription_template", {
      p_data: templateData,
      p_items: items,
    });
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
    const { data } = await safeRpc("update_prescription_template", {
      p_id: id,
      p_data: templateData,
      p_items: items,
    });
    return data as boolean;
  },

  /**
   * Xóa mẫu
   */
  async deleteTemplate(id: number) {
    const { data } = await safeRpc("delete_prescription_template", {
      p_id: id,
    });
    return data as boolean;
  },
};

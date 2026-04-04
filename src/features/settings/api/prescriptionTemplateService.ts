import type {
  PrescriptionTemplate,
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
      p_search: searchText || undefined,
      p_status: status || undefined,
    });
    return (data ?? []) as unknown as PrescriptionTemplate[];
  },

  /**
   * Lấy chi tiết mẫu (Header + Items)
   */
  async getTemplateDetails(id: number) {
    const { data } = await safeRpc("get_prescription_template_details", {
      p_id: id,
    });
    return data as unknown as TemplateDetailResponse;
  },

  /**
   * Tạo mẫu mới (Transaction)
   */
  async createTemplate(
    templateData: PrescriptionTemplateInput,
    items: PrescriptionItemInput[]
  ) {
    const { data } = await safeRpc("create_prescription_template", {
      p_data: JSON.parse(JSON.stringify(templateData)),
      p_items: JSON.parse(JSON.stringify(items)),
    });
    return data as unknown as number; // Trả về ID mới
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
      p_data: JSON.parse(JSON.stringify(templateData)),
      p_items: JSON.parse(JSON.stringify(items)),
    });
    return data as unknown as boolean;
  },

  /**
   * Xóa mẫu
   */
  async deleteTemplate(id: number) {
    const { data } = await safeRpc("delete_prescription_template", {
      p_id: id,
    });
    return data as unknown as boolean;
  },
};

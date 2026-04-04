// src/services/vaccinationService.ts
import {
  VaccinationTemplate,
  VaccinationDetailResponse,
  VaccinationTemplateInput,
  VaccinationItemInput,
} from "@/features/marketing/types/vaccination";
import { safeRpc } from "@/shared/lib/safeRpc";
import type { Json } from "@/shared/lib/database.types";

export const vaccinationService = {
  // 1. Lấy danh sách
  async getTemplates(search: string = "", status?: string) {
    const { data } = await safeRpc("get_vaccination_templates", {
      p_search: search ?? undefined,
      p_status: status ?? undefined,
    });
    return (data ?? []) as VaccinationTemplate[];
  },

  // 2. Lấy chi tiết
  async getTemplateDetails(id: number) {
    const { data } = await safeRpc("get_vaccination_template_details", {
      p_id: id,
    });
    return data as unknown as VaccinationDetailResponse;
  },

  // 3. Tạo mới
  async createTemplate(
    data: VaccinationTemplateInput,
    items: VaccinationItemInput[]
  ) {
    const { data: newId } = await safeRpc("create_vaccination_template", {
      p_data: data as unknown as Json,
      p_items: items as unknown as Json,
    });
    return newId;
  },

  // 4. Cập nhật
  async updateTemplate(
    id: number,
    data: VaccinationTemplateInput,
    items: VaccinationItemInput[]
  ) {
    await safeRpc("update_vaccination_template", {
      p_id: id,
      p_data: data as unknown as Json,
      p_items: items as unknown as Json,
    });
    return true;
  },

  // 5. Xóa
  async deleteTemplate(id: number) {
    await safeRpc("delete_vaccination_template", {
      p_id: id,
    });
    return true;
  },
};

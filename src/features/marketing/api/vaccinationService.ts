// src/services/vaccinationService.ts
import { supabase } from "@/shared/lib/supabaseClient";
import {
  VaccinationTemplate,
  VaccinationDetailResponse,
  VaccinationTemplateInput,
  VaccinationItemInput,
} from "@/features/marketing/types/vaccination";

export const vaccinationService = {
  // 1. Lấy danh sách
  async getTemplates(search: string = "", status?: string) {
    const { data, error } = await supabase.rpc("get_vaccination_templates", {
      p_search: search || null,
      p_status: status || null,
    });

    if (error) throw new Error(error.message);
    return data as VaccinationTemplate[];
  },

  // 2. Lấy chi tiết
  async getTemplateDetails(id: number) {
    const { data, error } = await supabase.rpc(
      "get_vaccination_template_details",
      {
        p_id: id,
      }
    );

    if (error) throw new Error(error.message);
    return data as VaccinationDetailResponse;
  },

  // 3. Tạo mới
  async createTemplate(
    data: VaccinationTemplateInput,
    items: VaccinationItemInput[]
  ) {
    const { data: newId, error } = await supabase.rpc(
      "create_vaccination_template",
      {
        p_data: data,
        p_items: items,
      }
    );

    if (error) throw new Error(error.message);
    return newId;
  },

  // 4. Cập nhật
  async updateTemplate(
    id: number,
    data: VaccinationTemplateInput,
    items: VaccinationItemInput[]
  ) {
    const { error } = await supabase.rpc("update_vaccination_template", {
      p_id: id,
      p_data: data,
      p_items: items,
    });

    if (error) throw new Error(error.message);
    return true;
  },

  // 5. Xóa
  async deleteTemplate(id: number) {
    const { error } = await supabase.rpc("delete_vaccination_template", {
      p_id: id,
    });

    if (error) throw new Error(error.message);
    return true;
  },
};

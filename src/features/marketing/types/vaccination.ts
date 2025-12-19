// src/types/vaccination.ts

export interface VaccinationTemplate {
  id: number;
  name: string;
  description: string | null;
  min_age_months: number;
  max_age_months: number;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface VaccinationTemplateItem {
  id: number;
  product_id: number; // ID Vắc-xin trong kho
  product_name: string;
  product_sku: string;
  shot_name: string; // Tên mũi (Mũi 1, Mũi 2...)
  days_after_start: number; // Lịch tiêm (Ngày thứ bao nhiêu)
  note: string | null;
}

// Dữ liệu gửi lên Server để tạo/sửa
export interface VaccinationTemplateInput {
  name: string;
  description?: string;
  min_age_months: number;
  max_age_months: number;
  status: string;
}

export interface VaccinationItemInput {
  product_id: number;
  shot_name: string;
  days_after_start: number;
  note?: string;
}

export interface VaccinationDetailResponse {
  template: VaccinationTemplate;
  items: VaccinationTemplateItem[];
}

export interface PrescriptionTemplate {
  id: number;
  name: string;
  diagnosis: string | null;
  note: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface PrescriptionTemplateItem {
  id: number;
  product_id: number; // Lưu ý: Nếu DB là BIGINT thì đây là number
  product_name: string;
  product_unit: string;
  quantity: number;
  usage_instruction: string;
}

export interface PrescriptionItemInput {
  product_id: number;
  quantity: number;
  usage_instruction: string;
}

export interface PrescriptionTemplateInput {
  name: string;
  diagnosis?: string;
  note?: string;
  status?: "active" | "inactive";
}

export interface TemplateDetailResponse {
  template: PrescriptionTemplate;
  items: PrescriptionTemplateItem[];
}

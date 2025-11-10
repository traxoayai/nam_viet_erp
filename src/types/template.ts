// src/types/template.ts

// Dữ liệu thô từ CSDL
export interface DocumentTemplate {
  id: number;
  name: string;
  module: "pos" | "b2b" | "hr" | "appointment" | "accounting" | "general";
  type: "print" | "pdf" | "email" | "sms";
  status: "active" | "inactive";
  content: string | null;
  created_at?: string;
  updated_at?: string;
}

// Kiểu dữ liệu AntD Table cần (thêm 'key')
export interface TemplateRecord extends DocumentTemplate {
  key: React.Key;
}

// "Khuôn mẫu" cho Bộ não (Zustand Store)
export interface TemplateStoreState {
  templates: TemplateRecord[];
  loading: boolean;
  viewMode: "list" | "editor"; // Trạng thái xem (Danh sách / Editor)
  editingRecord: TemplateRecord | null;

  // Biến (variables) để Sếp chèn
  variables: { key: string; label: string; tags: string[] }[];

  // --- Hàm hành động ---
  fetchTemplates: () => Promise<void>;
  fetchVariables: () => void; // (Tạm thời là mock)

  showEditor: (record?: TemplateRecord | null) => void;
  showList: () => void;

  addTemplate: (values: any) => Promise<boolean>;
  updateTemplate: (id: number, values: any) => Promise<boolean>;
  deleteTemplate: (record: TemplateRecord) => Promise<boolean>;
}

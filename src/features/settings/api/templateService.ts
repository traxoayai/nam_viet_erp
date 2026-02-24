// src/services/templateService.ts
import { DocumentTemplate } from "@/features/settings/types/template";
import { supabase } from "@/shared/lib/supabaseClient";

// 1. Tải danh sách Mẫu
export const fetchTemplates = async (): Promise<DocumentTemplate[]> => {
  const { data, error } = await supabase
    .from("document_templates")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
};

// 2. Thêm Mẫu mới
export const addTemplate = async (values: any) => {
  const { error } = await supabase.from("document_templates").insert({
    name: values.name,
    module: values.module,
    type: values.type,
    status: values.status,
    content: values.content,
  });
  if (error) throw error;
  return true;
};

// 3. Cập nhật Mẫu
export const updateTemplate = async (id: number, values: any) => {
  const { error } = await supabase
    .from("document_templates")
    .update({
      name: values.name,
      module: values.module,
      type: values.type,
      status: values.status,
      content: values.content,
    })
    .eq("id", id);
  if (error) throw error;
  return true;
};

// 4. Xóa Mẫu
export const deleteTemplate = async (id: number) => {
  const { error } = await supabase
    .from("document_templates")
    .delete()
    .eq("id", id);
  if (error) throw error;
  return true;
};

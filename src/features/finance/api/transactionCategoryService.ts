// src/services/transactionCategoryService.ts
import {
  CoaAccount,
  TransactionCategory,
} from "@/features/finance/types/transactionCategory";
import { supabase } from "@/shared/lib/supabaseClient";

// === NGHIỆP VỤ LOẠI THU/CHI ===

// 1. Tải danh sách Loại Thu/Chi
export const fetchCategories = async (): Promise<TransactionCategory[]> => {
  const { data, error } = await supabase
    .from("transaction_categories")
    .select("*")
    .order("code", { ascending: true });

  if (error) throw error;
  return data || [];
};

// 2. Thêm Loại Thu/Chi
export const addCategory = async (values: any) => {
  const { error } = await supabase.from("transaction_categories").insert({
    code: values.code,
    name: values.name,
    type: values.type,
    account_id: values.accountId,
    status: values.status,
    description: values.description,
  });
  if (error) throw error;
  return true;
};

// 3. Cập nhật Loại Thu/Chi
export const updateCategory = async (id: number, values: any) => {
  const { error } = await supabase
    .from("transaction_categories")
    .update({
      code: values.code,
      name: values.name,
      type: values.type,
      account_id: values.accountId,
      status: values.status,
      description: values.description,
    })
    .eq("id", id);
  if (error) throw error;
  return true;
};

// 4. Xóa Loại Thu/Chi
export const deleteCategory = async (id: number) => {
  const { error } = await supabase
    .from("transaction_categories")
    .delete()
    .eq("id", id);
  if (error) throw error;
  return true;
};

// === NGHIỆP VỤ HỆ THỐNG TÀI KHOẢN (COA) ===
// (Tái sử dụng logic từ ChartOfAccountsPage)

// 5. Tải cây Hệ thống Tài khoản (COA)
export const fetchCoaAccounts = async (): Promise<CoaAccount[]> => {
  const { data, error } = await supabase
    .from("chart_of_accounts")
    // Chỉ lấy các trường cần thiết cho TreeSelect
    .select("id, account_code, name, parent_id, type, allow_posting")
    .order("account_code", { ascending: true });

  if (error) throw error;
  return data as CoaAccount[];
};

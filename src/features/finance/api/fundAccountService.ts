// src/services/fundAccountService.ts
import { supabase } from "@/shared/lib/supabaseClient";

// 1. Tải danh sách Tài khoản/Quỹ (ĐÃ JOIN VỚI BẢNG BANKS)
export const fetchFundAccounts = async () => {
  const { data, error } = await supabase
    .from("fund_accounts")
    .select(
      `
      *,
      banks ( short_name ) 
    `
    )
    .order("name", { ascending: true });

  if (error) throw error;

  // Xử lý dữ liệu JOIN
  return data.map((acc) => ({
    ...acc,
    // // @ts-ignore
    bankName: acc.banks?.short_name || null,
  }));
};

// 2. Thêm Tài khoản/Quỹ
export const addFundAccount = async (values: any) => {
  const { error } = await supabase.from("fund_accounts").insert({
    name: values.name,
    type: values.type,
    location: values.type === "cash" ? values.location : null,
    account_number: values.type === "bank" ? values.accountNumber : null,
    bank_id: values.type === "bank" ? values.bankId : null,
    initial_balance: values.initialBalance || 0,
    status: values.status,
  });
  if (error) throw error;
  return true;
};

// 3. Cập nhật Tài khoản/Quỹ
export const updateFundAccount = async (id: number, values: any) => {
  const { error } = await supabase
    .from("fund_accounts")
    .update({
      name: values.name,
      type: values.type,
      location: values.type === "cash" ? values.location : null,
      account_number: values.type === "bank" ? values.accountNumber : null,
      bank_id: values.type === "bank" ? values.bankId : null,
      // Không cho cập nhật số dư ban đầu
      status: values.status,
    })
    .eq("id", id);
  if (error) throw error;
  return true;
};

// 4. Xóa Tài khoản/Quỹ
export const deleteFundAccount = async (id: number) => {
  const { error } = await supabase.from("fund_accounts").delete().eq("id", id);
  if (error) throw error;
  return true;
};

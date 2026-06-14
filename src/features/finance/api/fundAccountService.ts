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
export const addFundAccount = async (values: Record<string, unknown>) => {
  const type = values.type as "cash" | "bank";
  const { error } = await supabase.from("fund_accounts").insert({
    name: values.name as string,
    type: type,
    location: type === "cash" ? (values.location as string | null) : null,
    account_number: type === "bank" ? (values.accountNumber as string | null) : null,
    bank_id: type === "bank" ? (values.bankId as number | null) : null,
    initial_balance: (values.initialBalance as number) || 0,
    status: values.status as "active" | "locked",
  });
  if (error) throw error;
  return true;
};

// 3. Cập nhật Tài khoản/Quỹ
export const updateFundAccount = async (id: number, values: Record<string, unknown>) => {
  const type = values.type as "cash" | "bank";
  const { error } = await supabase
    .from("fund_accounts")
    .update({
      name: values.name as string,
      type: type,
      location: type === "cash" ? (values.location as string | null) : null,
      account_number: type === "bank" ? (values.accountNumber as string | null) : null,
      bank_id: type === "bank" ? (values.bankId as number | null) : null,
      // Không cho cập nhật số dư ban đầu
      status: values.status as "active" | "locked",
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

// Plan 2 Task 8: API wrapper cho RPC `get_chat_customer_summary`.
// Trả về snapshot khách hàng cho Sales Inbox right panel.
//
// Notes về schema (đã verify live 2026-05-16):
//  - portal_users.id là uuid; customers_b2b.id là bigint → ép `number` ở FE.
//  - orders.id là uuid; orders.code là TEXT.
//  - get_customer_debt_summary trả nhiều field; chuẩn hoá `debt_total` ở RPC.

import { safeRpc } from "@/shared/lib/safeRpc";

export interface ChatPortalUserSummary {
  id: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
}

export interface ChatCustomerInfo {
  id: number;
  name: string | null;
  customer_code: string | null;
  tax_code: string | null;
  vat_address: string | null;
  shipping_address: string | null;
}

export interface ChatRecentOrder {
  id: string;
  code: string;
  total: number;
  status: string;
  created_at: string;
}

export interface ChatDebtSummary {
  debt_total: number;
  debt_limit?: number;
  available_credit?: number;
  pending_orders_total?: number;
  total_exposure?: number;
  note?: string;
}

export interface ChatCustomerSummary {
  portal_user: ChatPortalUserSummary | null;
  customer: ChatCustomerInfo | null;
  recent_orders: ChatRecentOrder[];
  debt: ChatDebtSummary | null;
}

export async function getChatCustomerSummary(
  userId: string
): Promise<ChatCustomerSummary> {
  const { data, error } = await safeRpc("get_chat_customer_summary", {
    p_user_id: userId,
  });
  if (error) throw error;
  return (data ?? {
    portal_user: null,
    customer: null,
    recent_orders: [],
    debt: null,
  }) as unknown as ChatCustomerSummary;
}

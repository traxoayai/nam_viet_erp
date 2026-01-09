// src/types/finance.ts

export type TransactionFlow = "in" | "out";
export type BusinessType =
  | "trade"
  | "advance"
  | "reimbursement"
  | "internal"
  | "other";
export type PartnerType =
  | "customer"
  | "supplier"
  | "employee"
  | "other"
  | "customer_b2b";
export type TransactionStatus =
  | "pending"
  | "approved"
  | "confirmed"
  | "cancelled"
  | "completed";

// Dữ liệu hiển thị trên bảng
export interface TransactionRecord {
  id: number;
  code: string;
  transaction_date: string;
  flow: TransactionFlow;
  amount: number;
  fund_name: string;
  partner_name: string;
  category_name: string;
  description: string;
  business_type: BusinessType;
  created_by_name: string;
  status: TransactionStatus; // MỚI
  total_count: number;

  // Thông tin bổ sung
  ref_advance_id?: number; // ID phiếu tạm ứng gốc
  evidence_url?: string; // Ảnh chứng từ
  cash_tally?: Record<string, number>; // Bảng kê tiền { "500000": 2, ... }
}

// Dữ liệu gửi lên để tạo mới
export interface CreateTransactionParams {
  p_flow: TransactionFlow;
  p_business_type: BusinessType;
  p_fund_account_id: number;
  p_amount: number;
  p_category_id?: number;
  p_partner_type?: PartnerType;
  p_partner_id?: string;
  p_partner_name?: string;
  p_description?: string;
  p_evidence_url?: string;

  // MỚI: Các trường nâng cấp V2
  p_status?: TransactionStatus;
  p_ref_advance_id?: number;
  p_cash_tally?: Record<string, number>;
  
  // [NEW] Tham chiếu tổng quát
  p_ref_type?: string;
  p_ref_id?: number;
}

export interface TransactionFilter {
  flow?: TransactionFlow;
  fund_id?: number;
  date_from?: string;
  date_to?: string;
  status?: TransactionStatus; // MỚI
  search?: string; // MỚI
}

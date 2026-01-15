// src/features/finance/types/finance.ts

// 1. Dữ liệu Đơn hàng Treo (Trả về từ RPC get_pending_reconciliation_orders)
export interface PendingReconciliationOrder {
  order_id: string;        // UUID
  order_code: string;      // SO-xxxx hoặc POS-xxxx
  created_at: string;      // ISO Date
  customer_code: string;   // Mã khách (để đối chiếu)
  customer_name: string;
  final_amount: number;
  paid_amount: number;
  remaining_amount: number; // Số tiền cần thu
  payment_method: string;   // 'bank_transfer', 'debt', ...
  source: 'B2B' | 'POS';
}

// 2. Dữ liệu Giao dịch Ngân hàng (Sau khi parse từ PDF/Excel)
export interface BankTransaction {
  key: string;             // Unique key (e.g. trans_0)
  date: string;            // Ngày giao dịch (nếu parse được)
  amount: number;          // Số tiền ghi có (Tiền vào)
  debit: number;           // Số tiền ghi nợ (Tiền ra - nếu cần)
  description: string;     // Nội dung giao dịch (quan trọng nhất)
  raw_line: string;        // Dòng text gốc
}

// 3. Kết quả Khớp lệnh (Dùng cho State của bảng đối soát)
export interface ReconciliationMatch {
  key: string | number;
  transaction: BankTransaction;        // Thông tin từ sao kê
  matched_order_id: string | null;     // ID đơn hàng khớp (Null nếu chưa khớp)
  status: 'matched' | 'unmatched';     // Trạng thái hiển thị
  confidence_score?: number;           // (Optional) Độ tin cậy nếu sau này dùng AI
}

// 4. Tài khoản Quỹ
export interface FundAccount {
  id: number;
  name: string;
  type: string;
  currency: string;
  balance: number;
  status: 'active' | 'inactive';
}

// 5. [RESTORED] Dữ liệu Giao dịch Tài chính (Full Record)
export interface TransactionRecord {
  id: number;
  code: string;
  amount: number;
  transaction_date: string; // ISO string
  flow: 'in' | 'out';
  business_type: 'trade' | 'advance' | 'reimbursement' | 'other' | string;
  status: 'pending' | 'approved' | 'completed' | 'cancelled' | 'confirmed';
  description?: string;
  evidence_url?: string;
  
  // Fields from JOINs or RPC
  fund_name?: string;
  partner_name?: string;
  created_by_name?: string;
  cash_tally?: Record<string, number>; // Key: mệnh giá, Value: số lượng
  total_count?: number; // For pagination
  target_bank_info?: { bin: string; acc: string; holder: string }; // [NEW]
}

// 6. [RESTORED] Params tạo giao dịch (RPC create_finance_transaction)
export interface CreateTransactionParams {
  p_flow: 'in' | 'out';
  p_business_type: string;
  p_amount: number;
  p_fund_id: number;
  p_partner_id?: string;   // UUID or ID
  p_partner_type?: 'customer' | 'supplier' | 'employee' | 'other';
  p_partner_name?: string; // [ADDED]
  p_description?: string;
  p_transaction_date: string;
  p_evidence_url?: string;
  p_ref_doc_id?: string;    // e.g. order_id
  p_ref_advance_id?: number | null; // ID phiếu tạm ứng (nếu là hoàn ứng)
  p_cash_tally?: Record<string, number>;
  p_category_id?: number; // [ADDED]
  p_ref_type?: string; // [ADDED]
  p_ref_id?: string; // [ADDED]
  p_status?: string;
  p_target_bank_info?: { bin: string; acc: string; holder: string } | null; // [ADDED]
}

// 7. [RESTORED] Bộ lọc giao dịch
export interface TransactionFilter {
  flow?: 'in' | 'out';
  fund_id?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  status?: string;
}

// // src/types/sales_rpc.ts
// /**
//  * CORE GENERATED TYPES
//  * Module: Sales & Finance Support
//  * Sync Status: 100% with Database Schema
//  */

// // 1. Types cho RPC: get_available_vouchers
// export interface VoucherRecord {
//   id: string; // UUID
//   code: string; // Mã voucher
//   name: string; // Tên hiển thị
//   description: string | null;
//   discount_type: "percent" | "fixed" | string; // Loại giảm giá
//   discount_value: number; // Giá trị giảm (VD: 10 hoặc 50000)
//   max_discount_value: number | null; // Tối đa giảm (cho loại percent)
//   min_order_value: number; // Đơn tối thiểu
//   valid_to: string; // ISO Date String (Hạn sử dụng)
// }

// // 2. Types cho RPC: get_customer_debt_info
// export interface CustomerDebtInfo {
//   customer_id: number; // BigInt trả về Number trong JS
//   customer_name: string;
//   debt_limit: number; // Hạn mức tín dụng
//   current_debt: number; // Nợ hiện tại (Realtime)
//   available_credit: number; // Hạn mức còn lại
//   is_bad_debt: boolean; // Cờ báo động đỏ
//   // Bổ sung thông tin hiển thị UI
//   tax_code?: string;
//   address?: string;
//   contact_person?: string;
//   loyalty_points?: number;
// }

// // 3. Types cho RPC: search_product_batches
// export interface ProductBatchInfo {
//   lot_number: string; // Số lô
//   expiry_date: string; // YYYY-MM-DD
//   days_remaining: number; // Số ngày còn hạn
// }

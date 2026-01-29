// src/features/purchasing/types/supplierPolicy.ts
export type RuleType = 'rebate_revenue' | 'buy_x_get_y' | 'buy_amt_get_gift' | 'direct_discount';
export type PriceBasis = 'pre_vat' | 'post_vat';
export type ProgramType = 'contract' | 'promotion';

// UI Form Value Interface
export interface PolicyFormValues {
  // --- HEADER ---
  supplier_id: number | null;
  name: string;
  document_code: string;
  type: ProgramType;
  range_picker: [any, any]; // Dayjs array
  description?: string;
  attachment_url?: string;

  // --- GROUPS ---
  groups: PolicyGroupFormValue[];
}

export interface PolicyGroupFormValue {
  key: string; // Temp ID for UI key
  id?: number; // Real ID if editing
  name: string;
  rule_type: RuleType;
  price_basis: PriceBasis;

  // Dynamic Rules Config
  rules: {
    min_turnover?: number;
    rate?: number;
    buy_qty?: number;
    get_qty?: number;
    min_order_value?: number;
    gift_name?: string;
  };

  // Scope
  product_ids: number[];
  _product_display?: any[]; // For UI tags only
}

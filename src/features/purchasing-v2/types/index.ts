export type PurchaseOrderV2 = {
  id: number;
  code: string;
  supplier_id: number;
  shipping_partner_id?: number;
  status: string;
  delivery_status: string;
  payment_status: string;
  total_amount: number;
  final_amount: number;
  total_paid: number;
  created_at: string;
  creator_name?: string;
  suppliers?: { name: string };
  shipping_partners?: { name: string };
};

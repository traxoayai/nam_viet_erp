export interface OutboundTask {
  task_id: string;        // UUID
  task_type: string;      // 'B2B'
  code: string;           // Order Code
  customer_name: string;
  created_at: string;
  delivery_deadline: string;
  item_count: number;
  priority: 'High' | 'Normal';
}

export interface OutboundStats {
  pending_packing: number;
  shipping: number;
  completed_today: number;
}

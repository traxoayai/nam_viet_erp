export type TransferStatus = 'pending' | 'approved' | 'shipping' | 'completed' | 'cancelled';

export interface TransferMaster {
    id: number;
    code: string;
    source_warehouse_id: number;
    dest_warehouse_id: number;
    status: TransferStatus;
    note?: string;
    created_at: string;
    updated_at: string;
    creator_id?: string; // UUID
    
    // Optional joined fields (for list view)
    source_warehouse_name?: string;
    dest_warehouse_name?: string;
    creator_name?: string;
}

export interface TransferItem {
    id: number;
    transfer_id: number;
    product_id: number;
    quantity_requested: number;
    quantity_approved?: number; // For approval step
    quantity_shipped?: number;  // For shipping step
    quantity_received?: number; // For receive step

    conversion_factor?: number; // Hệ số quy đổi (Ví dụ: 15)
    
    // Joined fields
    product_name?: string;
    sku?: string;
    uom?: string;
}

export interface TransferBatchItem {
    id: number;
    transfer_item_id: number;
    batch_id: number;
    quantity: number;
    
    // Joined fields
    batch_code?: string;
    expiry_date?: string;
}

export interface TransferDetail extends TransferMaster {
    items: TransferItem[];
}

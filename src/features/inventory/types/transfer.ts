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
    receiver_name?: string; // [NEW]
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
    barcode?: string;
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

export interface TransferCartItem {
    key: string; // Unique ID cho UI
    product_id: number;
    sku: string;
    product_name: string;
    image_url: string; // [NEW] Hiển thị Avatar
    
    // Tồn kho & Gợi ý (Read-only)
    current_stock: number; // Tồn thực tế (Base Unit)
    shelf_location: string;
    lot_hint: string;      // Gợi ý lô (FEFO)
    expiry_hint: string;   // HSD lô gợi ý
    
    // Đơn vị & Số lượng (Editable)
    unit: string;          // Đơn vị chuyển (Wholesale)
    conversion_factor: number;
    quantity: number;      // SL nhập vào (theo Unit)
    
    // Tính toán
    base_quantity: number; // = quantity * conversion_factor
    error?: string;        // Lỗi validate (nếu có)
}

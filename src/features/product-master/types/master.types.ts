// src/features/product-master/types/master.types.ts
export interface ProductMasterImportRow {
    sku: string; // Key để tìm kiếm
    name?: string;
    status?: string;
    image_url?: string;
    barcode?: string;
    manufacturer_name?: string;
    cost_price?: number; // Map vào actual_cost
    
    // Units
    base_unit_name?: string;
    retail_unit_name?: string;
    retail_conversion_rate?: number;
    wholesale_unit_name?: string;
    wholesale_conversion_rate?: number;
    logistic_unit_name?: string;
    logistic_conversion_rate?: number;
    
    // Margin
    retail_margin_value?: number;
    retail_margin_type?: string; // 'vnd' | '%' - Parsing logic will handle this
    wholesale_margin_value?: number;
    wholesale_margin_type?: string;
    
    // Dynamic Settings (FE tự parse các cột Min/Max Warehouse thành mảng này)
    // Lưu ý: Key của object này sẽ là dynamic khi đọc Excel (e.g. "Kho [1] - Min")
    [key: string]: any; 
}

export interface ProductMasterExportItem {
    product_id: number;
    sku: string;
    name: string;
    status: string;
    image_url: string;
    barcode: string;
    manufacturer_name: string;
    distributor_id: number;
    cost_price: number;

    base_unit_name: string;

    retail_unit_name: string;
    retail_conversion_rate: number;

    wholesale_unit_name: string;
    wholesale_conversion_rate: number;

    logistic_unit_name: string;
    logistic_conversion_rate: number;

    retail_margin_value: number;
    retail_margin_type: string;
    wholesale_margin_value: number;
    wholesale_margin_type: string;

    warehouse_settings: {
        warehouse_id: number;
        min: number;
        max: number;
    }[];
}

export interface ProductMasterImportPayload {
    sku: string;
    name?: string;
    status?: string;
    image_url?: string;
    barcode?: string;
    manufacturer_name?: string;
    cost_price?: number;

    base_unit_name?: string;

    retail_unit_name?: string;
    retail_conversion_rate?: number;

    wholesale_unit_name?: string;
    wholesale_conversion_rate?: number;

    retail_margin_value?: number;
    retail_margin_type?: string;
    wholesale_margin_value?: number;
    wholesale_margin_type?: string;

    warehouse_settings?: {
        warehouse_id: number;
        min: number;
        max: number;
    }[];
}

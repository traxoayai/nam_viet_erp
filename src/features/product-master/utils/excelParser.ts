import * as XLSX from "xlsx";
import { 
    ProductMasterExportItem, 
    ProductMasterImportPayload
} from "../types/master.types";

interface Warehouse {
    id: number;
    name: string;
}

// 1. Generate Excel Template (Export)
export const generateExcelTemplate = (
    data: ProductMasterExportItem[], 
    warehouses: Warehouse[]
) => {
    // A. Chuyển đổi dữ liệu phẳng
    const flattenedData = data.map(item => {
        const row: any = {
            "SKU (Mã SP)": item.sku,
            "Tên sản phẩm": item.name,
            "Trạng thái": item.status,
            "Ảnh (URL)": item.image_url,
            "Mã vạch": item.barcode,
            "Nhà sản xuất": item.manufacturer_name,
            "Giá vốn (Cost)": item.cost_price,
            
            "Đơn vị Cơ bản": item.base_unit_name,
            
            "Đơn vị Lẻ": item.retail_unit_name,
            "Quy đổi Lẻ": item.retail_conversion_rate,
            "Lãi Lẻ (Giá trị)": item.retail_margin_type === '%' ? `${item.retail_margin_value}%` : item.retail_margin_value,

            "Đơn vị Sỉ": item.wholesale_unit_name,
            "Quy đổi Sỉ": item.wholesale_conversion_rate,
            "Lãi Sỉ (Giá trị)": item.wholesale_margin_type === '%' ? `${item.wholesale_margin_value}%` : item.wholesale_margin_value,
        };

        // Dynamic Warehouse Columns
        // Logic: map từ warehouse_settings vào cột tương ứng
        // Format Header: "Kho [ID] - Min", "Kho [ID] - Max"
        warehouses.forEach(wh => {
            const settings = item.warehouse_settings?.find(w => w.warehouse_id === wh.id);
            row[`Kho [${wh.id}] - Min (${wh.name})`] = settings ? settings.min : null;
            row[`Kho [${wh.id}] - Max (${wh.name})`] = settings ? settings.max : null;
        });

        return row;
    });

    // B. Tạo Worksheet
    const ws = XLSX.utils.json_to_sheet(flattenedData);
    
    // C. Auto-fit columns (Basic)
    const colWidths = Object.keys(flattenedData[0] || {}).map(() => ({ wch: 20 }));
    ws['!cols'] = colWidths;

    return ws;
};

// 2. Parse Excel to Payload (Import)
export const parseExcelToPayload = (
    data: any[]
): ProductMasterImportPayload[] => {
    return data.map((row: any) => {
        const payload: ProductMasterImportPayload = {
            sku: row["SKU (Mã SP)"] ? String(row["SKU (Mã SP)"]).trim() : "",
            warehouse_settings: []
        };
        
        // Skip if no SKU
        if (!payload.sku) return null;

        // --- MAPPING STATIC FIELDS ---
        // Helper to get value or undefined (to ignore)
        const getVal = (key: string, type: 'string' | 'number' = 'string') => {
            const val = row[key];
            if (val === undefined || val === null || val === "") return undefined;
            if (type === 'number') {
                // Xử lý "5,000" thành 5000
                if (typeof val === 'string') {
                    const num = parseFloat(val.replace(/,/g, ''));
                    return isNaN(num) ? undefined : num;
                }
                return Number(val);
            }
            return String(val).trim();
        };

        if (row["Tên sản phẩm"] !== undefined) payload.name = getVal("Tên sản phẩm") as string | undefined;
        if (row["Trạng thái"] !== undefined) payload.status = getVal("Trạng thái") as string | undefined;
        if (row["Ảnh (URL)"] !== undefined) payload.image_url = getVal("Ảnh (URL)") as string | undefined;
        if (row["Mã vạch"] !== undefined) payload.barcode = getVal("Mã vạch") as string | undefined;
        if (row["Nhà sản xuất"] !== undefined) payload.manufacturer_name = getVal("Nhà sản xuất") as string | undefined;
        if (row["Giá vốn (Cost)"] !== undefined) payload.cost_price = getVal("Giá vốn (Cost)", 'number') as number | undefined;

        if (row["Đơn vị Cơ bản"] !== undefined) payload.base_unit_name = getVal("Đơn vị Cơ bản") as string | undefined;
        
        if (row["Đơn vị Lẻ"] !== undefined) payload.retail_unit_name = getVal("Đơn vị Lẻ") as string | undefined;
        if (row["Quy đổi Lẻ"] !== undefined) payload.retail_conversion_rate = getVal("Quy đổi Lẻ", 'number') as number | undefined;
        
        // Logic Margin Lẻ: "10%" -> val: 10, type: '%'
        if (row["Lãi Lẻ (Giá trị)"] !== undefined) {
             const raw = String(row["Lãi Lẻ (Giá trị)"]);
             if (raw.includes('%')) {
                 payload.retail_margin_value = parseFloat(raw.replace('%', ''));
                 payload.retail_margin_type = '%';
             } else {
                 payload.retail_margin_value = parseFloat(raw.replace(/,/g, ''));
                 payload.retail_margin_type = 'vnd';
             }
        }

        if (row["Đơn vị Sỉ"] !== undefined) payload.wholesale_unit_name = getVal("Đơn vị Sỉ") as string | undefined;
        if (row["Quy đổi Sỉ"] !== undefined) payload.wholesale_conversion_rate = getVal("Quy đổi Sỉ", 'number') as number | undefined;
        
        // Logic Margin Sỉ
        if (row["Lãi Sỉ (Giá trị)"] !== undefined) {
             const raw = String(row["Lãi Sỉ (Giá trị)"]);
             if (raw.includes('%')) {
                 payload.wholesale_margin_value = parseFloat(raw.replace('%', ''));
                 payload.wholesale_margin_type = '%';
             } else {
                 payload.wholesale_margin_value = parseFloat(raw.replace(/,/g, ''));
                 payload.wholesale_margin_type = 'vnd';
             }
        }

        // --- MAPPING DYNAMIC WAREHOUSE FIELDS ---
        const warehouseMap = new Map<number, { min?: number, max?: number }>();

        Object.keys(row).forEach(key => {
            // Regex match: Kho [123] - Min (Tên Kho)
            const match = key.match(/Kho \[(\d+)\] - (Min|Max)/);
            if (match) {
                const whId = parseInt(match[1]);
                const type = match[2]; // 'Min' or 'Max'
                const val = getVal(key, 'number') as number | undefined;

                if (val !== undefined) {
                    const current = warehouseMap.get(whId) || {};
                    if (type === 'Min') current.min = val;
                    if (type === 'Max') current.max = val;
                    warehouseMap.set(whId, current); // FIX: Ensure update map
                }
            }
        });

        // Convert Map to Array
        if (warehouseMap.size > 0) {
            payload.warehouse_settings = Array.from(warehouseMap.entries()).map(([id, settings]) => ({
                warehouse_id: id,
                min: settings.min !== undefined ? settings.min : 0, // Fallback 0 logic backend xử lý, ở đây cứ gửi
                max: settings.max !== undefined ? settings.max : 0
            }));
        }

        return payload;
    }).filter((p): p is ProductMasterImportPayload => p !== null && p !== undefined);
};

import * as XLSX from "xlsx";

// 1. Generate Excel Template (Export)
export const generateExcelTemplate = (data: any[], warehouses: any[]) => {
  const flattenedData = data.map((item) => {
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
      "Lãi Lẻ (Giá trị)": item.retail_margin_type === "%" ? `${item.retail_margin_value}%` : item.retail_margin_value,
      "Giá bán lẻ Hiện Tại": item.retail_price || "",

      "Đơn vị Sỉ": item.wholesale_unit_name,
      "Quy đổi Sỉ": item.wholesale_conversion_rate,
      "Lãi Sỉ (Giá trị)": item.wholesale_margin_type === "%" ? `${item.wholesale_margin_value}%` : item.wholesale_margin_value,
      "Giá bán sỉ Hiện Tại": item.wholesale_price || "",
    };

    warehouses.forEach((wh) => {
      const settings = item.warehouse_settings?.find((w: any) => w.warehouse_id === wh.id);
      row[`Kho [${wh.id}] - Min (${wh.name})`] = settings ? settings.min : null;
      row[`Kho [${wh.id}] - Max (${wh.name})`] = settings ? settings.max : null;
    });

    return row;
  });

  const ws = XLSX.utils.json_to_sheet(flattenedData);
  ws["!cols"] = Object.keys(flattenedData[0] || {}).map(() => ({ wch: 20 }));
  return ws;
};

// 2. Parse Excel to Payload (Import)
export const parseExcelToPayload = (data: any[]): any[] => {
  return data
    .map((row: any) => {
      const payload: any = {
        sku: row["SKU (Mã SP)"] ? String(row["SKU (Mã SP)"]).trim() : "",
        warehouse_settings: [],
      };

      if (!payload.sku) return null;

      // Helper an toàn
      const getVal = (key: string, type: "string" | "number" = "string") => {
        const val = row[key];
        if (val === undefined || val === null || val === "") return undefined;
        if (type === "number") {
          if (typeof val === "string") {
            const num = parseFloat(val.replace(/,/g, ""));
            return isNaN(num) ? undefined : num;
          }
          return Number(val);
        }
        return String(val).trim();
      };

      // MAPPING TEXT & NUMBER FIELDS
      if (row["Tên sản phẩm"] !== undefined) payload.name = getVal("Tên sản phẩm");
      if (row["Trạng thái"] !== undefined) payload.status = getVal("Trạng thái");
      if (row["Ảnh (URL)"] !== undefined) payload.image_url = getVal("Ảnh (URL)");
      if (row["Mã vạch"] !== undefined) payload.barcode = getVal("Mã vạch");
      if (row["Nhà sản xuất"] !== undefined) payload.manufacturer_name = getVal("Nhà sản xuất");
      if (row["Giá vốn (Cost)"] !== undefined) payload.cost_price = getVal("Giá vốn (Cost)", "number");

      // UNIT FIELDS
      if (row["Đơn vị Cơ bản"] !== undefined) payload.base_unit_name = getVal("Đơn vị Cơ bản");

      if (row["Đơn vị Lẻ"] !== undefined) payload.retail_unit_name = getVal("Đơn vị Lẻ");
      if (row["Quy đổi Lẻ"] !== undefined) payload.retail_conversion_rate = getVal("Quy đổi Lẻ", "number");
      if (row["Giá bán lẻ Hiện Tại"] !== undefined) payload.retail_price = getVal("Giá bán lẻ Hiện Tại", "number");

      // Logic Margin Lẻ thông minh (Auto-detect % vs VND)
      if (row["Lãi Lẻ (Giá trị)"] !== undefined) {
        const raw = String(row["Lãi Lẻ (Giá trị)"]);
        // Xóa dấu phẩy và dấu % (nếu user lỡ nhập) để parse ra số nguyên chất
        const numericVal = parseFloat(raw.replace(/,/g, "").replace("%", ""));
        if (!isNaN(numericVal)) {
          payload.retail_margin_value = numericVal;
          // Nhỏ hơn hoặc bằng 100 thì là %, lớn hơn là VND
          payload.retail_margin_type = numericVal <= 100 ? "%" : "vnd";
        }
      }

      if (row["Đơn vị Sỉ"] !== undefined) payload.wholesale_unit_name = getVal("Đơn vị Sỉ");
      if (row["Quy đổi Sỉ"] !== undefined) payload.wholesale_conversion_rate = getVal("Quy đổi Sỉ", "number");
      if (row["Giá bán sỉ Hiện Tại"] !== undefined) payload.wholesale_price = getVal("Giá bán sỉ Hiện Tại", "number");

      // Logic Margin Sỉ thông minh (Auto-detect % vs VND)
      if (row["Lãi Sỉ (Giá trị)"] !== undefined) {
        const raw = String(row["Lãi Sỉ (Giá trị)"]);
        const numericVal = parseFloat(raw.replace(/,/g, "").replace("%", ""));
        if (!isNaN(numericVal)) {
          payload.wholesale_margin_value = numericVal;
          // Nhỏ hơn hoặc bằng 100 thì là %, lớn hơn là VND
          payload.wholesale_margin_type = numericVal <= 100 ? "%" : "vnd";
        }
      }

      // DYNAMIC WAREHOUSE MAPPING
      const warehouseMap = new Map<number, { min?: number; max?: number }>();
      Object.keys(row).forEach((key) => {
        const match = key.match(/Kho \[(\d+)\] - (Min|Max)/);
        if (match) {
          const whId = parseInt(match[1]);
          const type = match[2];
          const val = getVal(key, "number") as number | undefined;

          if (val !== undefined) {
            const current = warehouseMap.get(whId) || {};
            if (type === "Min") current.min = val;
            if (type === "Max") current.max = val;
            warehouseMap.set(whId, current);
          }
        }
      });

      if (warehouseMap.size > 0) {
        payload.warehouse_settings = Array.from(warehouseMap.entries()).map(([id, settings]) => ({
          warehouse_id: id,
          min: settings.min !== undefined ? settings.min : 0,
          max: settings.max !== undefined ? settings.max : 0,
        }));
      }

      return payload;
    })
    .filter((p): p is any => p !== null && p !== undefined);
};

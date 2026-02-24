import * as XLSX from "xlsx";

import * as productService from "@/features/product/api/productService";

// Helper type for Excel Row
interface ExcelProductRow {
  "Tên sản phẩm": string;
  SKU: string;
  "Barcode sản phẩm"?: string;
  "Ảnh sản phẩm"?: string;
  "Phân loại"?: string;
  "Nhà sản xuất"?: string;
  "Hoạt chất"?: string; // active_ingredient mapped to tags/active_ingredient
  "Quy cách đóng gói"?: string; // packing_spec
  "Số đăng ký"?: string; // registration_number

  // Base Unit & Cost
  "Đơn vị cơ sở": string; // Base Unit Name
  "Giá vốn": number; // actual_cost for Base Unit

  // Margins
  "Lãi bán buôn"?: number;
  "Lãi bán lẻ"?: number;

  // Wholesale Unit
  "Đơn vị bán buôn"?: string;
  "SL Quy đổi Buôn"?: number; // Rate
  "Giá bán buôn"?: number; // Optional override

  // Retail Unit
  "Đơn vị bán lẻ"?: string;
  "SL Quy đổi Lẻ"?: number; // Rate
  "Giá bán lẻ"?: number; // Optional override

  // Logistics (Optional)
  "Đơn vị Logistic"?: string; // carton unit name often
  "SL Quy đổi Log"?: number;
  "Số lượng/Thùng"?: number; // items_per_carton
  "Cân nặng (g)"?: number;
}

export const downloadTemplate = () => {
  const headers = [
    "Tên sản phẩm",
    "SKU",
    "Barcode sản phẩm",
    "Ảnh sản phẩm",
    "Phân loại",
    "Nhà sản xuất",
    "Hoạt chất",
    "Đơn vị cơ sở",
    "Giá vốn",
    "Lãi bán buôn",
    "Lãi bán lẻ",
    "Đơn vị bán buôn",
    "SL Quy đổi Buôn",
    "Giá bán buôn",
    "Đơn vị bán lẻ",
    "SL Quy đổi Lẻ",
    "Giá bán lẻ",
    "Quy cách đóng gói",
    "Số đăng ký",
  ];

  const sampleData = [
    {
      "Tên sản phẩm": "Paracetamol 500mg",
      SKU: "PARA500",
      "Barcode sản phẩm": "893123456789",
      "Ảnh sản phẩm": "",
      "Phân loại": "Thuốc giảm đau",
      "Nhà sản xuất": "DHG Pharma",
      "Hoạt chất": "Paracetamol",
      "Đơn vị cơ sở": "Viên",
      "Giá vốn": 1000,
      "Lãi bán buôn": 10,
      "Lãi bán lẻ": 20,
      "Đơn vị bán buôn": "Hộp",
      "SL Quy đổi Buôn": 20,
      "Giá bán buôn": 22000,
      "Đơn vị bán lẻ": "Vỉ",
      "SL Quy đổi Lẻ": 10,
      "Giá bán lẻ": 12000,
      "Quy cách đóng gói": "Hộp 2 vỉ x 10 viên",
      "Số đăng ký": "VD-1234-56",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "MauNhapLieu");
  XLSX.writeFile(wb, `Template_Nhap_SanPham_V2.xlsx`);
};

export const importProductsFromExcel = async (file: File): Promise<number> => {
  return new Promise(async (resolve, reject) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Read as JSON with headers
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (!jsonData || jsonData.length === 0) {
        resolve(0);
        return;
      }

      const processedItems = jsonData.map((row: any) => {
        const safeRow = row as ExcelProductRow;
        // 1. Map Basic Fields
        const formValues: any = {
          productName: safeRow["Tên sản phẩm"],
          sku: safeRow["SKU"] || null,
          barcode: safeRow["Barcode sản phẩm"] || null,
          imageUrl: safeRow["Ảnh sản phẩm"] || null,
          category: safeRow["Phân loại"] || null,
          manufacturer: safeRow["Nhà sản xuất"] || null,
          tags: safeRow["Hoạt chất"] || null,
          packingSpec: safeRow["Quy cách đóng gói"] || null,
          registrationNumber: safeRow["Số đăng ký"] || null,
          description: null,

          // Financials
          actualCost: Number(safeRow["Giá vốn"] || 0),
          wholesaleMarginValue: Number(safeRow["Lãi bán buôn"] || 0),
          wholesaleMarginType: "percent", // Default to percent for excel import simplicity unless specified
          retailMarginValue: Number(safeRow["Lãi bán lẻ"] || 0),
          retailMarginType: "percent",

          // Logistics
          items_per_carton: Number(safeRow["Số lượng/Thùng"] || 1),
          carton_weight: Number(safeRow["Cân nặng (g)"] || 0),

          units: [], // Will populate below
        };

        // 2. Extract Units & Calculate Prices
        const units = [];
        const baseCost = formValues.actualCost;
        const wholesaleMargin = formValues.wholesaleMarginValue; // assumes percent
        const retailMargin = formValues.retailMarginValue; // assumes percent

        // A. Base Unit (Implicitly handled usually as retailUnit in old mapping, but here we treat strictly)
        // productService.v_addProduct logic uses 'retailUnit' as the base/smallest unit often.
        // Let's map "Đơn vị cơ sở" to formValues.retailUnit to satisfy the legacy/hybrid expectation of existing service
        // or we explicitly add it to the units array if the service supports it.
        // Looking at addProduct: if (formValues.retailUnit) -> pushed as base.
        if (safeRow["Đơn vị cơ sở"]) {
          formValues.retailUnit = safeRow["Đơn vị cơ sở"]; // Treat Base as the primary small unit
        }

        // B. Wholesale Unit
        if (safeRow["Đơn vị bán buôn"]) {
          const rate = Number(safeRow["SL Quy đổi Buôn"] || 1);
          // Price Priority: Explicit Price > (BaseCost + Margin) * Rate
          let price = Number(safeRow["Giá bán buôn"] || 0);
          if (!price && baseCost > 0) {
            const costPerUnit = baseCost * rate;
            price = costPerUnit * (1 + wholesaleMargin / 100);
          }

          units.push({
            unit_name: safeRow["Đơn vị bán buôn"],
            conversion_rate: rate,
            unit_type: "wholesale",
            price: Math.round(price),
            barcode: null,
          });
        }

        // C. Retail Unit (Alternative / Intermediate Unit like 'Vỉ')
        if (safeRow["Đơn vị bán lẻ"]) {
          const rate = Number(safeRow["SL Quy đổi Lẻ"] || 1);
          // Check if this is different from Base Unit
          if (safeRow["Đơn vị bán lẻ"] !== safeRow["Đơn vị cơ sở"]) {
            let price = Number(safeRow["Giá bán lẻ"] || 0);
            if (!price && baseCost > 0) {
              const costPerUnit = baseCost * rate;
              price = costPerUnit * (1 + retailMargin / 100);
            }

            units.push({
              unit_name: safeRow["Đơn vị bán lẻ"],
              conversion_rate: rate,
              unit_type: "retail",
              price: Math.round(price),
              barcode: null,
            });
          }
        }

        // D. Logistics Unit
        if (safeRow["Đơn vị Logistic"]) {
          const rate = Number(safeRow["SL Quy đổi Log"] || 1);
          units.push({
            unit_name: safeRow["Đơn vị Logistic"],
            conversion_rate: rate,
            unit_type: "logistics",
            price: 0, // Usually no price for transport unit
            barcode: null,
          });
        }

        formValues.units = units;
        return formValues;
      });

      // 3. Execute concurrently
      // addProduct calls upsert_product_with_units which handles transactions.
      // We'll limit concurrency to 5.
      const CONCURRENCY_LIMIT = 5;
      let completed = 0;
      const errors: any[] = [];

      const chunkArray = (arr: any[], size: number) =>
        Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
          arr.slice(i * size, i * size + size)
        );

      const chunks = chunkArray(processedItems, CONCURRENCY_LIMIT);

      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(async (item: any) => {
            try {
              await productService.addProduct(item, []);
              completed++;
            } catch (err) {
              console.error(`Failed to import item ${item.productName}:`, err);
              errors.push({ item: item.productName, error: err });
            }
          })
        );
      }

      if (errors.length > 0) {
        console.warn("Import completed with some errors:", errors);
      }

      resolve(completed);
    } catch (error) {
      console.error("Excel Processing Error:", error);
      reject(error);
    }
  });
};

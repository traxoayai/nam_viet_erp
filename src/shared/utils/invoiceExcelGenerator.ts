// src/shared/utils/invoiceExcelGenerator.ts
import dayjs from "dayjs";
import * as XLSX from "xlsx";

interface OrderData {
  code: unknown;
  customer_name: unknown;
  customer_phone?: unknown;
  delivery_address?: unknown;
  note?: unknown;
  total_amount: unknown;
  discount_amount: unknown;
  shipping_fee: unknown;
  final_amount: unknown;
  items?: Array<Record<string, unknown>>;
  order_items?: Array<Record<string, unknown>>;
}

export const generateInvoiceExcel = (ordersData: unknown[]) => {
  const excelData: unknown[][] = [];

  ordersData.forEach((orderRaw) => {
    const order = orderRaw as OrderData;
    // 1. Header Đơn hàng
    excelData.push(["MÃ ĐƠN HÀNG", order.code]);
    excelData.push([
      "Khách hàng",
      order.customer_name,
      "SĐT",
      order.customer_phone || "",
    ]);
    excelData.push([
      "Địa chỉ",
      order.delivery_address || "",
      "Ghi chú",
      order.note || "",
    ]);
    excelData.push([
      "Tạm tính",
      order.total_amount,
      "Chiết khấu",
      order.discount_amount,
    ]);
    excelData.push([
      "Phí Ship",
      order.shipping_fee,
      "Tổng cần trả",
      order.final_amount,
    ]);

    excelData.push([]); // Dòng trống

    // 2. Header Table Sản phẩm
    excelData.push([
      "STT",
      "SKU",
      "Tên Sản Phẩm",
      "ĐVT",
      "Số Lượng",
      "Đơn Giá",
      "Thành Tiền",
      "Lô",
      "HSD",
    ]);

    // 3. Vòng lặp Sản phẩm
    const items = (order.items || order.order_items || []) as Array<
      Record<string, unknown>
    >;

    if (items.length > 0) {
      items.forEach((item, index: number) => {
        excelData.push([
          index + 1,
          (item?.product as Record<string, unknown>)?.sku || "",
          (item?.product as Record<string, unknown>)?.name || "Sản phẩm đã xóa",
          item?.uom || "",
          item?.quantity,
          item?.unit_price,
          item?.total_line, // [FIX] Dùng total_line theo Schema
          item?.batch_no || "",
          item?.expiry_date
            ? dayjs(item.expiry_date as string | Date).format("DD/MM/YYYY")
            : "",
        ]);
      });
    } else {
      excelData.push(["", "", "Không có sản phẩm"]);
    }

    // 4. Phân cách đơn hàng
    excelData.push([]);
    excelData.push([
      "------------------------------------------------------------------------------------------------",
    ]);
    excelData.push([]);
  });

  // 5. Tạo file
  const ws = XLSX.utils.aoa_to_sheet(excelData);
  ws["!cols"] = [
    { wch: 10 },
    { wch: 15 },
    { wch: 40 },
    { wch: 10 },
    { wch: 10 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Danh Sách Đơn Hàng");
  XLSX.writeFile(wb, `Export_Don_Hang_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`);
};

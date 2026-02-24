// src/shared/utils/invoiceExcelGenerator.ts
import dayjs from "dayjs";
import * as XLSX from "xlsx";

export const generateInvoiceExcel = (orders: any[]) => {
  const excelData: any[] = [];

  orders.forEach((order) => {
    const requestData = order.invoice_request_data || {};

    // --- QUY TẮC NGHIỆP VỤ: HÌNH THỨC THANH TOÁN ---
    // Nếu >= 5.000.000 -> 2 (Chuyển khoản), ngược lại -> 1 (Tiền mặt)
    // Lưu ý: order.final_amount là tổng tiền khách phải trả
    let paymentMethodCode = "1";
    const totalPayment = Number(order.final_amount || 0);
    if (totalPayment >= 5000000) {
      paymentMethodCode = "2";
    }

    // 1. DÒNG CƠ SỞ (MASTER ROW)
    const masterRow = {
      "Mã hóa đơn": order.code,
      "Mã số thuế": requestData.taxCode || "",
      "Mã QHNSNN": "",
      "Tên đơn vị, tổ chức": requestData.companyName || "",
      "Người mua hàng": requestData.buyerName || order.customer_name || "",
      "Số CCCD/Số hộ chiếu": "",
      "Địa chỉ": requestData.address || "",
      "Số điện thoại": requestData.phone || "",
      Email: requestData.email || "",
      "Hình thức thanh toán": paymentMethodCode, // [UPDATED LOGIC]
      "Số tài khoản ngân hàng": "",
      "Tên ngân hàng": "",
      "Tiền chiết khấu": order.discount_amount || 0,
      "Ghi chú": order.note || "",
      // --- Phần chi tiết để trống ---
      "Loại hàng hóa": "",
      "Tên hàng hóa": "",
      "Đơn vị tính": "",
      "Số lượng": "",
      "Đơn giá": "",
      "Thành tiền": "",
      VAT: "",
      "Tổng tiền hàng": order.total_amount,
      "Tổng tiền thuế": "", // Có thể tính tổng nếu cần
      "Tổng tiền thanh toán": order.final_amount,
    };
    excelData.push(masterRow);

    // 2. DÒNG CHI TIẾT (DETAIL ROWS)
    order.order_items?.forEach((item: any) => {
      // Xử lý VAT: Lấy từ cột vat_rate (đã được join trong service)
      // Nếu không có, mặc định là -1 (Không kê khai) hoặc 0 tùy quy định
      // Format yêu cầu: 5%, 10%, 0%, KKK...
      let vatRateStr = "0%";
      if (item.vat_rate !== undefined && item.vat_rate !== null) {
        vatRateStr = `${item.vat_rate}%`;
      }

      const detailRow = {
        "Mã hóa đơn": "",
        "Mã số thuế": "",
        "Mã QHNSNN": "",
        "Tên đơn vị, tổ chức": "",
        "Người mua hàng": "",
        "Số CCCD/Số hộ chiếu": "",
        "Địa chỉ": "",
        "Số điện thoại": "",
        Email: "",
        "Hình thức thanh toán": "",
        "Số tài khoản ngân hàng": "",
        "Tên ngân hàng": "",
        "Tiền chiết khấu": "",
        "Ghi chú": "",
        // --- Chi tiết ---
        "Loại hàng hóa": "0", // 0: Hàng hóa
        "Tên hàng hóa": item.product_name,
        "Đơn vị tính": item.unit_name,
        "Số lượng": item.quantity,
        "Đơn giá": item.unit_price,
        "Thành tiền": item.total_price,
        VAT: vatRateStr, // [MAPPED]
        "Tổng tiền hàng": "",
        "Tổng tiền thuế": "",
        "Tổng tiền thanh toán": "",
      };
      excelData.push(detailRow);
    });
  });

  // Xuất file
  const ws = XLSX.utils.json_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "XuatHoaDon");
  const fileName = `YeuCauXuatVAT_${dayjs().format("DDMMYYYY_HHmm")}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

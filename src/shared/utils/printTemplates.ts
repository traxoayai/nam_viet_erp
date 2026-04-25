// src/shared/utils/printTemplates.ts
import dayjs from "dayjs";

import { formatVnd } from "./format";

// ─── Local types (print-only, không export) ──────────────────────────────────

interface PrintItem {
  product_name?: string;
  name?: string;
  uom?: string;
  unit?: string;
  uom_ordered?: string;
  quantity?: number;
  quantity_ordered?: number;
  quantity_returned?: number;
  unit_price?: number;
  total_line?: number;
  batch_no?: string;
  expiry_date?: string;
  note?: string;
  is_bonus?: boolean;
  product?: { name?: string };
  product_sku?: string;
  usage_note?: string;
  unit_name?: string;
  shelf_location?: string;
}

interface PrintOrder {
  code?: string;
  created_at?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  note?: string;
  sub_total?: number;
  total_amount?: number;
  discount_amount?: number;
  shipping_fee?: number;
  final_amount?: number;
  old_debt?: number;
  total_payable_display?: number;
  loyalty_points?: number;
  supplier_name?: string;
  supplier_phone?: string;
  supplier_address?: string;
  created_by_name?: string;
  items?: PrintItem[];
}

interface PrintTransaction {
  code?: string;
  flow?: string;
  amount?: number;
  description?: string;
  partner_name_cache?: string;
  partner_name?: string;
}

interface PrintAppointment {
  appointment_time?: string;
  customer_name?: string;
  customer_yob?: string | number;
  customer_gender?: string;
  customer_phone?: string;
  service_names_mapped?: string[];
  room_name?: string;
}

interface PatientInfo {
  full_name?: string;
  name?: string;
  gender?: string;
  dob?: string;
  address?: string;
}

interface PrintMedicalData {
  patientInfo: PatientInfo;
  vitals?: {
    weight?: string | number;
    height?: string | number;
    bp_systolic?: string | number;
    bp_diastolic?: string | number;
    pulse?: string | number;
  };
  clinical?: {
    reason?: string;
    symptoms?: string;
    diagnosis?: string;
    note?: string;
    doctor_notes?: string;
  };
  prescriptionItems?: PrintItem[];
  doctorName?: string;
  reExamDate?: string;
}

interface LabResultItem {
  name?: string;
  value?: string | number;
  unit?: string;
  ref?: string;
  eval?: string;
}

interface PrintLabData {
  patientInfo: PatientInfo;
  serviceName?: string;
  results?: LabResultItem[];
  doctorName?: string;
  date?: string;
}

interface PrintImagingData {
  patientInfo: PatientInfo;
  serviceName?: string;
  descriptionHtml?: string;
  conclusionHtml?: string;
  recommendation?: string;
  doctorName?: string;
  date?: string;
}

// Config tài khoản ngân hàng nhận tiền (Sau này đưa vào Setting)
const BANK_ID = "Timo"; // Ví dụ: MB, VCB, TPB
const BANK_ACCOUNT = "0965637788";
const ACCOUNT_NAME = "LE VIET HUNG";

const triggerPrint = (htmlContent: string) => {
  const printWindow = window.open("", "", "height=600,width=800");
  if (!printWindow) return;
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 1000);
};

// 1. IN BILL K80 (CÓ QR CODE)
export const printPosBill = (order: PrintOrder) => {
  // Tạo link VietQR động
  const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${BANK_ACCOUNT}-compact.png?amount=${order.final_amount}&addInfo=TT ${dayjs().format("DDMMYYHHmm")}`;

  const itemsHtml = (order.items ?? [])
    .map(
      (item: PrintItem, index: number) => `
     <div class="grid grid-cols-12 items-start mb-2">
        <div class="col-span-6 font-semibold">
           ${index + 1}. ${item.product_name}
           <div class="text-[10px] text-gray-400 font-light">${item.uom}</div>
        </div>
        <div class="col-span-2 text-center">${item.quantity}</div>
        <div class="col-span-4 text-right">${formatVnd((item.unit_price ?? 0) * (item.quantity ?? 0))}</div>
     </div>
  `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
        <style>
            body { font-family: sans-serif; background: white; }
            .receipt-font { font-family: 'Space Mono', monospace; }
            .bill-container { width: 80mm; margin: 0 auto; padding: 5px; }
            .dashed-line { border-top: 1px dashed #000; margin: 8px 0; }
        </style>
    </head>
    <body>
        <div class="bill-container text-xs text-black leading-relaxed">
            <div class="text-center mb-2">
                <h1 class="font-bold text-lg uppercase">N.T ĐỊNH HIỀN</h1>
                <p class="text-[10px]">Hotline: 0866.83.13.83 - Web: NhaThuocDinhHien.com</p>
            </div>
            <div class="dashed-line"></div>
            <div class="flex justify-between text-[10px]">
                <div>Mã: <b>PREVIEW</b></div>
                <div>${dayjs().format("HH:mm:ss DD/MM/YYYY")}</div>
            </div>
            ${
              order.customer_name
                ? `
            <div class="text-[10px] mt-1">
                <div>KH: <b>${order.customer_name}</b>${order.customer_phone ? ` - ${order.customer_phone}` : ""}</div>
                ${order.loyalty_points != null ? `<div>Điểm tích lũy: <b>${formatVnd(order.loyalty_points ?? 0)}</b></div>` : ""}
            </div>
            `
                : ""
            }
            <div class="dashed-line"></div>
            
            <div class="grid grid-cols-12 font-bold uppercase mb-2 text-[10px]">
                <div class="col-span-6">Sản phẩm</div>
                <div class="col-span-2 text-center">SL</div>
                <div class="col-span-4 text-right">T.Tiền</div>
            </div>

            <div class="receipt-font text-[11px]">${itemsHtml}</div>

            <div class="dashed-line"></div>
            
            <div class="space-y-1 receipt-font text-[11px]">
                 <div class="flex justify-between"><span>Tạm tính:</span><span>${formatVnd(order.sub_total ?? 0)}</span></div>
                 <div class="flex justify-between"><span>Giảm giá:</span><span>-${formatVnd(order.discount_amount ?? 0)}</span></div>
                 <div class="flex justify-between font-bold text-sm mt-2 border-t pt-1">
                    <span>TỔNG CỘNG:</span><span>${formatVnd(order.final_amount ?? 0)}</span>
                 </div>
            </div>

            <div class="text-center mt-4">
                <div class="font-bold mb-1">QUÉT QR THANH TOÁN</div>
                <img src="${qrUrl}" alt="QR Payment" class="w-32 h-32 mx-auto border border-gray-300 rounded"/>
                <p class="text-[9px] mt-1">${ACCOUNT_NAME}</p>
            </div>

            <div class="mt-4 text-center italic text-[9px]">Cảm ơn quý khách! Hẹn gặp lại.</div>
        </div>
    </body>
    </html>
  `;
  triggerPrint(html);
};

// 2. IN HDSD (TEM DÁN)
export const printInstruction = (
  drugName: string,
  instruction: string | string[]
) => {
  if (!instruction || (Array.isArray(instruction) && instruction.length === 0))
    return;

  let rawText = "";
  if (Array.isArray(instruction)) {
    rawText = instruction.join(" - ");
  } else if (typeof instruction === "string") {
    rawText = instruction;
  } else {
    return; // Dữ liệu rác -> không in
  }

  // Tách dòng dựa trên các ký tự phân cách
  const parts = rawText.split(/[-–\n]/).filter((part) => part.trim() !== "");

  const linesHtml = parts
    .map(
      (p) => `
      <div class="instruction-line relative pl-4 mb-1 before:content-['•'] before:absolute before:left-0 before:font-bold">
          ${p.trim()}
      </div>
  `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@700;900&display=swap" rel="stylesheet">
        <style>
            body { font-family: 'Roboto', sans-serif; }
            .print-container { width: 80mm; margin: 0 auto; padding: 5px; }
            .staple-area { border: 2px dashed #999; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 9px; margin-bottom: 5px; background: #f0f0f0; }
        </style>
    </head>
    <body>
        <div class="print-container">
            <div class="staple-area">KHU VỰC BẤM GHIM</div>
            <div class="border-b-2 border-black pb-1 mb-2">
                <h1 class="text-xl font-black uppercase leading-tight">${drugName}</h1>
            </div>
            <div class="text-lg font-bold uppercase">${linesHtml}</div>
            <div class="mt-4 text-[9px] text-center text-gray-500 italic">Dược sĩ Nam Việt tư vấn</div>
        </div>
    </body>
    </html>
  `;
  triggerPrint(html);
};

// 3. IN ĐƠN HÀNG B2B (A4) - Layout 2 Cột
export const generateB2BOrderHTML = (order: PrintOrder) => {
  const companyInfo = {
    name: "CÔNG TY TNHH DƯỢC - TBYT NAM VIỆT",
    address: "Số 17, Đường Bắc Sơn, Xã Hữu Lũng, Lạng Sơn",
    website: "www.DuocNamViet.com",
    phone: "0585.123.888",
    taxCode: "4900886412",
  };

  // Logic hiển thị tiền (Ưu tiên biến total_payable_display truyền từ Hook)
  const oldDebt = Number(order.old_debt || 0);
  const currentTotal = Number(order.final_amount || 0);
  const totalPayable =
    order.total_payable_display !== undefined
      ? Number(order.total_payable_display)
      : currentTotal + oldDebt;

  const qrAmount = totalPayable > 0 ? totalPayable : currentTotal;
  const qrContent = `TT ${order.code}`;
  const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${BANK_ACCOUNT}-qr_only.png?amount=${qrAmount}&addInfo=${encodeURIComponent(qrContent)}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;

  // Sort items theo vị trí kệ (shelf_location) A-Z để dược sĩ nhặt theo trật
  // tự kho. Items thiếu vị trí / "Chưa xếp" / rỗng → đẩy xuống cuối.
  const sortedItems = [...(order.items ?? [])].sort((a, b) => {
    const sa = (a.shelf_location ?? "").trim();
    const sb = (b.shelf_location ?? "").trim();
    const aEmpty = !sa || sa === "Chưa xếp";
    const bEmpty = !sb || sb === "Chưa xếp";
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    return sa.localeCompare(sb, "vi", { numeric: true, sensitivity: "base" });
  });

  const rows =
    sortedItems
      .map(
        (item: PrintItem, index: number) => `
    <tr>
      <td style="text-align: center;">${index + 1}</td>
      <td>
        <div style="font-weight: bold;">${item.product_name}</div>
        <div style="font-size: 10px; color: #444;">
             ${item.batch_no ? `Lô: ${item.batch_no}` : ""}
             ${item.expiry_date ? `| HSD: ${dayjs(item.expiry_date).format("DD/MM/YY")}` : ""}
             ${item.shelf_location ? `| <span style="color: #096dd9; font-weight: 600;">📍 ${item.shelf_location}</span>` : ""}
        </div>
        ${item.note ? `<div style="font-style: italic; font-size: 10px;">(${item.note})</div>` : ""}
      </td>
      <td style="text-align: center;">${item.uom || item.unit}</td>
      <td style="text-align: center; font-weight: bold;">
        ${item.quantity}
        ${(item.quantity_returned || 0) > 0 ? `<div style="font-size: 10px; font-style: italic; color: #cf1322; margin-top: 2px;">- Trả: ${item.quantity_returned}</div>` : ""}
      </td>
      <td style="text-align: right;">${formatVnd(item.unit_price ?? 0)}</td>
      <td style="text-align: right;">${formatVnd(item.total_line ?? 0)}</td>
    </tr>
  `
      )
      .join("") || "";

  return `
    <html>
      <head>
        <title>In Đơn ${order.code}</title>
        <style>
          /* [NEW] Tối ưu font size cho A4 */
          body { font-family: 'Times New Roman', serif; font-size: 13px; line-height: 1.3; padding: 15px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 15px; }
          .company-name { font-size: 16px; font-weight: bold; text-transform: uppercase; color: #000; }
          .title { text-align: center; font-size: 20px; font-weight: bold; margin: 10px 0; text-transform: uppercase; letter-spacing: 1px; }
          
          /* Table tối ưu khoảng cách */
          .product-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .product-table th, .product-table td { border: 1px solid #515151ff; padding: 4px 6px; font-size: 13px; }
          .product-table th { background-color: #eee; text-align: center; }
          
          /* Layout 2 cột Footer */
          .bottom-section { display: flex; gap: 20px; margin-top: 15px; border-top: 1px solid #ccc; padding-top: 10px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 13px; }
          .final-row { font-size: 16px; font-weight: bold; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
          
          .footer { margin-top: 40px; display: flex; justify-content: space-between; text-align: center; }
          .info-table { width: 100%; margin-bottom: 15px; }
          .info-table td { padding: 4px 0; vertical-align: top; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="company-name">${companyInfo.name}</div>
            <div><b>ĐC:</b> ${companyInfo.address}</div>
            <div><b>Web:</b> ${companyInfo.website} | <b>SĐT:</b> ${companyInfo.phone}</div>
            <div><b>MST:</b> ${companyInfo.taxCode}</div>
          </div>
          <div style="text-align: right;">
            <div>Số: <b>${order.code}</b></div>
            <div>Ngày: ${dayjs(order.created_at).format("DD/MM/YYYY")}</div>
            <div>In lúc: ${dayjs().format("HH:mm")}</div>
          </div>
        </div>

         <div class="title">ĐƠN ĐẶT HÀNG / PHIẾU GIAO HÀNG</div>

         <table class="info-table">
          <tr>
            <td width="15%"><b>Khách hàng:</b></td>
            <td>${order.customer_name}</td>
            <td width="15%"><b>Điện thoại:</b></td>
            <td>${order.customer_phone || "-"}</td>
          </tr>
          <tr>
            <td><b>Địa chỉ giao:</b></td>
            <td colspan="3">${order.delivery_address || "-"}</td>
          </tr>
          <tr>
            <td><b>Ghi chú:</b></td>
            <td colspan="3">${order.note || "-"}</td>
          </tr>
        </table>

         <table class="product-table" width="100%" cellspacing="0">
            <thead>
              <tr>
                <th width="5%">STT</th>
                <th>Tên hàng hóa, quy cách</th>
                <th width="8%">ĐVT</th>
                <th width="8%">SL</th>
                <th width="12%">Đơn giá</th>
                <th width="15%">Thành tiền</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
         </table>

         <div class="bottom-section">
            <div class="qr-col" style="width: 40%; text-align: center;">
                <div style="font-weight: bold; margin-bottom: 5px; font-size: 12px;">QUÉT MÃ THANH TOÁN</div>
                <img src="${qrUrl}" width="120" height="120" style="border: 1px solid #ddd; padding: 2px;"/>
                <div style="font-size: 11px; margin-top: 5px; color: #666;">
                    ${BANK_ID} - ${BANK_ACCOUNT}<br/>
                    ${ACCOUNT_NAME}
                </div>
            </div>
            <div class="total-col" style="width: 60%;">
               <div class="total-row"><span>Cộng tiền hàng:</span> <span>${formatVnd(order.sub_total ?? order.total_amount ?? 0)} ₫</span></div>
               <div class="total-row"><span>Chiết khấu:</span> <span>- ${formatVnd(order.discount_amount || 0)} ₫</span></div>
               <div class="total-row"><span>Phí vận chuyển:</span> <span>+ ${formatVnd(order.shipping_fee || 0)} ₫</span></div>

               <div style="border-top: 1px dashed #ccc; margin: 5px 0;"></div>

               <div class="total-row"><span>Thanh toán đơn này:</span> <b>${formatVnd(currentTotal)} ₫</b></div>

               ${
                 oldDebt !== 0
                   ? `
                   <div class="total-row" style="color: ${oldDebt > 0 ? "#d4380d" : "#389e0d"};">
                       <span>${oldDebt > 0 ? "Nợ cũ (Cộng dồn):" : "Khách đã trả trước (Trừ vào tổng):"}</span>
                       <span>${oldDebt > 0 ? "" : "- "}${formatVnd(Math.abs(oldDebt))} ₫</span>
                   </div>
               `
                   : ""
               }

               <div class="total-row final-row">
                   <span>TỔNG CỘNG PHẢI TRẢ:</span> 
                   <span>${formatVnd(totalPayable)} ₫</span>
               </div>
            </div>
         </div>
         
         <div class="footer">
          <div style="width: 30%">
            <b>Người lập phiếu</b><br/>(Ký, họ tên)
          </div>
          <div style="width: 30%">
            <b>Người giao hàng</b><br/>(Ký, họ tên)
          </div>
          <div style="width: 30%">
            <b>Khách hàng</b><br/>(Ký, họ tên)<br/><br/><br/><br/>
            ${order.customer_name}
          </div>
        </div>
      </body>
    </html>
  `;
};

// 4. IN PHIẾU THU / CHI
export const generatePaymentVoucherHTML = (trans: PrintTransaction) => {
  const isReceipt = trans.flow === "in";
  const title = isReceipt ? "PHIẾU THU TIỀN" : "PHIẾU CHI TIỀN";

  return `
    <html>
      <head>
        <title>${title} ${trans.code}</title>
        <style>
            body { font-family: 'Times New Roman', serif; font-size: 14px; padding: 40px; }
            .header { text-align: left; margin-bottom: 20px; }
            .company { font-weight: bold; font-size: 16px; text-transform: uppercase;}
            .title { text-align: center; font-size: 24px; font-weight: bold; margin: 20px 0; }
            .row { margin-bottom: 10px; display: flex; }
            .label { width: 150px; font-weight: bold; }
            .value { flex: 1; border-bottom: 1px dotted #000; }
            .footer { display: flex; justify-content: space-between; margin-top: 40px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
            <div class="company">CÔNG TY TNHH DƯỢC - TBYT NAM VIỆT</div>
            <div>Số 17, Đường Bắc Sơn, Xã Hữu Lũng, Lạng Sơn</div>
        </div>
        
        <div class="title">${title}</div>
        <div style="text-align: center; margin-bottom: 20px;">Ngày ... tháng ... năm ...</div>

        <div class="row"><div class="label">Mã phiếu:</div><div class="value">${trans.code}</div></div>
        <div class="row"><div class="label">${isReceipt ? "Người nộp tiền" : "Người nhận tiền"}:</div><div class="value">${trans.partner_name_cache || trans.partner_name || "..."}</div></div>
        <div class="row"><div class="label">Địa chỉ:</div><div class="value">...</div></div>
        <div class="row"><div class="label">Lý do:</div><div class="value">${trans.description}</div></div>
        <div class="row"><div class="label">Số tiền:</div><div class="value" style="font-weight: bold; font-size: 16px;">${formatVnd(trans.amount ?? 0)} VNĐ</div></div>
        <div class="row"><div class="label">Bằng chữ:</div><div class="value">...</div></div>
        <div class="row"><div class="label">Kèm theo:</div><div class="value">... chứng từ gốc</div></div>

        <div class="footer">
            <div style="width: 25%"><b>Giám đốc</b><br/>(Ký, họ tên)</div>
            <div style="width: 25%"><b>Kế toán trưởng</b><br/>(Ký, họ tên)</div>
            <div style="width: 25%"><b>Người lập phiếu</b><br/>(Ký, họ tên)</div>
            <div style="width: 25%"><b>${isReceipt ? "Người nộp tiền" : "Người nhận tiền"}</b><br/>(Ký, họ tên)</div>
        </div>
      </body>
    </html>
  `;
};

// 5. IN PHIẾU HẸN KHÁM / SỐ THỨ TỰ (K80)
export const printAppointmentSlip = (appt: PrintAppointment) => {
  const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: sans-serif; }
            .container { width: 80mm; margin: 0 auto; padding: 5px; text-align: center; }
            .title { font-size: 18px; font-weight: bold; margin: 10px 0; text-transform: uppercase; }
            .info { text-align: left; font-size: 12px; margin-top: 10px; }
            .info div { margin-bottom: 4px; }
            .big-number { font-size: 32px; font-weight: bold; margin: 10px 0; border: 2px solid #000; display: inline-block; padding: 5px 15px; border-radius: 8px; }
            .footer { font-size: 10px; font-style: italic; margin-top: 15px; }
            .dashed { border-top: 1px dashed #000; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div style="font-weight: bold; font-size: 14px;">PHÒNG KHÁM NAM VIỆT</div>
            <div style="font-size: 10px;">ĐC: Số 17, Đường Bắc Sơn, Hữu Lũng, LS</div>
            
            <div class="dashed"></div>
            
            <div class="title">PHIẾU HẸN KHÁM</div>
            
            <div class="big-number">${dayjs(appt.appointment_time).format("HH:mm")}</div>
            
            <div class="info">
                <div><b>Khách hàng:</b> ${appt.customer_name}</div>
                <div><b>Năm sinh:</b> ${appt.customer_yob || "..."} (${appt.customer_gender === "male" ? "Nam" : "Nữ"})</div>
                <div><b>SĐT:</b> ${appt.customer_phone}</div>
                <div class="dashed"></div>
                <div><b>Dịch vụ đăng ký:</b></div>
                <ul style="padding-left: 15px; margin: 2px 0;">
                    ${(appt.service_names_mapped || []).map((name: string) => `<li>${name}</li>`).join("")}
                </ul>
                <div class="dashed"></div>
                <div><b>Phòng khám:</b> ${appt.room_name || "Lễ tân sắp xếp"}</div>
                <div><b>Ngày hẹn:</b> ${dayjs(appt.appointment_time).format("DD/MM/YYYY")}</div>
            </div>

            <div class="footer">
                Vui lòng cầm phiếu này đến quầy/phòng khám để được phục vụ.<br/>
                Xin cảm ơn!
            </div>
        </div>
    </body>
    </html>
  `;

  // Gọi hàm triggerPrint cũ
  const printWindow = window.open("", "", "height=600,width=800");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }
};

// 6. IN PHIẾU KHÁM BỆNH (A4)
export const printMedicalVisit = (data: PrintMedicalData) => {
  // data bao gồm: patientInfo, vitals, clinical, prescriptionItems, doctorName
  const win = window.open("", "", "height=700,width=900");
  if (!win) return;

  const rows = data.prescriptionItems
    ?.map(
      (item: PrintItem, idx: number) => `
    <tr>
        <td style="text-align: center">${idx + 1}</td>
        <td>
            <b>${item.product_name}</b><br>
            <i style="font-size: 11px">${item.usage_note || ""}</i>
        </td>
        <td style="text-align: center">${item.quantity} ${item.unit_name}</td>
    </tr>
  `
    )
    .join("");

  const content = `
    <html>
      <head>
        <title>Phiếu Khám Bệnh</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 20px; }
          .title { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 20px; }
          .section { margin-bottom: 15px; }
          .label { font-weight: bold; width: 100px; display: inline-block; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #333; padding: 5px; }
          .footer { margin-top: 30px; text-align: right; }
        </style>
      </head>
      <body>
        <div class="title">PHIẾU KẾT QUẢ KHÁM BỆNH</div>
        
        <div class="section">
          <div><span class="label">Họ tên:</span> ${data.patientInfo.full_name || data.patientInfo.name} (${data.patientInfo.gender === "male" ? "Nam" : "Nữ"})</div>
          <div><span class="label">Năm sinh:</span> ${data.patientInfo.dob ? `${new Date(data.patientInfo.dob).getFullYear()} (${new Date().getFullYear() - new Date(data.patientInfo.dob).getFullYear()} tuổi)` : "..."}</div>
          <div><span class="label">Địa chỉ:</span> ${data.patientInfo.address || "..."}</div>
        </div>

        <div class="section">
          <b>1. KHÁM LÂM SÀNG:</b><br>
          - Cân nặng: ${data.vitals?.weight || "_"} kg | Chiều cao: ${data.vitals?.height || "_"} cm<br>
          - Huyết áp: ${data.vitals?.bp_systolic || "_"}/${data.vitals?.bp_diastolic || "_"} mmHg | Mạch: ${data.vitals?.pulse || "_"} l/p<br>
          - Triệu chứng: ${data.clinical?.symptoms || ""}<br>
          - Chẩn đoán: <b>${data.clinical?.diagnosis || ""}</b>
        </div>

        <div class="section">
          <b>2. CHỈ ĐỊNH ĐIỀU TRỊ (ĐƠN THUỐC):</b>
          <table>
            <thead>
                <tr>
                    <th width="5%">STT</th>
                    <th>Tên thuốc / Cách dùng</th>
                    <th width="15%">Số lượng</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>

        <div class="section">
          <b>3. LỜI DẶN:</b><br>
          ${data.clinical?.doctor_notes || "Không có lời dặn đặc biệt."}<br>
          ${data.reExamDate ? `<b>Hẹn tái khám ngày: ${new Date(data.reExamDate).toLocaleDateString("vi-VN")}</b>` : ""}
        </div>

        <div class="footer">
          <div>
            <i>Ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</i><br>
            <b>BÁC SĨ ĐIỀU TRỊ</b><br>
            <br><br><br>
            ${data.doctorName || "Ký tên"}
          </div>
        </div>
      </body>
    </html>
  `;

  win.document.write(content);
  win.document.close();
  win.print();
};

// 7. IN KẾT QUẢ CHẨN ĐOÁN HÌNH ẢNH (A4/A5)
export const printImagingResult = (data: PrintImagingData) => {
  // data: { patientInfo, serviceName, descriptionHtml, conclusionHtml, recommendation, doctorName, date }
  const win = window.open("", "", "height=700,width=900");
  if (!win) return;

  const content = `
    <html>
      <head>
        <title>Kết quả ${data.serviceName}</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 20px; font-size: 14px; line-height: 1.5; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px;}
          .clinic-name { font-size: 18px; font-weight: bold; text-transform: uppercase; }
          .title { text-align: center; font-size: 22px; font-weight: bold; margin: 20px 0; text-transform: uppercase;}
          .patient-info { margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;}
          .patient-info div { display: flex; }
          .patient-info .label { font-weight: bold; width: 120px; }
          .content-section { margin-bottom: 15px; }
          .section-title { font-weight: bold; text-transform: uppercase; text-decoration: underline; margin-bottom: 5px; }
          .conclusion { font-weight: bold; color: #b91c1c; font-size: 16px; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
            <div class="clinic-name">PHÒNG KHÁM ĐA KHOA NAM VIỆT</div>
            <div>Số 17, Đường Bắc Sơn, Xã Hữu Lũng, Lạng Sơn</div>
        </div>

        <div class="title">PHIẾU KẾT QUẢ ${data.serviceName}</div>
        
        <div class="patient-info">
            <div><span class="label">Họ tên:</span> <span><b>${data.patientInfo?.name || "..."}</b></span></div>
            <div><span class="label">Năm sinh:</span> <span>${data.patientInfo?.dob ? new Date(data.patientInfo.dob).getFullYear() : "..."} (${data.patientInfo?.gender === "male" ? "Nam" : "Nữ"})</span></div>
            <div style="grid-column: span 2;"><span class="label">Địa chỉ:</span> <span>${data.patientInfo?.address || "..."}</span></div>
            <div style="grid-column: span 2;"><span class="label">Chỉ định:</span> <span>${data.serviceName}</span></div>
        </div>

        <div class="content-section">
            <div class="section-title">MÔ TẢ TỔN THƯƠNG:</div>
            <div>${data.descriptionHtml || ""}</div>
        </div>

        <div class="content-section">
            <div class="section-title">KẾT LUẬN:</div>
            <div class="conclusion">${data.conclusionHtml || ""}</div>
        </div>

        ${
          data.recommendation
            ? `
        <div class="content-section">
            <div class="section-title">ĐỀ NGHỊ:</div>
            <div>${data.recommendation}</div>
        </div>
        `
            : ""
        }

        <div class="footer">
            <div style="width: 30%"></div>
            <div style="width: 40%">
                <i>Ngày ${dayjs(data.date).format("DD")} tháng ${dayjs(data.date).format("MM")} năm ${dayjs(data.date).format("YYYY")}</i><br>
                <b>BÁC SĨ / KTV THỰC HIỆN</b><br>
                <br><br><br>
                ${data.doctorName || "Ký tên"}
            </div>
        </div>
      </body>
    </html>
    `;
  win.document.write(content);
  win.document.close();
  setTimeout(() => {
    win.print();
  }, 500);
};

// 8. IN KẾT QUẢ XÉT NGHIỆM (A4)
export const printLabResult = (data: PrintLabData) => {
  // data: { patientInfo, serviceName, results: [{ name, value, unit, ref, eval }], doctorName, date }
  const win = window.open("", "", "height=700,width=900");
  if (!win) return;

  const rows = data.results
    ?.map((item: LabResultItem, idx: number) => {
      const isAbnormal =
        item.eval === "High" || item.eval === "Low" || item.eval === "Positive";
      return `
        <tr style="${isAbnormal ? "font-weight: bold;" : ""}">
            <td style="text-align: center">${idx + 1}</td>
            <td>${item.name}</td>
            <td style="text-align: center; ${isAbnormal ? "color: red;" : ""}">${item.value}</td>
            <td style="text-align: center">${item.unit || ""}</td>
            <td style="text-align: center">${item.ref || ""}</td>
            <td style="text-align: center; ${isAbnormal ? "color: red;" : ""}">${item.eval === "High" ? "Cao" : item.eval === "Low" ? "Thấp" : item.eval === "Positive" ? "Dương tính" : "Bình thường"}</td>
        </tr>
    `;
    })
    .join("");

  const content = `
    <html>
      <head>
        <title>Kết quả Xét nghiệm ${data.serviceName}</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 20px; font-size: 14px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px;}
          .clinic-name { font-size: 18px; font-weight: bold; text-transform: uppercase; }
          .title { text-align: center; font-size: 22px; font-weight: bold; margin: 20px 0; text-transform: uppercase;}
          .patient-info { margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;}
          .patient-info div { display: flex; }
          .patient-info .label { font-weight: bold; width: 120px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #333; padding: 8px; }
          th { background-color: #f0f0f0; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
            <div class="clinic-name">PHÒNG KHÁM ĐA KHOA NAM VIỆT</div>
            <div>Số 17, Đường Bắc Sơn, Xã Hữu Lũng, Lạng Sơn</div>
        </div>

        <div class="title">PHIẾU KẾT QUẢ XÉT NGHIỆM</div>
        
        <div class="patient-info">
            <div><span class="label">Họ tên:</span> <span><b>${data.patientInfo?.name || "..."}</b></span></div>
            <div><span class="label">Năm sinh:</span> <span>${data.patientInfo?.dob ? new Date(data.patientInfo.dob).getFullYear() : "..."} (${data.patientInfo?.gender === "male" ? "Nam" : "Nữ"})</span></div>
            <div style="grid-column: span 2;"><span class="label">Địa chỉ:</span> <span>${data.patientInfo?.address || "..."}</span></div>
            <div style="grid-column: span 2;"><span class="label">Loại xét nghiệm:</span> <span><b>${data.serviceName}</b></span></div>
        </div>

        <table>
            <thead>
                <tr>
                    <th width="5%">STT</th>
                    <th width="35%">Tên Xét Nghiệm</th>
                    <th width="15%">Kết Quả</th>
                    <th width="15%">Đơn Vị</th>
                    <th width="20%">Trị Số Bình Thường</th>
                    <th width="10%">Đánh Giá</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>

        <div class="footer">
            <div style="width: 30%"></div>
            <div style="width: 40%">
                <i>Ngày ${dayjs(data.date).format("DD")} tháng ${dayjs(data.date).format("MM")} năm ${dayjs(data.date).format("YYYY")}</i><br>
                <b>KTV XÉT NGHIỆM</b><br>
                <br><br><br>
                ${data.doctorName || "Ký tên"}
            </div>
        </div>
      </body>
    </html>
    `;
  win.document.write(content);
  win.document.close();
  setTimeout(() => {
    win.print();
  }, 500);
};

// 9. IN ĐƠN MUA HÀNG (PURCHASE ORDER - A4)
export const printPurchaseOrder = (order: PrintOrder) => {
  const companyInfo = {
    name: "CÔNG TY TNHH DƯỢC - TBYT NAM VIỆT",
    address: "Số 17, Đường Bắc Sơn, Xã Hữu Lũng, Lạng Sơn",
    website: "www.DuocNamViet.com",
    phone: "0585.123.888",
  };

  const rows =
    order.items
      ?.map(
        (item: PrintItem, index: number) => `
    <tr>
      <td style="text-align: center;">${index + 1}</td>
      <td>
        <div style="font-weight: bold;">${item.product_name || item.name || item.product?.name || "Tên sản phẩm"}</div>
        ${item.is_bonus ? '<div style="font-size: 11px; color: #cf1322;">(Hàng tặng/KM)</div>' : ""}
      </td>
      <td style="text-align: center;">${item.uom || item.unit || item.uom_ordered || "-"}</td>
      <td style="text-align: center; font-weight: bold;">${item.quantity_ordered || item.quantity || 0}</td>
      <td style="text-align: right;">${formatVnd(item.unit_price || 0)}</td>
      <td style="text-align: right;">${formatVnd((item.unit_price || 0) * (item.quantity_ordered || item.quantity || 0))}</td>
    </tr>
  `
      )
      .join("") || "";

  const html = `
    <!DOCTYPE html>
    <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>In Đơn Đặt Hàng ${order.code}</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 14px; line-height: 1.4; padding: 20px; color: #000; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
          .company-name { font-size: 16px; font-weight: bold; text-transform: uppercase; }
          .title { text-align: center; font-size: 22px; font-weight: bold; margin: 20px 0 10px 0; text-transform: uppercase; letter-spacing: 1px; }
          .po-code { text-align: center; font-size: 14px; margin-bottom: 20px; font-style: italic; }
          
          .info-table { width: 100%; margin-bottom: 20px; }
          .info-table td { padding: 4px 0; vertical-align: top; }
          
          .product-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .product-table th, .product-table td { border: 1px solid #000; padding: 6px 8px; font-size: 14px; }
          .product-table th { background-color: #f5f5f5; text-align: center; font-weight: bold; }
          
          .total-section { width: 40%; margin-left: auto; border-top: 2px solid #000; padding-top: 10px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .final-row { font-size: 16px; font-weight: bold; }
          
          .footer { margin-top: 50px; display: flex; justify-content: space-between; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="company-name">${companyInfo.name}</div>
            <div><b>ĐC:</b> ${companyInfo.address}</div>
            <div><b>Web:</b> ${companyInfo.website} | <b>SĐT:</b> ${companyInfo.phone}</div>
          </div>
        </div>

        <div class="title">ĐƠN ĐẶT HÀNG</div>
        <div class="po-code">Số: ${order.code}</div>

        <table class="info-table">
          <tr>
            <td width="15%"><b>Nhà cung cấp:</b></td>
            <td>${order.supplier_name || "..."}</td>
            <td width="15%"><b>Điện thoại:</b></td>
            <td>${order.supplier_phone || "..."}</td>
          </tr>
          <tr>
            <td><b>Địa chỉ:</b></td>
            <td colspan="3">${order.supplier_address || "..."}</td>
          </tr>
          <tr>
            <td><b>Ghi chú:</b></td>
            <td colspan="3">${order.note || "..."}</td>
          </tr>
        </table>

        <table class="product-table" cellspacing="0">
          <thead>
            <tr>
              <th width="5%">STT</th>
              <th>Tên hàng hóa</th>
              <th width="10%">ĐVT</th>
              <th width="10%">SL</th>
              <th width="15%">Đơn giá</th>
              <th width="15%">Thành tiền</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="total-section">
           <div class="total-row"><span>Cộng tiền hàng:</span> <span>${formatVnd(order.sub_total || 0)} ₫</span></div>
           <div class="total-row"><span>Chiết khấu:</span> <span>- ${formatVnd(order.discount_amount || 0)} ₫</span></div>
           <div class="total-row"><span>Phí vận chuyển:</span> <span>+ ${formatVnd(order.shipping_fee || 0)} ₫</span></div>
           <div class="total-row final-row" style="margin-top: 10px;">
               <span>TỔNG CỘNG:</span>
               <span>${formatVnd(order.final_amount || 0)} ₫</span>
           </div>
        </div>
        
        <div class="footer">
          <div style="width: 50%">
            <b>Nhà Cung Cấp</b><br/>(Ký, họ tên, đóng dấu)
          </div>
          <div style="width: 50%">
            <b>Người lập đơn</b><br/>(Ký, họ tên)<br/><br/><br/><br/>
            ${order.created_by_name || ""}
          </div>
        </div>
      </body>
    </html>
  `;

  // Gọi hàm triggerPrint có sẵn ở đầu file printTemplates.ts
  triggerPrint(html);
};

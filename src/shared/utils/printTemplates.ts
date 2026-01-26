import dayjs from "dayjs";

// Config tài khoản ngân hàng nhận tiền (Sau này đưa vào Setting)
const BANK_ID = "OCB"; // Ví dụ: MB, VCB, TPB
const BANK_ACCOUNT = "0385061892"; 
const ACCOUNT_NAME = "LÊ HỒNG NHUNG";

const triggerPrint = (htmlContent: string) => {
  const printWindow = window.open('', '', 'height=600,width=800');
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
export const printPosBill = (order: any) => {
  // Tạo link VietQR động
  const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${BANK_ACCOUNT}-compact.png?amount=${order.final_amount}&addInfo=POS ${order.code}`;

  const itemsHtml = order.items.map((item: any, index: number) => `
     <div class="grid grid-cols-12 items-start mb-2">
        <div class="col-span-6 font-semibold">
           ${index + 1}. ${item.product_name}
           <div class="text-[10px] text-gray-400 font-light">${item.uom}</div>
        </div>
        <div class="col-span-2 text-center">${item.quantity}</div>
        <div class="col-span-4 text-right">${(item.unit_price * item.quantity).toLocaleString()}</div>
     </div>
  `).join('');

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
                <div>Mã: <b>${order.code}</b></div>
                <div>${new Date().toLocaleString('vi-VN')}</div>
            </div>
            <div class="dashed-line"></div>
            
            <div class="grid grid-cols-12 font-bold uppercase mb-2 text-[10px]">
                <div class="col-span-6">Sản phẩm</div>
                <div class="col-span-2 text-center">SL</div>
                <div class="col-span-4 text-right">T.Tiền</div>
            </div>

            <div class="receipt-font text-[11px]">${itemsHtml}</div>

            <div class="dashed-line"></div>
            
            <div class="space-y-1 receipt-font text-[11px]">
                 <div class="flex justify-between"><span>Tạm tính:</span><span>${order.sub_total?.toLocaleString()}</span></div>
                 <div class="flex justify-between"><span>Giảm giá:</span><span>-${order.discount_amount?.toLocaleString()}</span></div>
                 <div class="flex justify-between font-bold text-sm mt-2 border-t pt-1">
                    <span>TỔNG CỘNG:</span><span>${order.final_amount?.toLocaleString()}</span>
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
export const printInstruction = (drugName: string, instruction: string | string[]) => {
  if (!instruction || (Array.isArray(instruction) && instruction.length === 0)) return;

  let rawText = "";
  if (Array.isArray(instruction)) {
      rawText = instruction.join(" - "); 
  } else if (typeof instruction === 'string') {
      rawText = instruction;
  } else {
      return; // Dữ liệu rác -> không in
  }

  // Tách dòng dựa trên các ký tự phân cách
  const parts = rawText.split(/[-–\n]/).filter(part => part.trim() !== '');
  
  const linesHtml = parts.map(p => `
      <div class="instruction-line relative pl-4 mb-1 before:content-['•'] before:absolute before:left-0 before:font-bold">
          ${p.trim()}
      </div>
  `).join('');

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
export const generateB2BOrderHTML = (order: any) => {
  const companyInfo = {
    name: "CÔNG TY TNHH DƯỢC - TBYT NAM VIỆT",
    address: "Số 17, Đường Bắc Sơn, Xã Hữu Lũng, Lạng Sơn",
    website: "www.DuocNamViet.com",
    phone: "0585.123.888",
    taxCode: "4900886412"
  };

  // Logic hiển thị tiền (Ưu tiên biến total_payable_display truyền từ Hook)
  const oldDebt = Number(order.old_debt || 0);
  const currentTotal = Number(order.final_amount || 0);
  const totalPayable = order.total_payable_display !== undefined 
      ? Number(order.total_payable_display) 
      : (currentTotal + oldDebt);

  const qrAmount = totalPayable > 0 ? totalPayable : currentTotal;
  const qrContent = `TT ${order.code}`; 
  const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${BANK_ACCOUNT}-qr_only.png?amount=${qrAmount}&addInfo=${encodeURIComponent(qrContent)}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;

  const rows = order.items?.map((item: any, index: number) => `
    <tr>
      <td style="text-align: center;">${index + 1}</td>
      <td>
        <div style="font-weight: bold;">${item.product_name}</div>
        <div style="font-size: 10px; color: #444;">
             ${item.batch_no ? `Lô: ${item.batch_no}` : ''} 
             ${item.expiry_date ? `| HSD: ${dayjs(item.expiry_date).format('DD/MM/YY')}` : ''}
        </div>
        ${item.note ? `<div style="font-style: italic; font-size: 10px;">(${item.note})</div>` : ''}
      </td>
      <td style="text-align: center;">${item.uom || item.unit}</td>
      <td style="text-align: center; font-weight: bold;">${item.quantity}</td>
      <td style="text-align: right;">${Number(item.unit_price).toLocaleString()}</td>
      <td style="text-align: right;">${Number(item.total_line).toLocaleString()}</td>
    </tr>
  `).join('') || '';

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
            <div>Ngày: ${dayjs(order.created_at).format('DD/MM/YYYY')}</div>
            <div>In lúc: ${dayjs().format('HH:mm')}</div>
          </div>
        </div>

         <div class="title">ĐƠN ĐẶT HÀNG / PHIẾU GIAO HÀNG</div>

         <table class="info-table">
          <tr>
            <td width="15%"><b>Khách hàng:</b></td>
            <td>${order.customer_name}</td>
            <td width="15%"><b>Điện thoại:</b></td>
            <td>${order.customer_phone || '-'}</td>
          </tr>
          <tr>
            <td><b>Địa chỉ giao:</b></td>
            <td colspan="3">${order.delivery_address || '-'}</td>
          </tr>
          <tr>
            <td><b>Ghi chú:</b></td>
            <td colspan="3">${order.note || '-'}</td>
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
               <div class="total-row"><span>Cộng tiền hàng:</span> <span>${Number(order.total_amount || 0).toLocaleString()} ₫</span></div>
               <div class="total-row"><span>Chiết khấu:</span> <span>- ${Number(order.discount_amount || 0).toLocaleString()} ₫</span></div>
               <div class="total-row"><span>Phí vận chuyển:</span> <span>+ ${Number(order.shipping_fee || 0).toLocaleString()} ₫</span></div>
               
               <div style="border-top: 1px dashed #ccc; margin: 5px 0;"></div>

               <div class="total-row"><span>Thanh toán đơn này:</span> <b>${currentTotal.toLocaleString()} ₫</b></div>
               
               ${oldDebt !== 0 ? `
                   <div class="total-row" style="color: #d4380d;">
                       <span>${oldDebt > 0 ? 'Nợ cũ (Cộng dồn):' : 'Thanh toán khác:'}</span> 
                       <span>${Math.abs(oldDebt).toLocaleString()} ₫</span>
                   </div>
               ` : ''}

               <div class="total-row final-row">
                   <span>TỔNG CỘNG PHẢI TRẢ:</span> 
                   <span>${totalPayable.toLocaleString()} ₫</span>
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
export const generatePaymentVoucherHTML = (trans: any) => {
  const isReceipt = trans.flow === 'in';
  const title = isReceipt ? 'PHIẾU THU TIỀN' : 'PHIẾU CHI TIỀN';
  
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
        <div class="row"><div class="label">${isReceipt ? 'Người nộp tiền' : 'Người nhận tiền'}:</div><div class="value">${trans.partner_name_cache || trans.partner_name || '...'}</div></div>
        <div class="row"><div class="label">Địa chỉ:</div><div class="value">...</div></div>
        <div class="row"><div class="label">Lý do:</div><div class="value">${trans.description}</div></div>
        <div class="row"><div class="label">Số tiền:</div><div class="value" style="font-weight: bold; font-size: 16px;">${Number(trans.amount).toLocaleString()} VNĐ</div></div>
        <div class="row"><div class="label">Bằng chữ:</div><div class="value">...</div></div>
        <div class="row"><div class="label">Kèm theo:</div><div class="value">... chứng từ gốc</div></div>

        <div class="footer">
            <div style="width: 25%"><b>Giám đốc</b><br/>(Ký, họ tên)</div>
            <div style="width: 25%"><b>Kế toán trưởng</b><br/>(Ký, họ tên)</div>
            <div style="width: 25%"><b>Người lập phiếu</b><br/>(Ký, họ tên)</div>
            <div style="width: 25%"><b>${isReceipt ? 'Người nộp tiền' : 'Người nhận tiền'}</b><br/>(Ký, họ tên)</div>
        </div>
      </body>
    </html>
  `;
};
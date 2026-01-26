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

  const oldDebt = Number(order.old_debt || 0);
  const currentTotal = Number(order.final_amount || 0);
  const totalPayable = currentTotal + oldDebt;

  const qrAmount = totalPayable > 0 ? totalPayable : currentTotal;
  const qrContent = `TT ${order.code}`; 
  const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${BANK_ACCOUNT}-qr_only.png?amount=${qrAmount}&addInfo=${encodeURIComponent(qrContent)}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;

  const rows = order.items?.map((item: any, index: number) => `
    <tr>
      <td style="text-align: center;">${index + 1}</td>
      <td>
        <div style="font-weight: bold;">${item.product_name || item.product?.name || item.name || 'Sản phẩm'}</div>
        ${item.note ? `<div style="font-style: italic; font-size: 11px;">(${item.note})</div>` : ''}
      </td>
      <td style="text-align: center;">${item.uom || item.unit}</td>
      <td style="text-align: center;">${item.quantity}</td>
      <td style="text-align: right;">${Number(item.unit_price || item.price).toLocaleString()}</td>
      <td style="text-align: right;">${Number(item.total_line || (item.quantity * (item.unit_price || item.price))).toLocaleString()}</td>
    </tr>
  `).join('') || '';

  return `
    <html>
      <head>
        <title>In Đơn Hàng ${order.code}</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 12px; line-height: 1.3; padding: 20px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
          .company-name { font-size: 14px; font-weight: bold; text-transform: uppercase; color: #000; }
          .title { text-align: center; font-size: 26px; font-weight: bold; margin: 10px 0; text-transform: uppercase; }
          
          /* Bố cục 2 cột ở Footer */
          .bottom-section { display: flex; gap: 20px; margin-top: 20px; border-top: 2px solid #ddd; padding-top: 15px; }
          .qr-col { width: 40%; text-align: center; border-right: 1px dashed #ccc; }
          .total-col { width: 60%; }
          
          .total-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }
          .final-row { font-weight: bold; font-size: 18px; border-top: 1px solid #000; padding-top: 10px; margin-top: 5px; color: #003a78; }
          
          /* Table styles giữ nguyên */
          .info-table { width: 100%; margin-bottom: 15px; }
          .info-table td { padding: 4px 0; vertical-align: top; }
          .product-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .product-table th, .product-table td { border: 1px solid #000; padding: 6px; }
          .product-table th { background-color: #f0f0f0; text-align: center; font-weight: bold; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; text-align: center; }
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

        <table class="product-table">
          <thead>
            <tr>
              <th width="5%">STT</th>
              <th>Tên hàng hóa, quy cách</th>
              <th width="10%">ĐVT</th>
              <th width="10%">SL</th>
              <th width="15%">Đơn giá</th>
              <th width="15%">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="bottom-section">
            <div class="qr-col">
                <div style="font-weight: bold; margin-bottom: 5px; font-size: 12px;">QUÉT MÃ THANH TOÁN</div>
                <img src="${qrUrl}" width="120" height="120" style="border: 1px solid #ddd; padding: 2px;"/>
                <div style="font-size: 11px; margin-top: 5px; color: #666;">
                    ${BANK_ID} - ${BANK_ACCOUNT}<br/>
                    ${ACCOUNT_NAME}
                </div>
            </div>

            <div class="total-col">
                <div class="total-row"><span>Cộng tiền hàng:</span> <span>${Number(order.total_amount || 0).toLocaleString()} ₫</span></div>
                <div class="total-row"><span>Chiết khấu:</span> <span>- ${Number(order.discount_amount || 0).toLocaleString()} ₫</span></div>
                <div class="total-row"><span>Phí vận chuyển:</span> <span>+ ${Number(order.shipping_fee || 0).toLocaleString()} ₫</span></div>
                
                <div style="border-top: 1px dashed #ccc; margin: 10px 0;"></div>
                
                <div class="total-row" style="font-weight: bold;">
                    <span>Thanh toán đơn này:</span> 
                    <span>${Number(order.final_amount || 0).toLocaleString()} ₫</span>
                </div>

                <div class="total-row" style="color: ${Number(order.old_debt || 0) > 0 ? '#d4380d' : '#888'};">
                    <span>Nợ cũ (Cộng dồn):</span> 
                    <span>${Number(order.old_debt || 0).toLocaleString()} ₫</span>
                </div>
                
                <div class="total-row final-row" style="font-size: 16px; border-top: 2px solid #000; margin-top: 8px; padding-top: 8px;">
                    <span>TỔNG CỘNG PHẢI TRẢ:</span> 
                    <span>${(Number(order.final_amount || 0) + Number(order.old_debt || 0)).toLocaleString()} ₫</span>
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
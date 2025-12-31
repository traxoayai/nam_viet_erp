// Config tài khoản ngân hàng nhận tiền (Sau này đưa vào Setting)
const BANK_ID = "MB"; // Ví dụ: MB, VCB, TPB
const BANK_ACCOUNT = "0000123456789"; 
const ACCOUNT_NAME = "NHÀ THUỐC NAM VIỆT";

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
// 2. IN HDSD (TEM DÁN) - [FIXED VERSION]
export const printInstruction = (drugName: string, instruction: string | string[]) => {
  if (!instruction || (Array.isArray(instruction) && instruction.length === 0)) return;

  // [FIX LOGIC]: Chuẩn hóa đầu vào
  // Nếu là Mảng (do Select tags) -> Nối lại thành chuỗi.
  // Nếu là Chuỗi -> Giữ nguyên.
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
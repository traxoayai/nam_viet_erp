// src/shared/templates/transferTemplate.ts
import dayjs from "dayjs";

import { TransferDetail } from "@/features/inventory/types/transfer";

export const generateTransferHTML = (data: TransferDetail): string => {
  const itemsRows = data.items
    .map(
      (item, index) => `
        <tr>
            <td style="text-align: center;">${index + 1}</td>
            <td>
                <div class="product-name">${item.product_name || "---"}</div>
                <div class="sku">${item.sku || ""}</div>
            </td>
            <td style="text-align: center;">${item.uom || "---"}</td>
            <td style="text-align: right;">${item.quantity_requested}</td>
            <td style="text-align: right; font-weight: bold;">${item.quantity_shipped ?? 0}</td>
            <td></td> 
        </tr>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Phiếu Chuyển Kho - ${data.code}</title>
        <style>
            body { font-family: 'Times New Roman', Times, serif; padding: 20px; color: #000; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 14px; }
            .meta-col { width: 48%; }
            .meta-row { margin-bottom: 8px; }
            .label { font-weight: bold; min-width: 100px; display: inline-block; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
            th, td { border: 1px solid #333; padding: 8px; }
            th { background-color: #f0f0f0; text-align: center; font-weight: bold; }
            
            .sku { font-size: 11px; color: #555; font-style: italic; }
            
            .footer { display: flex; justify-content: space-between; margin-top: 50px; text-align: center; }
            .signature-box { width: 30%; }
            .signature-line { margin-top: 60px; border-top: 1px dashed #999; width: 80%; margin-left: auto; margin-right: auto; }
            
            @media print {
                @page { size: A4; margin: 1cm; }
                body { padding: 0; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Phiếu Chuyển Kho</h1>
            <div>Mã phiếu: <b>${data.code}</b></div>
            <div>Ngày tạo: ${dayjs(data.created_at).format("DD/MM/YYYY HH:mm")}</div>
        </div>

        <div class="meta">
            <div class="meta-col">
                <div class="meta-row">
                    <span class="label">Kho xuất:</span> ${data.source_warehouse_name}
                </div>
                <div class="meta-row">
                    <span class="label">Người lập:</span> ${data.creator_name || "Admin"}
                </div>
            </div>
            <div class="meta-col">
                <div class="meta-row">
                    <span class="label">Kho nhập:</span> ${data.dest_warehouse_name}
                </div>
                <div class="meta-row">
                    <span class="label">Ghi chú:</span> ${data.note || "---"}
                </div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th width="40">STT</th>
                    <th>Tên Hàng hóa</th>
                    <th width="60">ĐVT</th>
                    <th width="80">Yêu cầu</th>
                    <th width="80">Thực xuất</th>
                    <th width="100">Ghi chú</th>
                </tr>
            </thead>
            <tbody>
                ${itemsRows}
            </tbody>
        </table>

        <div class="meta-row" style="text-align: right; margin-top: 10px; font-style: italic;">
            Tổng cộng: <b>${data.items.length}</b> mặt hàng
        </div>

        <div class="footer">
            <div class="signature-box">
                <div><b>Người Lập Phiếu</b></div>
                <div>(Ký, ghi rõ họ tên)</div>
            </div>
            <div class="signature-box">
                <div><b>Thủ Kho Xuất</b></div>
                <div>(Ký, ghi rõ họ tên)</div>
            </div>
            <div class="signature-box">
                <div><b>Người Nhận Hàng</b></div>
                <div>(Ký, ghi rõ họ tên)</div>
            </div>
        </div>
    </body>
    </html>
    `;
};

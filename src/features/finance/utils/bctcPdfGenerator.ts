import { jsPDF } from 'jspdf';
import type { BalanceSheetRow } from '../api/financialReportsService';

export interface BctcPdfData {
  period: string; // YYYYMM
  year: number;
  month: number;
  companyName: string;
  lines: BalanceSheetRow[];
}

/**
 * Generate PDF for BCTC Balance Sheet (B01a-DNN format)
 * - Headers with company name, period
 * - Table with columns: Chỉ Tiêu, Mã Số, Giá Trị (VND)
 * - Vietnamese number formatting
 */
export async function generateBctcPdf(data: BctcPdfData): Promise<Blob> {
  const doc = new jsPDF();

  // ─── Header ───────────────────────────────────────────────────────────────

  doc.setFontSize(16);
  doc.text('BẢNG CÂN ĐỐI KẾ TOÁN (B01a-DNN)', 105, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.text(`Tháng ${data.month} năm ${data.year}`, 105, 25, { align: 'center' });
  doc.text(`Công ty: ${data.companyName}`, 20, 35);

  // ─── Simple table manually (without autoTable) ────────────────────────────

  let yPos = 45;
  const lineHeight = 8;
  const col1X = 20;
  const col2X = 130;
  const col3X = 165;

  // Header
  doc.setFont('Helvetica', 'bold');
  doc.text('Chỉ Tiêu', col1X, yPos);
  doc.text('Mã Số', col2X, yPos);
  doc.text('Giá Trị (VND)', col3X, yPos, { align: 'right' });

  yPos += lineHeight;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);

  // Body rows
  for (const line of data.lines) {
    const formattedValue = new Intl.NumberFormat('vi-VN').format(line.so_tien);
    doc.text(String(line.ten_chi_tieu || ''), col1X, yPos);
    doc.text(String(line.ma_so || ''), col2X, yPos);
    doc.text(formattedValue || '', col3X, yPos, { align: 'right' });
    yPos += lineHeight;
  }

  const blob = doc.output('blob');
  return blob as Blob;
}

/**
 * Download BCTC PDF to user's device
 */
export async function downloadBctcPdf(data: BctcPdfData, filename: string) {
  const blob = await generateBctcPdf(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

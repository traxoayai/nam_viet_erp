import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
// Import worker từ node_modules (Vite syntax)
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

import { BankTransaction } from "@/features/finance/types/finance";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const parseBankStatement = async (file: File): Promise<BankTransaction[]> => {
    let textContent = "";
    const fileType = file.name.split('.').pop()?.toLowerCase();

    // 1. Đọc file (Excel giữ nguyên, PDF đọc dồn text)
    if (['xls', 'xlsx', 'csv'].includes(fileType || '')) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const sheetName = workbook.SheetNames[0];
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        // Excel thì dễ rồi, convert sang string line-by-line
        textContent = json.map((row: any) => row.join(' ')).join('\n');
    } else if (fileType === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const tokenizedText = await page.getTextContent();
            // Nối các từ lại, thêm khoảng trắng để tránh dính chữ
            const pageText = tokenizedText.items.map((item: any) => item.str).join(' ');
            textContent += pageText + " "; // Thêm space cuối trang
        }
    }

    // 2. XỬ LÝ "CỤC VĂN BẢN" (CORE LOGIC)
    const transactions: BankTransaction[] = [];
    
    // Regex tìm điểm bắt đầu của 1 dòng giao dịch: 
    // Mẫu: STT (số) + Space + Ngày (dd/mm/yyyy) + Space + Ngày
    // VD: "1 13/01/2026 13/01/2026"
    // Flag 'g' để tìm tất cả, 'i' không phân biệt hoa thường
    const rowStartRegex = /(\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/g;

    let match;
    const matches: { index: number, fullMatch: string, date: string }[] = [];

    // B1: Tìm tất cả vị trí bắt đầu
    while ((match = rowStartRegex.exec(textContent)) !== null) {
        matches.push({
            index: match.index,
            fullMatch: match[0],
            date: match[2] // Lấy ngày giao dịch (Group 2)
        });
    }

    // B2: Cắt chuỗi dựa trên các vị trí đã tìm
    for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index;
        // Điểm cuối là điểm bắt đầu của dòng tiếp theo, hoặc hết văn bản
        const end = (i < matches.length - 1) ? matches[i + 1].index : textContent.length;
        
        // Chuỗi raw của 1 giao dịch
        const rawLine = textContent.substring(start, end).trim();
        
        // B3: Phân tích nội dung trong dòng raw (Extract tiền & nội dung)
        // Cấu trúc OCB (và nhiều bank): [Đầu] ... Nội Dung ... [Nợ] [Có] [Số dư]
        // Regex tìm 3 số cuối cùng (chấp nhận dấu phẩy ,)
        // VD: ... 0 100,000,000 105,605,259
        const moneyRegex = /([\d,]+)\s+([\d,]+)\s+([\d,]+)$/;
        const moneyMatch = rawLine.match(moneyRegex);

        let credit = 0;
        let debit = 0;
        let description = rawLine;

        if (moneyMatch) {
            // Group 1: Nợ, Group 2: Có, Group 3: Số dư
            const debitStr = moneyMatch[1].replace(/,/g, '');
            const creditStr = moneyMatch[2].replace(/,/g, '');
            
            debit = Number(debitStr);
            credit = Number(creditStr);

            // Loại bỏ phần tiền khỏi nội dung để description sạch đẹp
            // Đồng thời loại bỏ cả phần đầu (STT Ngày Ngày MãGD) nếu muốn
            description = rawLine.replace(moneyRegex, '').trim();
            
            // Cleanup description (Bỏ STT và Ngày ở đầu)
            description = description.replace(/^(\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\w+)?\s*/, '');
        }

        // Chỉ lấy giao dịch CÓ TIỀN VÀO (Credit > 0) hoặc tất cả tùy Sếp
        // Ở đây ta lấy hết để hiển thị, user tự lọc
        transactions.push({
            key: `trans_${i}`,
            date: matches[i].date,
            amount: credit, // Tiền vào (để đối soát đơn bán hàng)
            debit: debit,   // Tiền ra (nếu muốn đối soát chi phí)
            description: description,
            raw_line: rawLine
        });
    }

    return transactions;
};
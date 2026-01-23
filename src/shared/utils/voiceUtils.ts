// src/shared/utils/voiceUtils.ts
// Map số tiếng Việt sang số học
const numberMap: { [key: string]: number } = {
    'không': 0, 'một': 1, 'mốt': 1, 'hai': 2, 'ba': 3, 'bốn': 4, 'năm': 5, 'lăm': 5, 'nhăm': 5,
    'sáu': 6, 'bảy': 7, 'tám': 8, 'chín': 9, 'mười': 10, 'chục': 10,
    'trăm': 100, 'nghìn': 1000, 'ngàn': 1000, 'lẻ': 0
};

export const textToNumber = (text: string): number | null => {
    if (!text) return null;
    const lowerText = text.toLowerCase().trim();
    
    // 1. Nếu chuỗi chứa số (VD: "5", "10")
    const matchNumber = lowerText.match(/\d+/);
    if (matchNumber) return parseInt(matchNumber[0], 10);

    // 2. Xử lý văn bản (VD: "ba mươi lăm")
    const words = lowerText.split(/\s+/);
    let total = 0;
    let current = 0;
    let hasNumber = false;

    for (const word of words) {
        if (numberMap[word] !== undefined) {
            hasNumber = true;
            const val = numberMap[word];
            if (val === 100 || val === 1000) {
                current = (current === 0 ? 1 : current) * val;
                if (val === 1000) { // Khi gặp nghìn, cộng vào total và reset current
                    total += current;
                    current = 0;
                }
            } else if (val === 10) {
                current = (current === 0 ? 1 : current) * 10;
            } else {
                current += val;
            }
        } else if (current > 0 && word !== 'và') {
             // Nếu gặp từ không phải số (mà ko phải 'và') -> Kết thúc cụm số
             break; 
        }
    }
    total += current;
    return hasNumber ? total : null;
};

export const parseVoiceCommand = (transcript: string) => {
    const text = transcript.toLowerCase();

    // 1. Lệnh điều hướng
    if (text.includes('tiếp') || text.includes('bỏ qua') || text.includes('next') || text.includes('qua đi')) return { type: 'NEXT' };
    if (text.includes('đủ') || text.includes('ok') || text.includes('chuẩn') || text.includes('khớp') || text.includes('xong')) return { type: 'CONFIRM' };
    if (text.includes('hoàn tất kiểm kê') || text.includes('chốt phiếu')) return { type: 'COMPLETE' };

    // 2. Lệnh nhập liệu
    let boxQty: number | null = null;
    let unitQty: number | null = null;

    // Chiến thuật: Tách câu theo từ khóa "lẻ" hoặc các đơn vị nhỏ
    // Ví dụ: "5 hộp 3 vỉ" hoặc "5 hộp lẻ 3"
    
    // Từ khóa đơn vị lớn (Mở rộng)
    const largeKeywords = ['hộp', 'thùng', 'chai', 'lọ', 'tuýp', 'cái', 'chiếc', 'bộ', 'quyển', 'bao', 'kiện'];
    // Từ khóa đơn vị nhỏ
    const smallKeywords = ['viên', 'vỉ', 'ống', 'gói', 'lẻ', 'ml', 'gam', 'gram', 'miếng'];

    const words = text.split(' ');

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        
        // Kiểm tra đơn vị Lớn
        if (largeKeywords.includes(word)) {
            // Tìm số NGAY TRƯỚC nó (ưu tiên) hoặc 2 từ trước
            const num1 = textToNumber(words[i-1] || '');
            const num2 = textToNumber((words[i-2] || '') + ' ' + (words[i-1] || ''));
            if (num2 !== null) boxQty = num2; // Ưu tiên cụm từ ghép (ba mươi)
            else if (num1 !== null) boxQty = num1;
        }

        // Kiểm tra đơn vị Nhỏ
        if (smallKeywords.includes(word)) {
            // Đặc biệt: Nếu nói "lẻ 3" -> số nằm SAU từ "lẻ"
            if (word === 'lẻ') {
                const numAfter = textToNumber(words[i+1] || '');
                if (numAfter !== null) unitQty = numAfter;
            } else {
                // Logic cũ: Số nằm TRƯỚC đơn vị
                const num1 = textToNumber(words[i-1] || '');
                const num2 = textToNumber((words[i-2] || '') + ' ' + (words[i-1] || ''));
                if (num2 !== null) unitQty = num2;
                else if (num1 !== null) unitQty = num1;
            }
        }
    }

    // Fallback: Nếu chỉ nói 1 số duy nhất (VD: "năm") -> Mặc định là Hộp (Box)
    if (boxQty === null && unitQty === null) {
        const singleNum = textToNumber(text);
        if (singleNum !== null) {
            boxQty = singleNum;
        }
    }

    if (boxQty !== null || unitQty !== null) {
        return { type: 'UPDATE', box: boxQty, unit: unitQty };
    }

    return { type: 'UNKNOWN' };
};

export const parseLocationVoice = (transcript: string) => {
    const text = transcript.toLowerCase();
    
    // Regex bắt các pattern phổ biến
    // Ví dụ: "Tủ A tầng 2 ô 3", "Kệ 5 hàng 1 hộc 10"
    
    const cabinetRegex = /(?:tủ|kệ|khu|cabinet)\s*([a-z0-9\-\.]+)/i;
    const rowRegex = /(?:tầng|hàng|dãy|row)\s*([a-z0-9\-\.]+)/i;
    const slotRegex = /(?:ô|hộc|vị trí|slot)\s*([a-z0-9\-\.]+)/i;

    const cabinetMatch = text.match(cabinetRegex);
    const rowMatch = text.match(rowRegex);
    const slotMatch = text.match(slotRegex);

    return {
        cabinet: cabinetMatch ? cabinetMatch[1].toUpperCase() : null, // Tự uppercase cho đẹp
        row: rowMatch ? rowMatch[1].toUpperCase() : null,
        slot: slotMatch ? slotMatch[1].toUpperCase() : null,
        hasMatch: !!(cabinetMatch || rowMatch || slotMatch)
    };
};

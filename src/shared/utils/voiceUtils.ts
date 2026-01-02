// Map số tiếng Việt sang số học
const numberMap: { [key: string]: number } = {
    'không': 0, 'một': 1, 'hai': 2, 'ba': 3, 'bốn': 4, 'năm': 5, 'lăm': 5,
    'sáu': 6, 'bảy': 7, 'tám': 8, 'chín': 9, 'mười': 10, 'chục': 10,
    'trăm': 100, 'nghìn': 1000
};

// Hàm chuyển chuỗi "ba mươi lăm" -> 35
export const textToNumber = (text: string): number | null => {
    const lowerText = text.toLowerCase();
    
    // Nếu là số dạng "10", "5" -> Trả về luôn
    if (!isNaN(Number(lowerText))) return Number(lowerText);

    // Xử lý văn bản
    let total = 0;
    let current = 0;
    const words = lowerText.split(' ');
    let hasNumber = false;

    words.forEach(word => {
        if (numberMap[word] !== undefined) {
            hasNumber = true;
            const val = numberMap[word];
            if (val === 100 || val === 1000) {
                current = (current === 0 ? 1 : current) * val;
            } else if (val === 10) {
                current = (current === 0 ? 1 : current) * 10;
            } else {
                current += val;
            }
        } else if (current > 0) {
            total += current;
            current = 0;
        }
    });
    total += current;
    
    return hasNumber ? total : null;
};

// Hàm phân tích ý định (Intent)
export const parseVoiceCommand = (transcript: string) => {
    const text = transcript.toLowerCase();

    // 1. Lệnh điều hướng
    if (text.includes('tiếp') || text.includes('bỏ qua') || text.includes('next')) return { type: 'NEXT' };
    if (text.includes('đủ') || text.includes('ok') || text.includes('chuẩn') || text.includes('khớp')) return { type: 'CONFIRM' };
    if (text.includes('xong') || text.includes('hoàn tất')) return { type: 'COMPLETE' };

    // 2. Lệnh nhập liệu (Hộp/Vỉ)
    // Regex tìm mẫu: "5 hộp", "3 vỉ", "10 lọ"
    // Hỗ trợ cả số (5) và chữ (năm)
    let boxQty = null;
    let unitQty = null;

    // Tách câu thành các cụm để xử lý (VD: "3 hộp và 2 vỉ")
    // Logic đơn giản: Tìm từ khóa đơn vị, rồi nhìn ngược lại từ phía trước để tìm số
    
    const words = text.split(' ');
    
    words.forEach((word, index) => {
        // Tìm đơn vị chẵn
        if (['hộp', 'thùng', 'chai', 'lọ', 'tuýp'].includes(word)) {
            // Lấy 2 từ trước đó để check số (VD: "ba mươi" hộp, hoặc "5" hộp)
            const prevWords = words.slice(Math.max(0, index - 3), index).join(' ');
            const num = textToNumber(prevWords) || textToNumber(words[index-1]); // Check cụm hoặc check từ đơn
            if (num !== null) boxQty = num;
        }
        
        // Tìm đơn vị lẻ
        if (['viên', 'vỉ', 'ống', 'gói', 'lẻ'].includes(word)) {
            const prevWords = words.slice(Math.max(0, index - 3), index).join(' ');
            const num = textToNumber(prevWords) || textToNumber(words[index-1]);
            if (num !== null) unitQty = num;
        }
    });

    if (boxQty !== null || unitQty !== null) {
        return { type: 'UPDATE', box: boxQty, unit: unitQty };
    }

    return { type: 'UNKNOWN' };
};

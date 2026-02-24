// 1. Hàm chuẩn hóa chuỗi (Bỏ dấu tiếng Việt, bỏ ký tự đặc biệt, về chữ thường)
export const normalizeString = (str: string): string => {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD") // Tách dấu ra khỏi ký tự
    .replace(/[\u0300-\u036f]/g, "") // Xóa dấu
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\s]/g, "") // Chỉ giữ lại chữ và số
    .trim();
};

// 2. Hàm chấm điểm tương đồng (Jaccard Index - Dựa trên tập hợp từ)
// Điểm từ 0 đến 1. (1 là giống hệt, 0 là khác hoàn toàn)
export const calculateSimilarity = (s1: string, s2: string): number => {
  const norm1 = normalizeString(s1);
  const norm2 = normalizeString(s2);

  // Tách chuỗi thành mảng các từ (tokens)
  const tokens1 = new Set(norm1.split(/\s+/));
  const tokens2 = new Set(norm2.split(/\s+/));

  // Tìm giao điểm (Các từ xuất hiện ở cả 2 bên)
  const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));

  // Tìm hợp điểm (Tổng số từ duy nhất của cả 2)
  const union = new Set([...tokens1, ...tokens2]);

  if (union.size === 0) return 0;

  // Công thức Jaccard: Giao / Hợp
  return intersection.size / union.size;
};

// 3. Hàm Tìm Sản phẩm khớp nhất trong danh sách
export const findBestMatch = (
  excelName: string,
  systemProducts: any[],
  threshold = 0.3 // Ngưỡng tối thiểu để coi là có liên quan
) => {
  let bestMatch = null;
  let highestScore = 0;

  for (const product of systemProducts) {
    const score = calculateSimilarity(excelName, product.name);

    // Nếu điểm cao hơn kỷ lục hiện tại -> Ghi nhận
    if (score > highestScore) {
      highestScore = score;
      bestMatch = product;
    }
  }

  // Chỉ trả về nếu vượt qua ngưỡng (để tránh gợi ý linh tinh)
  return highestScore >= threshold
    ? { product: bestMatch, score: highestScore }
    : { product: null, score: 0 };
};

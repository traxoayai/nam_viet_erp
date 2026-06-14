/**
 * Tiện ích xử lý URL Cloudinary
 * Tự động thêm tham số f_auto (tự động chọn định dạng webp/avif)
 * và q_auto (tự động nén chất lượng) để tối ưu dung lượng ảnh
 */

export const getOptimizedCloudinaryUrl = (originalUrl: string): string => {
  if (!originalUrl) return "";

  // Nếu url không phải từ cloudinary, trả về nguyên bản
  if (!originalUrl.includes("cloudinary.com")) {
    return originalUrl;
  }

  // Nếu url đã có chứa f_auto hoặc q_auto rồi thì không chèn thêm nữa
  if (originalUrl.includes("f_auto") || originalUrl.includes("q_auto")) {
    return originalUrl;
  }

  // Chèn f_auto,q_auto vào sau thư mục 'upload/'
  return originalUrl.replace("upload/", "upload/f_auto,q_auto/");
};

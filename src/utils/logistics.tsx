// src/utils/logistics.tsx

// Định nghĩa kiểu dữ liệu cho record để TypeScript hiểu
interface LogisticsRecord {
  quantity: number;
  product?: {
    items_per_carton?: number;
  };
  // Cho phép các trường khác
  [key: string]: any;
}

/**
 * Hàm quy đổi số lượng lẻ sang quy cách đóng gói
 * @param quantity Tổng số lượng (Đơn vị cơ bản)
 * @param itemsPerCarton Số lượng trong 1 thùng (Mặc định là 1)
 * @returns Chuỗi hiển thị (Ví dụ: "3 Thùng + 6 Hộp")
 */
export const formatPackingString = (
  quantity: number,
  itemsPerCarton: number = 1
): string => {
  if (!quantity) return "0";
  // Nếu quy cách không hợp lệ hoặc = 1, trả về số lượng gốc
  if (!itemsPerCarton || itemsPerCarton <= 1) return `${quantity}`;

  const cartons = Math.floor(quantity / itemsPerCarton);
  const loose = quantity % itemsPerCarton;

  if (cartons === 0) return `${loose}`; // Chỉ có hàng lẻ
  if (loose === 0) return `${cartons} Thùng`; // Chẵn thùng

  return `${cartons} Thùng + ${loose}`; // Hỗn hợp
};

/**
 * Hàm render cho Ant Design Table Column
 * Trả về ReactNode (JSX) nên file cần có đuôi .tsx
 */
export const renderPackingColumn = (record: LogisticsRecord) => {
  const qty = record.quantity || 0;
  // Lấy items_per_carton từ record.product (nếu có) hoặc mặc định là 1
  const packSize = record.product?.items_per_carton || 1;

  return (
    <div>
      <div className="font-bold text-gray-800">{qty.toLocaleString()}</div>
      <div className="text-xs text-blue-600">
        ({formatPackingString(qty, packSize)})
      </div>
    </div>
  );
};

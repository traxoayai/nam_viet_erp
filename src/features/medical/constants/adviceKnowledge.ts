// src/features/medical/constants/adviceKnowledge.ts

export const ADVICE_TEMPLATES = [
  {
    // Nhóm Tiêu hóa / Dạ dày
    keywords: [
      "dạ dày",
      "trào ngược",
      "gerd",
      "tiêu hóa",
      "tá tràng",
      "đại tràng",
    ],
    suggestions: [
      "Kiêng tuyệt đối đồ chua, cay nóng, nhiều dầu mỡ.",
      "Không ăn quá no, nên chia nhỏ bữa ăn trong ngày.",
      "Tuyệt đối không thức khuya sau 23h, giảm căng thẳng.",
      "Kê cao gối hoặc nằm nghiêng trái khi ngủ (nếu trào ngược).",
      "Không nằm ngay sau khi ăn (chờ ít nhất 2 tiếng).",
    ],
  },
  {
    // Nhóm Cơ Xương Khớp / Gout
    keywords: ["khớp", "thoái hóa", "cột sống", "gút", "gout", "thần kinh tọa"],
    suggestions: [
      "Hạn chế đi lại nhiều, không mang vác vật nặng.",
      "Kiêng ăn nội tạng động vật, hải sản, thịt đỏ (nếu Gout).",
      "Tuyệt đối không uống bia rượu trong đợt đau cấp.",
      "Chườm ấm vùng khớp đau 15-20 phút/ngày.",
      "Tập thể dục nhẹ nhàng không ráng sức (bơi lội, đạp xe).",
    ],
  },
  {
    // Nhóm Hô hấp / Cảm cúm / Viêm họng
    keywords: ["ho", "cúm", "viêm họng", "amidan", "phế quản", "sốt"],
    suggestions: [
      "Uống nhiều nước ấm, súc miệng nước muối sinh lý sáng/tối.",
      "Giữ ấm cổ ngực, đeo khẩu trang khi ra ngoài.",
      "Tăng cường trái cây giàu Vitamin C (Cam, bưởi, ổi).",
      "Tránh ăn đồ lạnh, nước đá.",
      "Theo dõi nhiệt độ, uống hạ sốt nếu trên 38.5 độ.",
    ],
  },
  {
    // Nhóm Tim mạch / Huyết áp
    keywords: ["huyết áp", "tim", "mỡ máu", "lipid"],
    suggestions: [
      "Ăn nhạt (giảm muối, mắm, nước tương).",
      "Hạn chế mỡ động vật, đồ chiên xào, ưu tiên đồ luộc.",
      "Đo huyết áp hằng ngày vào một giờ cố định.",
      "Tập thể dục đều đặn 30 phút/ngày.",
      "Tránh thay đổi tư thế quá đột ngột.",
    ],
  },
  {
    // Nhóm Tiểu đường
    keywords: ["đái tháo đường", "tiểu đường", "đường huyết"],
    suggestions: [
      "Kiêng đồ ngọt, bánh kẹo, nước mọt có gas.",
      "Giảm tinh bột trắng, ưu tiên gạo lứt, ngũ cốc nguyên cám.",
      "Chia nhỏ bữa ăn, không để bụng quá đói hoặc quá no.",
      "Kiểm tra đường huyết định kỳ theo lịch dặn.",
      "Chăm sóc và giữ gìn bàn chân cẩn thận, tránh trầy xước.",
    ],
  },
  {
    // Nhóm Nhi khoa (Sốt, Tiêu chảy trẻ em)
    keywords: [
      "tiêu chảy",
      "nhiễm siêu vi",
      "tay chân miệng",
      "rối loạn tiêu hóa nhi",
    ],
    suggestions: [
      "Cho bé uống bù Oresol từng ngạch nhỏ liên tục.",
      "Tiếp tục cho bú mẹ hoặc ăn thức ăn lỏng, dễ tiêu.",
      "Vệ sinh tay sạch sẽ trước khi ăn và sau khi đi vệ sinh.",
      "Nếu bé nôn nhiều, lừ đừ, không uống được cần nhập viện ngay.",
    ],
  },
];

// Lời dặn mặc định nếu không khớp bệnh nào
export const DEFAULT_ADVICE = [
  "Uống thuốc đúng giờ, đủ liều theo đơn.",
  "Tuyệt đối không tự ý ngưng thuốc khi chưa có ý kiến bác sĩ.",
  "Tái khám ngay nếu có dấu hiệu bất thường (sốt cao, nôn ói, mẩn ngứa).",
  "Uống đủ 2 lít nước mỗi ngày, nghỉ ngơi hợp lý.",
];

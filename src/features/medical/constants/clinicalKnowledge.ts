// src/features/medical/constants/clinicalKnowledge.ts

export const CLINICAL_RED_FLAGS = {
  GI: {
    title: "Tiêu hóa & Gan mật",
    tags: [
      { id: "gi_1", label: "Tiền sử xuất huyết dạ dày", isDanger: true },
      { id: "gi_2", label: "Đang viêm loét dạ dày tá tràng", isDanger: false },
      { id: "gi_3", label: "Đi ngoài phân đen / dính máu", isDanger: true },
      { id: "gi_4", label: "Viêm gan B/C / Xơ gan", isDanger: true }, // Ảnh hưởng chuyển hóa thuốc
      { id: "gi_5", label: "Thường xuyên ợ hơi, ợ chua", isDanger: false },
    ],
  },
  MSK: {
    title: "Cơ Xương Khớp & Thần kinh",
    tags: [
      { id: "msk_1", label: "Cứng khớp buổi sáng > 30 phút", isDanger: false },
      { id: "msk_2", label: "Tê bì, yếu liệt chi", isDanger: true }, // Nguy cơ chèn ép tủy
      { id: "msk_3", label: "Sốt kèm sưng nóng đỏ khớp", isDanger: true }, // Nhiễm trùng khớp
    ],
  },
  CV: {
    title: "Tim mạch & Nội tiết",
    tags: [
      { id: "cv_1", label: "Đau thắt ngực khi gắng sức", isDanger: true },
      {
        id: "cv_2",
        label: "Tiền sử nhồi máu cơ tim / Đột quỵ",
        isDanger: true,
      },
      { id: "cv_3", label: "Tiểu đường đang dùng thuốc", isDanger: false },
      { id: "cv_4", label: "Nhịp tim nhanh / Hồi hộp", isDanger: false },
    ],
  },
};

// Chuẩn Quyết định 1575/QĐ-BYT của Bộ Y Tế (Rút gọn cho giao diện)
export const VACCINATION_SCREENING = [
  {
    id: "vac_1",
    question:
      "Có tiền sử sốc hoặc phản ứng nặng sau lần tiêm chủng trước không?",
    actionIfYes: "CHỐNG CHỈ ĐỊNH",
    isCritical: true,
  },
  {
    id: "vac_2",
    question: "Đang mắc bệnh cấp tính hoặc sốt cao không?",
    actionIfYes: "TẠM HOÃN",
    isCritical: false,
  },
  {
    id: "vac_3",
    question:
      "Đang dùng thuốc suy giảm miễn dịch (Corticoid liều cao, xạ trị) không?",
    actionIfYes: "CHỐNG CHỈ ĐỊNH (Vaccine sống)",
    isCritical: true,
  },
  {
    id: "vac_4",
    question: "Có tiền sử dị ứng với thành phần của vaccine không?",
    actionIfYes: "CHỐNG CHỈ ĐỊNH",
    isCritical: true,
  },
  {
    id: "vac_5",
    question: "Bé có sinh non (Cân nặng < 2000g) không? (Chỉ áp dụng sơ sinh)",
    actionIfYes: "TẠM HOÃN / CẦN LƯU Ý",
    isCritical: false,
    onlyInfant: true,
  },
];

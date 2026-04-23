/**
 * Extended color palette bổ sung cho antd theme (colorPrimary = #00b96b).
 * Dùng cho các action button cần differentiate khỏi primary hoặc status chips
 * không nằm trong Tag preset.
 *
 * KHÔNG hardcode hex trong component nữa — import từ đây để thống nhất.
 */
export const COLORS = {
  /** "Đã nhận tiền", "Success confirm" actions — đậm hơn colorPrimary để nổi */
  actionSuccess: "#16a34a",
  /** Success subtle — background strip, chip */
  actionSuccessBg: "#dcfce7",
  actionSuccessText: "#166534",

  /** "Chuyển khoản", "Info" actions — khớp antd-blue */
  actionInfo: "#1890ff",

  /** "Cảnh báo" actions — khớp antd-warning */
  actionWarning: "#f59e0b",
  actionWarningBg: "#fef3c7",
  actionWarningText: "#b45309",
} as const;

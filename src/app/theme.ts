// src/theme.ts
import { ThemeConfig } from "antd";

const theme: ThemeConfig = {
  token: {
    // Màu chủ đạo (Primary Color)
    colorPrimary: "#00b96b", // Bo tròn

    borderRadius: 8, // Font chữ

    fontFamily: `"-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"`,
  },
  components: {
    Button: {
      borderRadius: 8,
      controlHeight: 36, // Chiều cao nút trung bình
    },
    Input: {
      borderRadius: 8,
      controlHeight: 36,
    },
    Select: {
      borderRadius: 8,
      controlHeight: 36,
    },
    Card: {
      borderRadius: 8,
      borderRadiusLG: 8,
    },
    Table: {
      borderRadius: 8,
      borderRadiusLG: 8,
    },
  },
};

export default theme;

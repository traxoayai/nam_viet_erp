// eslint.config.js
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginJsxA11y from "eslint-plugin-jsx-a11y";
import pluginImport from "eslint-plugin-import";
import prettierConfig from "eslint-config-prettier";
import pluginPrettier from "eslint-plugin-prettier";

export default [
  // Cấu hình áp dụng toàn cục
  {
    ignores: ["dist", "node_modules", ".vscode", "coverage", ".env"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  // Cấu hình cho các file TypeScript
  ...tseslint.configs.recommended,

  // Cấu hình chuyên biệt cho React
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "jsx-a11y": pluginJsxA11y,
      import: pluginImport,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      ...pluginReact.configs.recommended.rules,
      ...pluginReactHooks.configs.recommended.rules,
      ...pluginJsxA11y.configs.recommended.rules,

      // Các quy tắc tùy chỉnh cho một dự án chuyên nghiệp
      "react/react-in-jsx-scope": "off", // Không cần thiết với React/Vite hiện đại
      "react/prop-types": "off", // TypeScript đã xử lý việc này
      "react/jsx-no-leaked-render": "warn", // Ngăn lỗi render ra số 0 hoặc chuỗi rỗng
      "react-hooks/rules-of-hooks": "error", // Bắt buộc tuân thủ quy tắc của Hooks
      "react-hooks/exhaustive-deps": "warn", // Cảnh báo các dependencies bị thiếu trong useEffect

      // Quy tắc sắp xếp import
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
    },
    settings: {
      react: {
        version: "detect", // Tự động phát hiện phiên bản React
      },
    },
  },

  // Cấu hình Prettier (PHẢI ĐẶT Ở CUỐI CÙNG)
  // Cấu hình này sẽ tắt tất cả các quy tắc của ESLint có thể xung đột với Prettier.
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      prettier: pluginPrettier,
    },
    rules: {
      ...prettierConfig.rules,
      "prettier/prettier": "error", // Báo lỗi của Prettier như là lỗi của ESLint
    },
  },
];

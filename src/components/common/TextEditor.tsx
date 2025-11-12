// src/components/common/TextEditor.tsx
import JoditEditor from "jodit-react";
import { useMemo, forwardRef } from "react";

import type { Jodit } from "jodit";

// Props mà AntD Form.Item sẽ tự động truyền vào
interface TextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
}

// SỬA LỖI: Chúng ta cần "forwardRef" (chuyển tiếp Ref)
// để component cha (TemplateManagerPage) có thể gọi Jodit
const TextEditor = forwardRef<Jodit | null, TextEditorProps>(
  ({ value, onChange }, ref) => {
    // Cấu hình Jodit chung cho toàn hệ thống
    const config = useMemo(
      () => ({
        readonly: false,
        height: 540,
        showRuler: true, // Thêm thước kẻ
        placeholder: "Bắt đầu soạn thảo...",
        buttons: [
          "source",
          "|",
          "bold",
          "italic",
          "underline",
          "|",
          "ul",
          "ol",
          "|",
          "font",
          "fontsize",
          "brush",
          "paragraph",
          "|",
          "align",
          "undo",
          "redo",
          "|",
          "hr",
          "table",
          "link",
          "|",
          "fullsize",
          "preview",
        ],
      }),
      []
    );

    return (
      <JoditEditor // @ts-ignore (Jodit-react ref type có thể xung đột nhẹ, bỏ qua)
        ref={ref}
        value={value || ""}
        config={config} // SỬA LỖI: Dùng onBlur để cập nhật Form (tốt nhất cho hiệu năng)
        onBlur={onChange} // onChange={onChange} // Bỏ onchange để tránh re-render liên tục
      />
    );
  }
);
TextEditor.displayName = "TextEditor";

export default TextEditor;

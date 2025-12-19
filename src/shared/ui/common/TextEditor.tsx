// src/components/common/TextEditor.tsx
import JoditEditor from "jodit-react";
import React, { useMemo } from "react";

// Props mà AntD Form.Item sẽ tự động truyền vào
interface TextEditorProps {
  value?: string;
  onChange?: (value: string) => void; // Dùng onBlur cho AntD Form (hiệu năng)
  onRealtimeChange?: (value: string) => void; // Dùng onChange cho state (tức thì)
}

const TextEditor: React.FC<TextEditorProps> = ({
  value,
  onChange,
  onRealtimeChange,
}) => {
  // Cấu hình Jodit chung cho toàn hệ thống
  const config = useMemo(
    () => ({
      readonly: false,
      height: 540,
      showRuler: true,
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
    <JoditEditor
      value={value || ""}
      config={config} // SỬA LỖI: Dùng onBlur để cập nhật Form (tốt cho hiệu năng)
      onBlur={onChange} // SỬA LỖI: Dùng onChange để cập nhật State xem trước (tức thì)
      onChange={onRealtimeChange}
    />
  );
};

// XÓA BỎ forwardRef và displayName

export default TextEditor;

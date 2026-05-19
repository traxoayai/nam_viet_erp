// Reply box ở chân thread (Plan 2 Task 7).
// - TextArea autoSize 1-4 dòng, placeholder phụ thuộc disabled.
// - Ctrl+Enter / Cmd+Enter để gửi.
// - Trim content; không gửi khi rỗng.
// - Gọi sendSalesReply({ sessionId, content }); clear text sau khi xong.
// - Hiện message.error nếu lỗi.

import { SendOutlined } from "@ant-design/icons";
import { Button, Input, message } from "antd";
import { useState, type KeyboardEvent } from "react";

import { sendSalesReply } from "../../api/inboxApi";

const { TextArea } = Input;

export interface InboxReplyBoxProps {
  sessionId: string;
  disabled?: boolean;
}

export function InboxReplyBox({ sessionId, disabled }: InboxReplyBoxProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || disabled || sending) return;
    setSending(true);
    try {
      await sendSalesReply({ sessionId, content });
      setText("");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Không gửi được tin";
      message.error(errMsg);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div
      style={{
        borderTop: "1px solid #f0f0f0",
        padding: 12,
        display: "flex",
        gap: 8,
        alignItems: "flex-end",
      }}
    >
      <TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        autoSize={{ minRows: 1, maxRows: 4 }}
        placeholder={
          disabled
            ? "Phiên đã đóng"
            : "Nhập tin trả lời khách (Ctrl+Enter để gửi)"
        }
        disabled={disabled || sending}
        style={{ flex: 1 }}
      />
      <Button
        type="primary"
        icon={<SendOutlined />}
        loading={sending}
        disabled={disabled || text.trim().length === 0}
        onClick={() => {
          void handleSend();
        }}
      >
        Gửi
      </Button>
    </div>
  );
}

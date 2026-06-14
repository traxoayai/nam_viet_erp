import { Button, Tooltip, message } from "antd";
import { Mic, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

interface VoiceCommanderProps {
  onCommand: (text: string) => void;
  disabled?: boolean;
}

// Định nghĩa Type cho Web Speech API (vì TS mặc định chưa có đủ)
interface IWindow extends Window {
  webkitSpeechRecognition: unknown;
  SpeechRecognition: unknown;
}

export const VoiceCommander = ({
  onCommand,
  disabled = false,
}: VoiceCommanderProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [recognition, setRecognition] = useState<
    Record<string, unknown> | null
  >(null);

  useEffect(() => {
    // 1. Init Web Speech API (Chỉ chạy trên Chrome/Edge/Safari mới)
    const { webkitSpeechRecognition, SpeechRecognition } =
      window as unknown as IWindow;
    const SpeechApi = (SpeechRecognition || webkitSpeechRecognition) as
      | (new () => Record<string, unknown>)
      | undefined;

    if (!SpeechApi) {
      setIsSupported(false);
      return;
    }

    const rec = new SpeechApi() as Record<string, unknown>;
    rec.continuous = false; // Nghe 1 câu rồi dừng
    rec.lang = "vi-VN"; // Ưu tiên tiếng Việt
    rec.interimResults = false;

    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);
    rec.onerror = (event: unknown) => {
      const err = event as Record<string, unknown>;
      console.error("Voice Error:", err.error);
      setIsListening(false);
    };
    rec.onresult = (event: unknown) => {
      const speechEvent = event as Record<string, unknown>;
      const results = speechEvent.results as Array<Array<{ transcript: string }>>;
      const transcript = results?.[0]?.[0]?.transcript;
      if (transcript) onCommand(transcript);
    };

    setRecognition(rec);
  }, [onCommand]);

  const toggleListening = () => {
    if (!isSupported) {
      message.warning("Trình duyệt không hỗ trợ nhận diện giọng nói!");
      return;
    }
    if (isListening) {
      (recognition?.stop as () => void)?.();
    } else {
      (recognition?.start as () => void)?.();
    }
  };

  if (!isSupported) return null; // Ẩn nếu không hỗ trợ

  return (
    <Tooltip title={isListening ? "Đang nghe..." : "Ra lệnh bằng giọng nói"}>
      <Button
        shape="circle"
        type={isListening ? "primary" : "default"}
        danger={isListening}
        icon={
          isListening ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <Mic size={20} />
          )
        }
        onClick={toggleListening}
        disabled={disabled}
        size="large"
        style={{
          boxShadow: isListening ? "0 0 10px red" : "none",
          transition: "all 0.3s",
        }}
      />
    </Tooltip>
  );
};

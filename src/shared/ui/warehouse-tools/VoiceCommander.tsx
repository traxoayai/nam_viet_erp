import { useState, useEffect } from "react";
import { Button, Tooltip, message } from "antd";
import { Mic, Loader2 } from "lucide-react";

interface VoiceCommanderProps {
  onCommand: (text: string) => void;
  disabled?: boolean;
}

// Định nghĩa Type cho Web Speech API (vì TS mặc định chưa có đủ)
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

export const VoiceCommander = ({
  onCommand,
  disabled = false,
}: VoiceCommanderProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    // 1. Init Web Speech API (Chỉ chạy trên Chrome/Edge/Safari mới)
    const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
    const SpeechApi = SpeechRecognition || webkitSpeechRecognition;

    if (!SpeechApi) {
      setIsSupported(false);
      return;
    }

    const rec = new SpeechApi();
    rec.continuous = false; // Nghe 1 câu rồi dừng
    rec.lang = "vi-VN"; // Ưu tiên tiếng Việt
    rec.interimResults = false;

    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);
    rec.onerror = (event: any) => {
      console.error("Voice Error:", event.error);
      setIsListening(false);
    };
    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onCommand(transcript);
    };

    setRecognition(rec);
  }, [onCommand]);

  const toggleListening = () => {
    if (!isSupported) {
      message.warning("Trình duyệt không hỗ trợ nhận diện giọng nói!");
      return;
    }
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
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
           transition: "all 0.3s"
        }}
      />
    </Tooltip>
  );
};

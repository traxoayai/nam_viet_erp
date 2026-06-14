// src/hooks/useVoiceInput.ts
import { useState, useEffect } from "react";

interface SpeechRecognitionResult {
  stop: () => void;
  start: () => void;
  onresult: (event: Event) => void;
  onerror: (event: Event) => void;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
}

export const useVoiceInput = (onResult: (text: string) => void) => {
  const [isListening, setIsListening] = useState(false);
  let recognition: SpeechRecognitionResult | null = null;

  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    const w = window as unknown as Record<string, unknown>;
    const SpeechRecognition =
      w.SpeechRecognition ||
      w.webkitSpeechRecognition;
    recognition = new (SpeechRecognition as unknown as new () => SpeechRecognitionResult)();
    recognition.lang = "vi-VN";
    recognition.continuous = false;
    recognition.interimResults = false;
  }

  const startListening = () => {
    if (!recognition) return alert("Trình duyệt không hỗ trợ giọng nói.");
    setIsListening(true);
    recognition.start();
  };

  const stopListening = () => {
    if (recognition) recognition.stop();
    setIsListening(false);
  };

  useEffect(() => {
    if (!recognition) return;

    recognition.onresult = (event: Event) => {
      const evt = event as unknown as { results: Array<Array<{ transcript: string }>> };
      const transcript = evt.results[0][0].transcript;
      console.log("Voice Result:", transcript);
      onResult(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: Event) => {
      const evt = event as unknown as { error: string };
      console.error("Voice Error:", evt.error);
      setIsListening(false);
    };
  }, []);

  return { isListening, startListening, stopListening };
};

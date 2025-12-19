// src/hooks/useVoiceInput.ts
import { useState, useEffect } from "react";

export const useVoiceInput = (onResult: (text: string) => void) => {
  const [isListening, setIsListening] = useState(false);
  let recognition: any = null;

  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    recognition = new SpeechRecognition();
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

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      console.log("Voice Result:", transcript);
      onResult(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Voice Error:", event.error);
      setIsListening(false);
    };
  }, []);

  return { isListening, startListening, stopListening };
};

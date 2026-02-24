import { Modal, Button, message, Spin, Grid, Typography } from "antd";
import { Camera, X, RefreshCw } from "lucide-react";
import { useRef, useState, useEffect } from "react";

import { inventoryService } from "@/features/inventory/api/inventoryService";

const { useBreakpoint } = Grid;
const { Text } = Typography;

interface AIVisionCameraProps {
  visible: boolean;
  onClose: () => void;
  onResult: (data: any) => void;
}

export const AIVisionCamera = ({
  visible,
  onClose,
  onResult,
}: AIVisionCameraProps) => {
  const screens = useBreakpoint();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 1. Khởi động Camera khi Modal mở
  useEffect(() => {
    if (visible) {
      startCamera();
    } else {
      stopCamera();
    }
    // Cleanup
    return () => stopCamera();
  }, [visible]);

  const startCamera = async () => {
    setErrorMsg("");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // Ưu tiên cam sau
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(
        "Không thể truy cập Camera. Vui lòng kiểm tra quyền hoặc dùng HTTPS."
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  // 2. Chụp ảnh & Gọi AI Service
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set kích thước canvas đúng bằng video thực tế
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to Blob
      canvas.toBlob(
        async (blob) => {
          if (blob) {
            await processImage(blob);
          } else {
            message.error("Lỗi chụp ảnh");
          }
        },
        "image/jpeg",
        0.9
      );
    }
  };

  const processImage = async (blob: Blob) => {
    setScanning(true);
    try {
      // Tạo File object từ Blob
      const file = new File([blob], "vis_scan.jpg", { type: "image/jpeg" });

      // Gọi Service có sẵn
      const result = await inventoryService.scanProductLabel(file);

      message.success("Đã quét thông tin thành công!");
      onResult(result);
      onClose(); // Đóng modal sau khi xong
    } catch (error) {
      console.error("AI Scan Error:", error);
      message.error("Không thể nhận diện ảnh. Vui lòng thử lại.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      centered
      closable={false}
      width="100%"
      style={{ maxWidth: 600, top: screens.md ? 20 : 0, padding: 0 }}
      bodyStyle={{
        padding: 0,
        background: "#000",
        height: "80vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Nút đóng */}
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 10 }}>
        <Button shape="circle" icon={<X size={20} />} onClick={onClose} />
      </div>

      {/* Màn hình Video */}
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {errorMsg ? (
          <div style={{ color: "white", padding: 20, textAlign: "center" }}>
            <p>{errorMsg}</p>
            <Button onClick={startCamera} icon={<RefreshCw size={16} />}>
              Thử lại
            </Button>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </div>

      {/* Overlay Guide (Khung canh chụp) */}
      {!errorMsg && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "80%",
            height: "30%",
            border: "2px dashed rgba(255, 255, 255, 0.8)",
            borderRadius: 12,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)", // Che mờ phần ngoài
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -30,
              width: "100%",
              textAlign: "center",
              color: "#fff",
            }}
          >
            <Text style={{ color: "#fff" }}>Đưa nhãn sản phẩm vào khung</Text>
          </div>
        </div>
      )}

      {/* Nút Chụp Ảnh */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          width: "100%",
          textAlign: "center",
          zIndex: 10,
        }}
      >
        <Spin spinning={scanning} tip="Đang phân tích...">
          <Button
            type="primary"
            shape="circle"
            size="large"
            style={{
              width: 72,
              height: 72,
              background: "#fff",
              border: "4px solid rgba(0,0,0,0.2)",
            }}
            onClick={handleCapture}
            disabled={!!errorMsg || scanning}
            icon={<Camera size={32} color="#000" />}
          />
        </Spin>
      </div>

      {/* Canvas ẩn để xử lý ảnh */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </Modal>
  );
};

// src/pages/finance/invoices/InvoiceUploadModal.tsx
import {
  InboxOutlined,
  ScanOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { Modal, Upload, Steps, App } from "antd";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { invoiceService } from "@/services/invoiceService";
import { useInvoiceStore } from "@/stores/invoiceStore";

const { Dragger } = Upload;
//const { Text } = Typography;

interface Props {
  open: boolean;
  onCancel: () => void;
}

const InvoiceUploadModal: React.FC<Props> = ({ open, onCancel }) => {
  const { message } = App.useApp(); // Dùng Hook message chuẩn

  const navigate = useNavigate();
  const { setScanResult } = useInvoiceStore();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleUpload = async (file: File) => {
    setLoading(true);
    setStep(0);
    try {
      // 1. Upload ảnh lên Storage
      const publicUrl = await invoiceService.uploadInvoiceImage(file);

      setStep(1); // Chuyển icon sang trạng thái AI đang đọc

      // 2. Gọi AI Scan (Cập nhật: Truyền thêm file.type)
      const result = await invoiceService.scanInvoiceWithAI(
        publicUrl,
        file.type
      );

      // 3. Lưu vào Store
      setScanResult({
        ...result,
        file_url: publicUrl,
      });

      setStep(2);
      message.success("AI đã đọc xong hóa đơn!");

      // 4. Chuyển trang sau 0.5s
      setTimeout(() => {
        navigate(`/finance/invoices/verify/${result.invoice_id}`);
      }, 500);
    } catch (error: any) {
      console.error(error);
      message.error(
        "Lỗi xử lý: " + (error.message || "Không xác định. Vui lòng thử lại.")
      );
      setStep(0);
    } finally {
      setLoading(false);
    }
    return false; // Prevent default upload
  };

  return (
    <Modal
      title="Quét Hóa Đơn Thông Minh (AI OCR)"
      open={open}
      onCancel={onCancel}
      footer={null}
      width={600}
      destroyOnClose
    >
      <div style={{ marginBottom: 24 }}>
        <Steps
          current={step}
          items={[
            { title: "Tải ảnh", icon: <InboxOutlined /> },
            {
              title: "AI Phân tích",
              icon: step === 1 ? <LoadingOutlined /> : <ScanOutlined />,
            },
            { title: "Hoàn tất", icon: <CheckCircleOutlined /> },
          ]}
        />
      </div>

      <Dragger
        name="file"
        multiple={false}
        accept=".jpg,.jpeg,.png,.pdf"
        beforeUpload={handleUpload}
        showUploadList={false}
        disabled={loading}
        style={{
          padding: 32,
          background: loading ? "#f5f5f5" : "#fff",
          border: "2px dashed #d9d9d9",
        }}
      >
        <p className="ant-upload-drag-icon">
          {loading ? (
            <ScanOutlined spin style={{ color: "#1890ff" }} />
          ) : (
            <InboxOutlined />
          )}
        </p>
        <p className="ant-upload-text">
          {loading
            ? "Hệ thống đang đọc dữ liệu hóa đơn..."
            : "Nhấp hoặc kéo thả file hóa đơn (Ảnh/PDF) vào đây"}
        </p>
        <p className="ant-upload-hint">
          Hỗ trợ ảnh (JPG, PNG) hoặc PDF. AI sẽ tự động trích xuất thông tin.
        </p>
      </Dragger>
    </Modal>
  );
};

export default InvoiceUploadModal;

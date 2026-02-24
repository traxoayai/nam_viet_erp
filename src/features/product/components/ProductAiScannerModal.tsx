// src/features/product/components/ProductAiScannerModal.tsx
import {
  InboxOutlined,
  RobotOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import {
  Modal,
  Upload,
  Button,
  Steps,
  Card,
  Spin,
  Descriptions,
  Tag,
  Alert,
  message,
} from "antd";
import React, { useState } from "react";

import { aiService } from "../api/aiService";
import { AiExtractedData } from "../types/ai.types";

import type { UploadProps } from "antd";

const { Dragger } = Upload;
const { Step } = Steps;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (data: AiExtractedData) => void; // Callback trả dữ liệu ra ngoài
  mode: "create_new" | "fill_form" | "update_existing";
}

export const ProductAiScannerModal: React.FC<Props> = ({
  open,
  onClose,
  onSuccess,
  mode,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [aiData, setAiData] = useState<AiExtractedData | null>(null);

  // Xử lý Upload
  const uploadProps: UploadProps = {
    name: "file",
    multiple: false,
    showUploadList: false,
    customRequest: async ({ file, onSuccess }) => {
      try {
        setLoading(true);
        setCurrentStep(1); // Chuyển sang bước Phân tích

        // Gọi AI Service
        const result = await aiService.scanProduct(file as File);

        setAiData(result);
        setCurrentStep(2); // Chuyển sang bước Review
        setLoading(false);
        if (onSuccess) onSuccess("ok");
      } catch (error: any) {
        setLoading(false);
        setCurrentStep(0);
        message.error(error.message || "Lỗi phân tích file");
      }
    },
    accept: ".pdf,.jpg,.png,.jpeg",
  };

  // Nút xác nhận cuối cùng
  const handleConfirm = () => {
    if (aiData) {
      onSuccess(aiData);
      handleClose();
    }
  };

  const handleClose = () => {
    setAiData(null);
    setCurrentStep(0);
    setLoading(false);
    onClose();
  };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RobotOutlined style={{ color: "#1890ff", fontSize: 20 }} />
          <span>Trợ lý AI nhập liệu</span>
        </div>
      }
      open={open}
      onCancel={handleClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={handleClose} disabled={loading}>
          Đóng
        </Button>,
        currentStep === 2 && (
          <Button
            key="apply"
            type="primary"
            onClick={handleConfirm}
            icon={<CheckCircleOutlined />}
          >
            {mode === "update_existing" ? "Cập nhật Database" : "Điền vào Form"}
          </Button>
        ),
      ]}
    >
      <Steps current={currentStep} size="small" style={{ marginBottom: 24 }}>
        <Step title="Tải tài liệu" description="PDF/Ảnh SP" />
        <Step title="AI Phân tích" description="Gemini Processing" />
        <Step title="Kiểm tra" description="Xác nhận dữ liệu" />
      </Steps>

      {/* BƯỚC 0: UPLOAD */}
      {currentStep === 0 && (
        <Dragger {...uploadProps} style={{ padding: 40 }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Nhấp hoặc kéo thả file vào đây</p>
          <p className="ant-upload-hint">
            Hỗ trợ file PDF hướng dẫn sử dụng, Catalog hoặc Ảnh chụp bao bì
            thuốc.
          </p>
        </Dragger>
      )}

      {/* BƯỚC 1: LOADING */}
      {currentStep === 1 && (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Spin size="large" tip="AI đang đọc tài liệu và viết bài SEO..." />
        </div>
      )}

      {/* BƯỚC 2: PREVIEW KẾT QUẢ */}
      {currentStep === 2 && aiData ? (
        <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
          <Alert
            message="AI đã trích xuất thành công!"
            description="Vui lòng kiểm tra lại các thông tin quan trọng trước khi áp dụng."
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Descriptions
            title="Thông tin cơ bản"
            bordered
            size="small"
            column={2}
          >
            <Descriptions.Item label="Tên thuốc">
              {aiData.product_name}
            </Descriptions.Item>
            <Descriptions.Item label="SĐK">
              {aiData.registration_number || "N/A"}
            </Descriptions.Item>
            <Descriptions.Item label="Nhà SX">
              {aiData.manufacturer_name}
            </Descriptions.Item>
            <Descriptions.Item label="Hoạt chất">
              {aiData.active_ingredients.map((i, idx) => (
                <Tag key={idx} color="blue">
                  {i.name} ({i.amount})
                </Tag>
              ))}
            </Descriptions.Item>
            <Descriptions.Item label="Quy cách">
              {aiData.packing_spec}
            </Descriptions.Item>
          </Descriptions>

          <Descriptions
            title="Đơn vị tính & Giá gợi ý"
            bordered
            size="small"
            style={{ marginTop: 16 }}
            column={1}
          >
            <Descriptions.Item label="Các đơn vị">
              {aiData.units.map((u, idx) => (
                <div key={idx}>
                  <b>{u.unit_name}</b> ({u.unit_type}) - Quy đổi:{" "}
                  {u.conversion_rate} - Giá: {u.price.toLocaleString()}đ
                </div>
              ))}
            </Descriptions.Item>
          </Descriptions>

          <Card
            title="Nội dung Marketing / SEO (AI Generated)"
            size="small"
            style={{ marginTop: 16, background: "#f9f9f9" }}
          >
            <p>
              <b>Tiêu đề SEO:</b> {aiData.marketing_content?.seo_title}
            </p>
            <p>
              <b>Mô tả ngắn:</b> {aiData.marketing_content?.short_description}
            </p>
            <div
              style={{ border: "1px dashed #ccc", padding: 8, borderRadius: 4 }}
            >
              <div
                dangerouslySetInnerHTML={{
                  __html: aiData.marketing_content?.full_description_html || "",
                }}
              />
            </div>
          </Card>
        </div>
      ) : null}
    </Modal>
  );
};

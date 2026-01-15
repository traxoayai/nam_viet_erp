// src/pages/finance/components/TransactionDetailModal.tsx
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileImageOutlined,
  AuditOutlined,
  FilePdfOutlined,
  FileUnknownOutlined,
  DownloadOutlined,
  EyeOutlined,
  QrcodeOutlined,
} from "@ant-design/icons";
import {
  Modal,
  Descriptions,
  Tag,
  Image,
  Typography,
  Divider,
  Button,
  Empty,
  Space,
} from "antd";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import React from "react";

import { TransactionRecord } from "@/features/finance/types/finance";

dayjs.extend(utc);
dayjs.extend(timezone);

const { Text } = Typography;

interface Props {
  open: boolean;
  onCancel: () => void;
  data: TransactionRecord | null;
}

export const TransactionDetailModal: React.FC<Props> = ({
  open,
  onCancel,
  data,
}) => {
  if (!data) return null;

  const isIncome = data.flow === "in";
  const sign = isIncome ? "+" : "-";
  const color = isIncome ? "#52c41a" : "#f5222d";

  // --- AURA LOGIC: Xử lý hiển thị file đính kèm chuẩn xác ---
  const renderEvidence = () => {
    // 1. Kiểm tra dữ liệu từ CORE
    const url = data.evidence_url;

    if (!url || url.trim() === "") {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<Text type="secondary">Không có chứng từ đính kèm</Text>}
        />
      );
    }

    // 2. Phân loại file dựa trên đuôi mở rộng (Extension)
    // Clean URL trước khi check (bỏ query params nếu có)
    const cleanUrl = url.split("?")[0].toLowerCase();
    const extension = cleanUrl.split(".").pop() || "";

    const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "heic"];
    const isImage = imageExtensions.includes(extension);
    const isPdf = extension === "pdf";

    // 3. Hiển thị theo loại
    if (isImage) {
      return (
        <div
          style={{
            textAlign: "center",
            background: "#f0f2f5",
            padding: 12,
            borderRadius: 8,
          }}
        >
          <Image
            src={url}
            alt="Chứng từ"
            height={300}
            style={{ objectFit: "contain", borderRadius: 4 }}
            fallback="https://placehold.co/400x300/e0e0e0/888888?text=Lỗi+tải+ảnh"
          />
        </div>
      );
    }

    // Nếu là PDF hoặc file khác -> Hiển thị dạng Card tải về
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: 24,
          background: "#f9f9f9",
          border: "1px dashed #d9d9d9",
          borderRadius: 8,
        }}
      >
        <div style={{ marginBottom: 16 }}>
          {isPdf ? (
            <FilePdfOutlined style={{ fontSize: 48, color: "#ff4d4f" }} />
          ) : (
            <FileUnknownOutlined style={{ fontSize: 48, color: "#1890ff" }} />
          )}
        </div>
        <Text strong style={{ fontSize: 16, marginBottom: 4 }}>
          Tài liệu đính kèm ({extension.toUpperCase()})
        </Text>
        <Text
          type="secondary"
          style={{ marginBottom: 16, fontSize: 12, maxWidth: "80%" }}
          ellipsis
        >
          {url.split("/").pop()} {/* Hiển thị tên file */}
        </Text>

        <Space>
          <Button
            type="primary"
            icon={<EyeOutlined />}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Xem tài liệu
          </Button>
          <Button icon={<DownloadOutlined />} href={url} download>
            Tải về
          </Button>
        </Space>
      </div>
    );
  };
  // ---------------------------------------------------------

  const renderStatus = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Hoàn tất
          </Tag>
        );
      case "approved":
        return (
          <Tag color="processing" icon={<AuditOutlined />}>
            Đã duyệt chi
          </Tag>
        );
      case "cancelled":
        return (
          <Tag color="error" icon={<CloseCircleOutlined />}>
            Đã hủy
          </Tag>
        );
      default:
        return (
          <Tag color="warning" icon={<ClockCircleOutlined />}>
            Chờ duyệt
          </Tag>
        );
    }
  };

  // [NEW] Logic tái tạo QR Code
  // Kiểm tra xem record này có lưu thông tin ngân hàng đích không
  const bankInfo = data.target_bank_info;
  let qrUrl = null;

  if (bankInfo?.bin && bankInfo?.acc && data.flow === "out") {
    const { bin, acc, holder } = bankInfo;
    // Encode nội dung để tránh lỗi URL
    const addInfo = encodeURIComponent(
      data.description || `Thanh toan phieu ${data.code}`
    );
    const accountName = encodeURIComponent(holder || "");

    // Tạo link VietQR (Template compact)
    qrUrl = `https://img.vietqr.io/image/${bin}-${acc}-compact.png?amount=${data.amount}&addInfo=${addInfo}&accountName=${accountName}`;
  }

  return (
    <Modal
      title={
        <div style={{ fontSize: 18 }}>
          Chi tiết Giao dịch: <b>{data.code}</b>
        </div>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      width={700}
      centered
      destroyOnClose // Reset modal khi đóng để tránh cache ảnh cũ
    >
      {/* Phần Header Số tiền & Trạng thái */}
      <div style={{ textAlign: "center", marginBottom: 24, marginTop: 12 }}>
        <Text type="secondary" style={{ fontSize: 14 }}>
          Số tiền giao dịch
        </Text>
        <div>
          <Text strong style={{ fontSize: 36, color: color }}>
            {sign} {Number(data.amount).toLocaleString()} ₫
          </Text>
        </div>
        <div style={{ marginTop: 8 }}>{renderStatus(data.status)}</div>
      </div>

      {/* Phần Thông tin chi tiết */}
      <Descriptions
        bordered
        column={1}
        size="middle"
        labelStyle={{ width: 160, fontWeight: 500 }}
      >
        <Descriptions.Item label="Ngày tạo phiếu">
          {dayjs(data.transaction_date)
            .tz("Asia/Ho_Chi_Minh")
            .format("HH:mm - DD/MM/YYYY")}
        </Descriptions.Item>
        <Descriptions.Item label="Loại nghiệp vụ">
          {data.business_type === "trade" ? (
            <Tag color="blue">Thanh toán Mua/Bán</Tag>
          ) : data.business_type === "advance" ? (
            <Tag color="gold">Tạm ứng</Tag>
          ) : data.business_type === "reimbursement" ? (
            <Tag color="purple">Hoàn ứng</Tag>
          ) : (
            <Tag>Khác</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Quỹ tiền">
          <Text strong>{data.fund_name}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Đối tượng">
          <Text strong>{data.partner_name || "---"}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Diễn giải">
          <span style={{ whiteSpace: "pre-wrap" }}>{data.description}</span>
        </Descriptions.Item>
        <Descriptions.Item label="Người lập phiếu">
          {data.created_by_name}
        </Descriptions.Item>
      </Descriptions>

      {/* 2. [NEW] Khu vực hiển thị QR Code (Chỉ hiện khi có URL) */}
      {qrUrl && (
        <>
          <Divider
            orientation="left"
            style={{ borderColor: "#1890ff", color: "#1890ff" }}
          >
            <QrcodeOutlined /> Thông tin Thanh toán & QR
          </Divider>

          <div
            style={{
              display: "flex",
              gap: 16,
              background: "#f5f5f5",
              padding: 16,
              borderRadius: 8,
            }}
          >
            {/* Cột Trái: Ảnh QR */}
            <div style={{ flexShrink: 0 }}>
              <Image
                src={qrUrl}
                width={200}
                style={{ borderRadius: 8, border: "1px solid #ddd" }}
                alt="QR Code"
              />
            </div>

            {/* Cột Phải: Thông tin Text */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: "#888" }}>Ngân hàng:</span> <br />
                <b>{bankInfo?.bin}</b>{" "}
                {/* Nếu có tên NH thì hiển thị, tạm thời hiện BIN */}
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: "#888" }}>Số tài khoản:</span> <br />
                <b style={{ fontSize: 16, color: "#1890ff" }}>
                  {bankInfo?.acc}
                </b>
              </div>
              <div>
                <span style={{ color: "#888" }}>Chủ tài khoản:</span> <br />
                <b style={{ textTransform: "uppercase" }}>{bankInfo?.holder}</b>
              </div>
            </div>
          </div>
        </>
      )}

      <Divider orientation="left" style={{ fontSize: 14, color: "#1890ff" }}>
        <FileImageOutlined /> Chứng từ đính kèm
      </Divider>

      {/* Gọi hàm render đã chuẩn hóa */}
      {renderEvidence()}

      {data.cash_tally && Object.keys(data.cash_tally).length > 0 ? (
        <>
          <Divider orientation="left" style={{ fontSize: 14 }}>
            Bảng kê tiền mặt
          </Divider>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(data.cash_tally).map(([denom, count]) => (
              <Tag
                key={denom}
                color="default"
                style={{ padding: "4px 10px", fontSize: 13 }}
              >
                {Number(denom).toLocaleString()}đ x <b>{Number(count)}</b>
              </Tag>
            ))}
          </div>
        </>
      ) : null}
    </Modal>
  );
};

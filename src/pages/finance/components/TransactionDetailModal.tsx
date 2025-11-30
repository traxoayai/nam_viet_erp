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
} from "antd";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import React from "react";

import { TransactionRecord } from "@/types/finance";

// CẤU HÌNH GIỜ VIỆT NAM
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

  // --- HÀM XỬ LÝ HIỂN THỊ FILE ---
  const renderEvidence = (url: string) => {
    // Lấy đuôi file (ví dụ: .png, .pdf)
    const extension = url.split(".").pop()?.toLowerCase() || "";
    const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(extension);
    const isPdf = extension === "pdf";

    if (isImage) {
      return (
        <Image
          src={url}
          alt="Chứng từ"
          height={250}
          style={{
            objectFit: "contain",
            borderRadius: 8,
            border: "1px solid #f0f0f0",
          }}
        />
      );
    }

    // Nếu không phải ảnh, hiển thị nút bấm mở file
    return (
      <div
        style={{
          textAlign: "center",
          padding: 20,
          background: "#fafafa",
          borderRadius: 8,
          border: "1px dashed #d9d9d9",
        }}
      >
        <div style={{ marginBottom: 12 }}>
          {isPdf ? (
            <FilePdfOutlined style={{ fontSize: 48, color: "#ff4d4f" }} />
          ) : (
            <FileUnknownOutlined style={{ fontSize: 48, color: "#1890ff" }} />
          )}
        </div>
        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          Tài liệu đính kèm ({extension.toUpperCase()})
        </Text>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Mở tài liệu để xem
        </Button>
      </div>
    );
  };
  // --------------------------------

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
    >
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

      <Descriptions
        bordered
        column={1}
        size="middle"
        labelStyle={{ width: 160, fontWeight: 500 }}
      >
        <Descriptions.Item label="Ngày tạo phiếu">
          {/* AURA FIX: Ép buộc hiển thị giờ Việt Nam (GMT+7) */}
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

      {/* --- PHẦN CHỨNG TỪ ĐÍNH KÈM (NÂNG CẤP) --- */}
      <Divider orientation="left" style={{ fontSize: 14, color: "#1890ff" }}>
        <FileImageOutlined /> Chứng từ đính kèm
      </Divider>

      <div style={{ textAlign: "center" }}>
        {data.evidence_url ? (
          renderEvidence(data.evidence_url)
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Text type="secondary">Không có chứng từ/hóa đơn đính kèm</Text>
            }
          />
        )}
      </div>

      {/* Bảng kê tiền mặt (Nếu có) */}
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
                {Number(denom).toLocaleString()}đ x <b>{count}</b>
              </Tag>
            ))}
          </div>
        </>
      ) : null}
    </Modal>
  );
};

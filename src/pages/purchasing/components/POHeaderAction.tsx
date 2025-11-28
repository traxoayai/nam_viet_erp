// src/pages/purchasing/components/POHeaderAction.tsx
import {
  ArrowLeftOutlined,
  SaveOutlined,
  SendOutlined,
  DollarCircleOutlined,
} from "@ant-design/icons";
import { Affix, Card, Row, Col, Space, Button, Typography, Tag } from "antd";
import React from "react";
import { useNavigate } from "react-router-dom";

const { Title } = Typography;

interface Props {
  isEditMode: boolean;
  poCode: string;
  poStatus?: string; // Nhận thêm status để ẩn/hiện nút
  loading: boolean;
  onSave: () => void;
  onSubmit: () => void;
  onRequestPayment: () => void; // Hàm mới
}

const POHeaderAction: React.FC<Props> = ({
  isEditMode,
  poCode,
  poStatus,
  loading,
  onSave,
  onSubmit,
  onRequestPayment,
}) => {
  const navigate = useNavigate();

  const getStatusTag = (status?: string) => {
    switch (status) {
      case "DRAFT":
        return <Tag color="orange">Nháp</Tag>;
      case "PENDING":
        return <Tag color="blue">Đã đặt hàng</Tag>;
      case "COMPLETED":
        return <Tag color="green">Hoàn tất</Tag>;
      case "CANCELLED":
        return <Tag color="red">Đã hủy</Tag>;
      default:
        return <Tag>Mới</Tag>;
    }
  };

  return (
    <Affix offsetTop={0}>
      <Card
        styles={{ body: { padding: "12px 24px" } }}
        variant="borderless"
        style={{ marginBottom: 16, borderRadius: 0 }}
      >
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate("/purchase-orders")}
              >
                Quay lại
              </Button>
              <Title level={5} style={{ margin: 0 }}>
                {isEditMode ? `Đơn hàng: ${poCode}` : "Tạo Đơn Mua Hàng Mới"}
              </Title>
              {getStatusTag(poStatus)}
            </Space>
          </Col>
          <Col>
            <Space>
              {/* Chỉ hiện nút Lưu/Đặt hàng khi ở trạng thái Nháp */}
              {(poStatus === "DRAFT" || !isEditMode) && (
                <>
                  <Button
                    icon={<SaveOutlined />}
                    onClick={onSave}
                    loading={loading}
                  >
                    Lưu Nháp
                  </Button>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={onSubmit}
                    loading={loading}
                    disabled={!isEditMode}
                  >
                    Đặt Hàng
                  </Button>
                </>
              )}

              {/* Hiện nút Yêu cầu thanh toán khi đã đặt hàng (PENDING) */}
              {poStatus === "PENDING" && (
                <Button
                  type="default"
                  style={{ borderColor: "#faad14", color: "#faad14" }}
                  icon={<DollarCircleOutlined />}
                  onClick={onRequestPayment}
                >
                  Yêu cầu Thanh toán
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>
    </Affix>
  );
};

export default POHeaderAction;

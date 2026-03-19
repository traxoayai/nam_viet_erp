// src/pages/purchasing/components/POHeaderAction.tsx
import {
  ArrowLeftOutlined,
  SaveOutlined,
  SendOutlined,
  DollarCircleOutlined,
  PrinterOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { Affix, Card, Row, Col, Space, Button, Typography, Tag } from "antd";
import React from "react";
import { useNavigate } from "react-router-dom";

const { Title } = Typography;

interface Props {
  isEditMode: boolean;
  poId?: number; // [NEW] Needed for navigation
  poCode: string;
  poStatus?: string; // Nhận thêm status để ẩn/hiện nút
  loading: boolean;
  onSave: () => void;
  onSubmit: () => void;
  onCancelOrder: () => void; // [NEW] Hàm hủy đơn
  onPrint: () => void; // [NEW] Hàm in
  onRequestPayment: () => void; // Hàm mới
  onCalculateInbound: () => void; // [NEW] V34
}

const POHeaderAction: React.FC<Props> = ({
  isEditMode,
  poCode,
  poStatus,
  loading,
  onSave,
  onSubmit,
  onCancelOrder,
  onPrint,
  onRequestPayment,
  onCalculateInbound,
}) => {
  const navigate = useNavigate();
const canCancel = poStatus === 'DRAFT' || poStatus === 'PENDING';
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
        style={{ marginBottom: 16, borderRadius: 0, zIndex: 99 }}
      >
        <Row justify="space-between" align="middle">
          {/* CỘT TRÁI: Các nút điều hướng và thông tin cơ bản */}
          <Col>
            <Space size="middle" align="center">
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

              {/* [FIX]: Nút In chỉ hiện khi Đã tạo đơn (isEditMode). Bỏ viền đỏ. */}
              {/* {isEditMode && (
                 <Button icon={<PrinterOutlined />} onClick={onPrint}>
                   In đơn
                 </Button>
              )} */}
            </Space>
          </Col>

          {/* CỘT PHẢI: Các nút Thao tác (Action) chính */}
          <Col>
            <Space size="small">
              {isEditMode && (
                 <Button icon={<PrinterOutlined />} onClick={onPrint}
                  style={{ 
                      boxShadow: '0 0 8px rgba(101, 194, 248, 0.4)', // Viền phát sáng màu đỏ mờ
                      borderColor: '#4db5ffff' 
                   }}
                 >
                   In đơn
                 </Button>
              )}
              {/* Nút Hủy: Chỉ hiện khi đang sửa đơn VÀ đơn ở trạng thái cho phép hủy */}
              {isEditMode && canCancel && (
                <Button 
                   danger 
                   icon={<CloseCircleOutlined />} 
                   onClick={onCancelOrder} 
                   style={{ 
                      boxShadow: '0 0 8px rgba(255, 77, 79, 0.4)', // Viền phát sáng màu đỏ mờ
                      borderColor: '#ff4d4f' 
                   }}
                >
                   Hủy đơn
                </Button>
              )}

              {/* Nút Lưu Nháp và Đặt Hàng: Hiện khi tạo mới hoặc khi đơn đang là Nháp */}
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

              {/* Nút Tính toán & Nhập kho (V34) - Hiện khi Pending hoặc Shipping */}
              {(poStatus === "PENDING" || poStatus === "SHIPPING") && (
                <Button
                  type="primary"
                  style={{ backgroundColor: "#722ed1", borderColor: "#722ed1" }}
                  icon={<DollarCircleOutlined />}
                  onClick={onCalculateInbound}
                >
                  Tính Giá vốn & Nhập kho
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

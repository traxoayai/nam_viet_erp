// src/pages/purchasing/components/POHeaderAction.tsx
import {
  ArrowLeftOutlined,
  SaveOutlined,
  SendOutlined,
  DollarCircleOutlined,
  PrinterOutlined,
  CloseCircleOutlined,
  CalculatorOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { Affix, Card, Row, Col, Space, Button, Typography, Tag } from "antd";
import { useNavigate } from "react-router-dom";

const { Title } = Typography;

interface Props {
  isEditMode: boolean;
  poCode: string;
  poStatus?: string;
  loading: boolean;
  onSave: () => void;
  onSubmit: () => void;
  onCancelOrder: () => void;
  onPrint: () => void;
  onRequestPayment: () => void;
  onOpenCosting?: () => void;
  onOpenInvoice?: () => void;
  onUpdateLogistics?: () => void;
  onRequestShippingPayment?: () => void;
}

const POHeaderAction = ({
  isEditMode,
  poCode,
  poStatus,
  loading,
  onSave,
  onSubmit,
  onCancelOrder,
  onPrint,
  onRequestPayment,
  onOpenCosting,
  onOpenInvoice,
  onUpdateLogistics,
  onRequestShippingPayment,
}: Props) => {
  const navigate = useNavigate();
  const canCancel = poStatus === "DRAFT" || poStatus === "PENDING";
  const canEdit = poStatus === "PENDING";
  const showDrawerButtons = isEditMode && poStatus !== "DRAFT";

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
            </Space>
          </Col>

          <Col>
            <Space size="small">
              {isEditMode && (
                <Button
                  icon={<PrinterOutlined />}
                  onClick={onPrint}
                  style={{
                    boxShadow: "0 0 8px rgba(101, 194, 248, 0.4)",
                    borderColor: "#4db5ffff",
                  }}
                >
                  In đơn
                </Button>
              )}

              {isEditMode && canCancel && (
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={onCancelOrder}
                  style={{
                    boxShadow: "0 0 8px rgba(255, 77, 79, 0.4)",
                    borderColor: "#ff4d4f",
                  }}
                >
                  Hủy đơn
                </Button>
              )}

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

              {canEdit && (
                <>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={onUpdateLogistics}
                    loading={loading}
                  >
                    Lưu thông tin
                  </Button>
                  <Button
                    style={{ borderColor: "#faad14", color: "#faad14" }}
                    icon={<DollarCircleOutlined />}
                    onClick={onRequestPayment}
                  >
                    Thanh toán NCC
                  </Button>
                  <Button
                    style={{ borderColor: "#52c41a", color: "#52c41a" }}
                    icon={<DollarCircleOutlined />}
                    onClick={onRequestShippingPayment}
                  >
                    Thanh toán VC
                  </Button>
                </>
              )}

              {showDrawerButtons && (
                <>
                  <Button
                    type="primary"
                    style={{ backgroundColor: "#722ed1", borderColor: "#722ed1" }}
                    icon={<CalculatorOutlined />}
                    onClick={onOpenCosting}
                  >
                    Tính Giá Vốn
                  </Button>
                  <Button
                    type="primary"
                    style={{ backgroundColor: "#13c2c2", borderColor: "#13c2c2" }}
                    icon={<FileTextOutlined />}
                    onClick={onOpenInvoice}
                  >
                    Hóa Đơn VAT
                  </Button>
                </>
              )}
            </Space>
          </Col>
        </Row>
      </Card>
    </Affix>
  );
};

export default POHeaderAction;

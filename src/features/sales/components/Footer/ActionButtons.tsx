// src/features/sales-b2b/create/components/Footer/ActionButtons.tsx
import {
  SendOutlined,
  CloseOutlined,
  FileTextOutlined,
  PrinterOutlined,
  SaveOutlined,
  SnippetsOutlined // [NEW]
} from "@ant-design/icons";
import { Button, Space, Popconfirm, Alert } from "antd";
import { useNavigate } from "react-router-dom";

interface Props {
  loading: boolean;
  isOverLimit?: boolean;
  onSubmit: (status: "DRAFT" | "QUOTE" | "CONFIRMED") => void;
  onPrint?: () => void;
  onPrintPicking?: () => void; // [NEW]
}

export const ActionButtons = ({ loading, isOverLimit, onSubmit, onPrint, onPrintPicking }: Props) => {
  const navigate = useNavigate();

  return (
    <div style={{ marginTop: 24 }}>
      {isOverLimit ? (
        <Alert
          message="Cảnh báo: Đơn hàng này sẽ khiến khách hàng vượt quá hạn mức tín dụng!"
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Popconfirm
          title="Hủy đơn hàng?"
          description="Dữ liệu chưa lưu sẽ bị mất. Bạn có chắc không?"
          onConfirm={() => navigate("/b2b/orders")}
          okText="Đồng ý"
          cancelText="Không"
        >
          <Button danger icon={<CloseOutlined />} size="large">
            Hủy bỏ
          </Button>
        </Popconfirm>

        <Space>
           {/* [NEW] Nút In Phiếu Nhặt */}
           {onPrintPicking && (
            <Button 
                icon={<SnippetsOutlined />} 
                size="large"
                onClick={onPrintPicking}
                loading={loading}
            >
                In Phiếu Nhặt
            </Button>
          )}

          <Button
            icon={<PrinterOutlined />}
            size="large"
            onClick={onPrint}
            loading={loading}
          >
            In Báo Giá
          </Button>
          <Button
            icon={<FileTextOutlined />}
            size="large"
            onClick={() => onSubmit("QUOTE")}
            loading={loading}
          >
            Báo giá
          </Button>
          <Button
            icon={<SaveOutlined />}
            size="large"
            onClick={() => onSubmit("DRAFT")}
            loading={loading}
          >
            Lưu nháp
          </Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            size="large"
            onClick={() => onSubmit("CONFIRMED")}
            loading={loading}
            style={{
              background: "#0050b3",
              borderColor: "#0050b3",
              minWidth: 150,
            }}
          >
            TẠO ĐƠN HÀNG
          </Button>
        </Space>
      </div>
    </div>
  );
};

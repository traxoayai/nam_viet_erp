// src/features/sales-b2b/create/components/Footer/ActionButtons.tsx
import {
  SendOutlined,
  CloseOutlined,
  //FileTextOutlined,
  PrinterOutlined,
  SaveOutlined,
  SnippetsOutlined, // [NEW]
} from "@ant-design/icons";
import { Button, Popconfirm, Space } from "antd";
import { useNavigate } from "react-router-dom";

interface Props {
  loading: boolean;
  onSubmit: (status: "DRAFT" | "QUOTE" | "CONFIRMED") => void;
  onPrint?: () => void;
  onPrintPicking?: () => void; // [NEW]
}

// Sửa lại Component để linh hoạt hơn
export const ActionButtons = ({
  loading,
  onSubmit,
  onPrint,
  onPrintPicking,
  style,
}: Props & { style?: React.CSSProperties }) => {
  const navigate = useNavigate();

  // [REMOVED] Đã tách Alert ra ngoài để component này chỉ chứa nút bấm thuần túy

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, ...style }}>
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
          {onPrintPicking ? (
            <Button
              icon={<SnippetsOutlined />}
              size="large"
              onClick={onPrintPicking}
              loading={loading}
            >
              In Phiếu Nhặt
            </Button>
          ) : null}

          <Button
            icon={<PrinterOutlined />}
            size="large"
            onClick={onPrint}
            loading={loading}
          >
            In Đơn
          </Button>
          {/* <Button
            icon={<FileTextOutlined />}
            size="large"
            onClick={() => onSubmit("QUOTE")}
            loading={loading}
          >
            Báo giá
          </Button> */}
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
            TẠO ĐƠN
          </Button>
        </Space>
      </div>
    </div>
  );
};

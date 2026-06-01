import { UploadOutlined } from "@ant-design/icons";
import { Button, Tooltip, Upload } from "antd";
import React from "react";

interface Props {
  loading: boolean;
  onUpload: (file: File) => void;
}

const UploadFullInvoiceButton: React.FC<Props> = ({ loading, onUpload }) => {
  return (
    <Tooltip title="AI sẽ đọc toàn bộ hóa đơn và tự động thêm các sản phẩm vào danh sách mua hàng">
      <Upload
        accept="image/*,.pdf,.xml,.html"
        showUploadList={false}
        beforeUpload={(file) => {
          onUpload(file);
          return false;
        }}
      >
        <Button
          type="primary"
          icon={<UploadOutlined />}
          loading={loading}
          style={{
            background: "linear-gradient(90deg, #52c41a, #13c2c2)",
            borderColor: "transparent",
            boxShadow: "0 2px 8px rgba(82, 196, 26, 0.4)",
            fontWeight: 500,
          }}
        >
          Upload Tự Động
        </Button>
      </Upload>
    </Tooltip>
  );
};

export default UploadFullInvoiceButton;

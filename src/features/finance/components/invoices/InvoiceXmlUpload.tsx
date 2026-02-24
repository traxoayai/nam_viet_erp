import { InboxOutlined, FileTextOutlined } from "@ant-design/icons";
import { Modal, Upload } from "antd";
import React from "react";
import { useNavigate } from "react-router-dom";

import { useXmlInvoice } from "../../hooks/useXmlInvoice"; // Nexus Hook

const { Dragger } = Upload;

interface Props {
  open: boolean;
  onCancel: () => void;
}

export const InvoiceXmlUpload: React.FC<Props> = ({ open, onCancel }) => {
  const navigate = useNavigate();
  const { processXmlFile, isProcessing } = useXmlInvoice();

  const handleUpload = async (file: File) => {
    // Gọi Logic từ Nexus
    const result = await processXmlFile(file);

    if (result) {
      onCancel();
      // Chuyển sang trang đối chiếu, truyền dữ liệu đã parse qua State
      navigate("/finance/invoices/verify/new-xml", {
        state: {
          source: "xml",
          xmlData: result,
        },
      });
    }
    return false; // Prevent default upload
  };

  return (
    <Modal
      title="Nhập Hóa Đơn Điện Tử (XML)"
      open={open}
      onCancel={onCancel}
      footer={null}
      width={500}
      destroyOnClose
    >
      <Dragger
        name="file"
        multiple={false}
        accept=".xml"
        beforeUpload={handleUpload}
        showUploadList={false}
        disabled={isProcessing}
        style={{ padding: 32, background: isProcessing ? "#f5f5f5" : "#fff" }}
      >
        <p className="ant-upload-drag-icon">
          {isProcessing ? (
            <FileTextOutlined spin style={{ color: "#1890ff" }} />
          ) : (
            <InboxOutlined />
          )}
        </p>
        <p className="ant-upload-text">
          {isProcessing
            ? "Đang đọc XML & Khớp mã..."
            : "Kéo thả file .XML hóa đơn vào đây"}
        </p>
        <p className="ant-upload-hint">
          Hệ thống sẽ tự động kiểm tra trùng lặp và gợi ý mã sản phẩm.
        </p>
      </Dragger>
    </Modal>
  );
};

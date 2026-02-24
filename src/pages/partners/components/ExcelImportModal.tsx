import {
  InboxOutlined,
  DownloadOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  Modal,
  Upload,
  Button,
  Table,
  message,
  Typography,
  Steps,
  Alert,
} from "antd";
import React, { useState } from "react";
import * as XLSX from "xlsx";

const { Dragger } = Upload;
const { Text, Title } = Typography;

interface ExcelImportModalProps {
  open: boolean;
  onCancel: () => void;
  onImport: (data: any[]) => Promise<void>;
  templateType?: string;
}

// Header chuẩn (Index 0->12)
const REQUIRED_HEADERS = [
  "Tên NCC",
  "Mã số thuế",
  "Địa chỉ",
  "Người liên hệ",
  "SĐT",
  "Email",
  "Ngân hàng",
  "STK",
  "Chủ TK",
  "Điều khoản TT",
  "Cách giao hàng",
  "Công nợ hiện tại",
  "Ghi chú",
];

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  open,
  onCancel,
  onImport,
}) => {
  const [step, setStep] = useState(0);

  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validData, setValidData] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  // 1. Tải Template Động using xlsx
  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      REQUIRED_HEADERS,
      [
        "Công ty Senko",
        "0101234567",
        "TP.HCM",
        "Anh Nam",
        "0909123456",
        "nam@senko.vn",
        "VCB",
        "123456",
        "NGUYEN VAN A",
        "30 ngày",
        "Giao tận nơi",
        5000000,
        "Ghi chú mẫu",
      ],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mau_Nhap_NCC");
    XLSX.writeFile(wb, "Mau_Nhap_NCC.xlsx");
  };

  // 2. Xử lý File Upload & Parse
  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        // Đọc raw data (dạng mảng array)
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (data.length < 2) {
          message.error("File rỗng hoặc thiếu header!");
          return;
        }

        // Validate Header (Row 0)
        // Check sơ qua cột quan trọng
        const headers = data[0];
        if (
          headers[0] !== REQUIRED_HEADERS[0] ||
          headers[4] !== REQUIRED_HEADERS[4]
        ) {
          message.warning(
            "Cấu trúc file có vẻ không đúng mẫu. Vui lòng tải mẫu mới nhất."
          );
        }

        // Parse Data (Từ Row 1 trở đi)
        // Parse Data (Từ Row 1 trở đi)
        // [UPDATED] Direct use of fixedParsed to avoid unused variable 'parsed'

        setPreviewData(fixedParsed(data));
        setValidData(fixedParsed(data));
        setStep(1);
      } catch (err) {
        console.error(err);
        message.error("Lỗi đọc file excel");
      }
    };
    reader.readAsBinaryString(file);
    return false; // Prevent upload
  };

  // Helper to fix parsing logic dup
  const fixedParsed = (data: any[][]) => {
    return data
      .slice(1)
      .map((row, index) => {
        const rawDebt = row[11];
        let cleanDebt = 0;
        if (typeof rawDebt === "number") cleanDebt = rawDebt;
        else if (typeof rawDebt === "string") {
          cleanDebt = Number(rawDebt.replace(/[^0-9.-]/g, "")) || 0;
        }
        return {
          key: index,
          name: row[0],
          tax_code: row[1],
          address: row[2],
          contact_person: row[3],
          phone: row[4],
          email: row[5],
          bank_name: row[6],
          bank_account: row[7],
          bank_holder: row[8],
          payment_term: row[9],
          delivery_method: row[10],
          current_debt: cleanDebt,
          notes: row[12],
        };
      })
      .filter((item) => item.name);
  };

  // 3. Submit
  const handleSubmit = async () => {
    if (validData.length === 0) {
      message.error("Không có dữ liệu hợp lệ để nhập");
      return;
    }
    setUploading(true);
    try {
      await onImport(validData);
      // Let parent handle success message to avoid dup
      handleClose();
    } catch (error: any) {
      // Parent handles error? Or we display it?
      // Usually modal displays error for better UX
      message.error(error.message || "Lỗi nhập liệu");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setStep(0);
    setPreviewData([]);
    setValidData([]);
    onCancel();
  };

  // Columns for Preview
  const columns = [
    { title: "Tên NCC", dataIndex: "name", key: "name" },
    { title: "SĐT", dataIndex: "phone", key: "phone" },
    {
      title: "Công nợ",
      dataIndex: "current_debt",
      key: "debt",
      render: (val: number) => val?.toLocaleString(),
    },
    { title: "Ghi chú", dataIndex: "notes", key: "notes" },
  ];

  return (
    <Modal
      title="Nhập Nhà Cung Cấp từ Excel"
      open={open}
      onCancel={handleClose}
      width={800}
      footer={[
        <Button key="back" onClick={handleClose}>
          Hủy
        </Button>,
        step === 1 && (
          <Button
            key="submit"
            type="primary"
            loading={uploading}
            onClick={handleSubmit}
          >
            Xác nhận Nhập ({validData.length})
          </Button>
        ),
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <Steps
          current={step}
          items={[{ title: "Tải lên" }, { title: "Kiểm tra & Xác nhận" }]}
        />
      </div>

      {step === 0 && (
        <div style={{ textAlign: "center", padding: 20 }}>
          <Alert
            message="Hướng dẫn"
            description={
              <span>
                Vui lòng sử dụng{" "}
                <a onClick={handleDownloadTemplate}>File Mẫu chuẩn</a> để nhập
                liệu.
                <br />
                Hệ thống sẽ bỏ qua các dòng thiếu Tên NCC.
              </span>
            }
            type="info"
            showIcon
            style={{ marginBottom: 24, textAlign: "left" }}
          />

          <Dragger
            accept=".xlsx, .xls"
            beforeUpload={handleFile}
            showUploadList={false}
            height={200}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              Kéo thả file vào đây hoặc bấm để chọn
            </p>
            <p className="ant-upload-hint">Chỉ hỗ trợ file .xlsx, .xls</p>
          </Dragger>

          <div style={{ marginTop: 16 }}>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownloadTemplate}
            >
              Tải file mẫu
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <Title level={5}>Dữ liệu xem trước (5 dòng đầu)</Title>
          <Table
            dataSource={previewData}
            columns={columns}
            pagination={false}
            size="small"
            scroll={{ x: 600 }}
          />
          <div style={{ marginTop: 16, textAlign: "right" }}>
            <Text type="secondary">
              Tổng số dòng hợp lệ: {validData.length}
            </Text>
          </div>
          <div style={{ marginTop: 16 }}>
            <Button
              type="dashed"
              icon={<UploadOutlined />}
              onClick={() => setStep(0)}
              disabled={uploading}
            >
              Chọn file khác
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

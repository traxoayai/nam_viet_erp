
import { Card, Typography, Button } from "antd";
import { useNavigate } from "react-router-dom";
import { ArrowLeftOutlined } from "@ant-design/icons";

const { Title } = Typography;

export default function PurchaseV2CreateFromVatPage() {
  const navigate = useNavigate();
  return (
    <div style={{ padding: 24, minHeight: '100vh', background: '#f5f5f5' }}>
      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
          Quay lại
        </Button>
        <Title level={3}>Tạo Đơn từ HĐ VAT</Title>
        <p>Giao diện Import/Quét ảnh Hóa Đơn Giá Trị Gia Tăng để tự động sinh ra Đơn Mua Hàng...</p>
      </Card>
    </div>
  );
}

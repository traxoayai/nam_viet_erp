import { Card, Button, Tag, Space, Typography } from "antd";
import { UserOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { usePosCartStore } from "../../stores/usePosCartStore";
import { PosCustomerSearch } from "../PosCustomerSearch";

const { Text } = Typography;

export const PosCustomerCard = () => {
  const { customer, setCustomer } = usePosCartStore();

  return (
    <Card size="small" title={<Space><UserOutlined /> Khách Hàng</Space>} style={{ marginBottom: 12 }}>
       {customer ? (
          <div>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                   <Text strong style={{ fontSize: 16 }}>{customer.name}</Text>
                   <br/>
                   <Text type="secondary">{customer.phone}</Text>
                </div>
                <Button 
                   type="text" 
                   danger 
                   icon={<CloseCircleOutlined />} 
                   onClick={() => setCustomer(null)} 
                />
             </div>
             
             {/* Sub Label (Phụ huynh/Người liên hệ) */}
             {customer.sub_label && (
                <div style={{ marginTop: 4, fontStyle: 'italic', color: '#1890ff', fontSize: 12 }}>
                   {customer.sub_label}
                </div>
             )}

             {customer.debt_amount > 0 && (
                <Tag color="red" style={{ marginTop: 8, width: '100%', textAlign: 'center' }}>
                   Nợ cũ: {customer.debt_amount.toLocaleString()} đ
                </Tag>
             )}
          </div>
       ) : (
          <PosCustomerSearch onSelect={setCustomer} />
       )}
    </Card>
  );
};

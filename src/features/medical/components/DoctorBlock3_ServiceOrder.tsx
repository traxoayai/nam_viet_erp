
// src/features/medical/components/DoctorBlock3_ServiceOrder.tsx
import React from 'react';
import { Card, Empty, Button } from 'antd';
import { Plus as PlusOutlined, FlaskConical } from 'lucide-react';

export const DoctorBlock3_ServiceOrder: React.FC = () => {
  return (
    <Card 
        size="small" 
        title={<span className="flex items-center gap-2"><FlaskConical size={16}/> Chỉ định Cận Lâm Sàng</span>}
        className="mb-4 shadow-sm"
        extra={<Button type="primary" size="small" icon={<PlusOutlined size={14}/>}>Thêm chỉ định</Button>}
    >
        <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
            description="Chưa có chỉ định nào (Xét nghiệm, X-Quang, Siêu âm...)" 
            className="my-2"
        />
        {/* Placeholder: Sau này sẽ là Table danh sách dịch vụ đã chọn */}
    </Card>
  );
};

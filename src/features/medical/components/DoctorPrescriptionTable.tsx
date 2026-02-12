
// src/features/medical/components/DoctorPrescriptionTable.tsx
import React from 'react';
import { Table, Tag, Space, Select, InputNumber, Button, Typography } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { ClinicalPrescriptionItem } from "../types/medical.types"; // Correct Import type

const { Text } = Typography;

interface Props {
  items: ClinicalPrescriptionItem[];
  setItems: (items: ClinicalPrescriptionItem[]) => void;
}

export const DoctorPrescriptionTable: React.FC<Props> = ({ items, setItems }) => {
  
  const updateItem = (productId: number, field: keyof ClinicalPrescriptionItem, value: any) => {
      setItems(items.map(i => i.product_id === productId ? { ...i, [field]: value } : i));
  };

  const removeItem = (productId: number) => {
      setItems(items.filter(i => i.product_id !== productId));
  };

  const columns = [
    {
      title: "Tên thuốc",
      dataIndex: "product_name",
      width: 250,
      render: (name: string, r: ClinicalPrescriptionItem) => (
        <Space>
           <div>
             <div className="font-bold text-sm">{name}</div>
             <div className="text-xs text-gray-400">Tồn: {r.stock_quantity}</div>
           </div>
        </Space>
      )
    },
    {
      title: "ĐVT",
      dataIndex: "unit_name",
      width: 80,
      align: "center" as const,
      render: (u: string) => <Tag color="blue">{u}</Tag>
    },
    {
      title: "SL",
      dataIndex: "quantity",
      width: 90,
      align: "center" as const,
      render: (qty: number, r: ClinicalPrescriptionItem) => (
        <InputNumber
          min={1}
          value={qty}
          size="small"
          onChange={(val) => updateItem(r.product_id, 'quantity', val)}
          precision={0} // Integer only
        />
      )
    },
    {
      title: "Liều dùng & Cách dùng",
      dataIndex: "usage_note",
      render: (note: string, r: ClinicalPrescriptionItem) => (
          <Select
            mode="tags"
            allowClear
            value={note ? [note] : []}
            style={{ width: "100%" }}
            size="small"
            placeholder="Sáng/Chiều/Tối..."
            onChange={(val) => {
                // Nếu User chọn nhiều tag -> Join lại hoặc lấy cái cuối
                // Ở đây mình force lấy cái cuối hoặc join, tùy logic
                // Đơn giản nhất: Join string
                 updateItem(r.product_id, 'usage_note', val.join(', '));
            }}
            options={[
                { value: "Sáng 1 - Tối 1 (Sau ăn)", label: "Sáng 1 - Tối 1 (Sau ăn)" },
                { value: "Sáng 1 - Chiều 1 - Tối 1", label: "Sáng 1 - Chiều 1 - Tối 1" },
                { value: "Uống khi đau/sốt", label: "Uống khi đau/sốt" }
            ]}
          />
      )
    },
    {
      width: 50,
      align: "center" as const,
      render: (_: any, r: ClinicalPrescriptionItem) => (
        <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => removeItem(r.product_id)} 
        />
      )
    }
  ];

  return (
    <Table
      dataSource={items}
      columns={columns}
      pagination={false}
      size="small"
      rowKey="product_id"
      locale={{ emptyText: "Chưa kê thuốc nào" }}
      summary={(pageData) => {
          // Footer Summary (Optional)
          return (
              <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={5}>
                      <Text type="secondary" className="text-xs">Tổng số loại thuốc: {pageData.length}</Text>
                  </Table.Summary.Cell>
              </Table.Summary.Row>
          )
      }}
    />
  );
};


// src/features/medical/components/DoctorBlock4_Prescription.tsx
import React, { useState } from 'react';
import { Card, Button, Modal, List } from 'antd';
import { CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { Pill, FileText } from 'lucide-react';
import { DoctorPrescriptionSearch } from './DoctorPrescriptionSearch';
import { DoctorPrescriptionTable } from './DoctorPrescriptionTable';
import { ClinicalPrescriptionItem } from '../types/medical.types';
import { PosProductSearchResult } from '@/features/pos/types/pos.types';

interface Props {
  items: ClinicalPrescriptionItem[];
  setItems: (items: ClinicalPrescriptionItem[]) => void;
  patientAllergies?: string;
  readOnly?: boolean;
}

export const DoctorBlock4_Prescription: React.FC<Props> = ({ items, setItems, patientAllergies, readOnly }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // MOCK TEMPLATES
  const templates = [
      {
          id: 1, name: 'Viêm họng cấp (Người lớn)',
          items: [
              { product_id: 101, product_name: 'Amoxicillin 500mg', unit_name: 'Viên', quantity: 15, usage_note: 'Sáng 1 - Chiều 1 - Tối 1', stock_quantity: 100 },
              { product_id: 102, product_name: 'Paracetamol 500mg', unit_name: 'Viên', quantity: 10, usage_note: 'Uống khi đau/sốt', stock_quantity: 50 },
          ] 
      },
      {
          id: 2, name: 'Rối loạn tiêu hóa',
          items: [
              { product_id: 201, product_name: 'Smecta', unit_name: 'Gói', quantity: 10, usage_note: 'Sáng 1 - Tối 1', stock_quantity: 20 },
              { product_id: 202, product_name: 'Oresol', unit_name: 'Gói', quantity: 5, usage_note: 'Pha 1 gói với 200ml nước', stock_quantity: 200 },
          ]
      }
  ];

  const applyTemplate = (tpl: any) => {
       const newItems = [...items];
       tpl.items.forEach((tItem: any) => {
           const exist = newItems.find(i => i.product_id === tItem.product_id);
           if (!exist) {
               newItems.push({ ...tItem, product_unit_id: 1 }); 
           }
       });
       setItems(newItems);
       setIsModalOpen(false);
  };
  
  const addProductToTable = (product: PosProductSearchResult) => {
      // Check duplicate
      const exist = items.find(i => i.product_id === product.id);
      if (exist) {
          // Increase Qty
          setItems(items.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      } else {
          // Add New
          const newItem: ClinicalPrescriptionItem = {
              product_id: product.id,
              product_name: product.name,
              product_unit_id: 1, 
              unit_name: product.unit,
              quantity: 1,
              usage_note: '',
              stock_quantity: product.stock_quantity
          };
          setItems([...items, newItem]);
      }
  };

  const handleSelectProduct = (product: PosProductSearchResult) => {
      // --- START: SAFETY CHECK ---
      if (patientAllergies) {
          const allergies = patientAllergies.toLowerCase();
          const drugName = product.name.toLowerCase();
          
          // Logic check đơn giản (Thực tế cần check theo hoạt chất)
          const isAllergic = 
             (allergies.includes('penicillin') && (drugName.includes('amoxicillin') || drugName.includes('augmentin'))) ||
             (allergies.includes('paracetamol') && drugName.includes('para'));

          if (isAllergic) {
              Modal.confirm({
                  title: 'CẢNH BÁO DỊ ỨNG THUỐC',
                  icon: <WarningOutlined className="text-red-600" />,
                  content: (
                    <div>
                        <p>Bệnh nhân có tiền sử dị ứng: <span className="font-bold text-red-600">{patientAllergies}</span></p>
                        <p>Thuốc bạn chọn: <span className="font-bold">{product.name}</span></p>
                        <p>Bạn có chắc chắn muốn kê thuốc này không?</p>
                    </div>
                  ),
                  okText: 'Vẫn kê (Tôi chịu trách nhiệm)',
                  okType: 'danger',
                  cancelText: 'Hủy bỏ',
                  onOk: () => addProductToTable(product)
              });
              return;
          }
      }
      // --- END: SAFETY CHECK ---

      addProductToTable(product);
  };

  return (
    <Card 
        size="small" 
        title={<span className="flex items-center gap-2"><Pill size={16}/> Chẩn đoán & Kê đơn</span>} 
        className="shadow-sm h-full flex flex-col"
        bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
    >
        {/* Helper Toolbar */}
        <div className="flex gap-2 mb-3">
             <div className="flex-1 pointer-events-none" style={readOnly ? { opacity: 0.6 } : { pointerEvents: 'auto' }}>
                 <DoctorPrescriptionSearch onSelectProduct={handleSelectProduct} />
             </div>
             <Button icon={<FileText size={14}/>} onClick={() => setIsModalOpen(true)} disabled={readOnly}>Đơn mẫu</Button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto border border-gray-100 rounded">
            <DoctorPrescriptionTable items={items} setItems={setItems} />
        </div>

        {/* Modal Template */}
        <Modal 
            title="Chọn Đơn Thuốc Mẫu" 
            open={isModalOpen} 
            onCancel={() => setIsModalOpen(false)}
            footer={null}
        >
            <List
                dataSource={templates}
                renderItem={item => (
                    <List.Item
                        actions={[<Button type="link" onClick={() => applyTemplate(item)}>Áp dụng</Button>]}
                    >
                        <List.Item.Meta
                            avatar={<CheckCircleOutlined className="text-green-500"/>}
                            title={item.name}
                            description={`${item.items.length} loại thuốc`}
                        />
                    </List.Item>
                )}
            />
        </Modal>
    </Card>
  );
};

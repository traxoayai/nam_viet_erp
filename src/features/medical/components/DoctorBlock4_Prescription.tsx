
// src/features/medical/components/DoctorBlock4_Prescription.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Drawer, List, Space, Input, message, Modal } from 'antd';
import { CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { Pill, FileText } from 'lucide-react';
import { DoctorPrescriptionSearch } from './DoctorPrescriptionSearch';
import { DoctorPrescriptionTable } from './DoctorPrescriptionTable';
import { ClinicalPrescriptionItem } from '../types/medical.types';
import { PosProductSearchResult } from '@/features/pos/types/pos.types';
import { supabase } from '@/shared/lib/supabaseClient';

interface Props {
  items: ClinicalPrescriptionItem[];
  setItems: (items: ClinicalPrescriptionItem[]) => void;
  patientAllergies?: string;
  readOnly?: boolean;
  onSendPharmacy?: (warehouseId: number) => void;
  sending?: boolean;
  isPrescriptionSent?: boolean;
}

export const DoctorBlock4_Prescription: React.FC<Props> = ({ 
    items, setItems,
    patientAllergies, readOnly, onSendPharmacy, sending, isPrescriptionSent
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [templateResults, setTemplateResults] = useState<any[]>([]);
  const [searchingTemplates, setSearchingTemplates] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const searchTemplates = async (keyword: string) => {
      setSearchingTemplates(true);
      try {
          const { data, error } = await supabase.rpc('search_prescription_templates', {
              p_keyword: keyword || ''
          });
          if (error) throw error;
          setTemplateResults(data || []);
      } catch (err: any) {
          message.error("Lỗi tìm kiếm đơn mẫu: " + err.message);
      } finally {
          setSearchingTemplates(false);
      }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const keyword = e.target.value;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
          searchTemplates(keyword);
      }, 500);
  };

  useEffect(() => {
      if (isDrawerOpen && templateResults.length === 0) {
          searchTemplates(''); // Fetch on first open
      }
  }, [isDrawerOpen]);
  // Đã trích phần MOCK TYPE ra dùng Props

  const applyTemplate = (tpl: any) => {
       const newItems = [...items];
       tpl.items.forEach((tItem: any) => {
           const exist = newItems.find(i => i.product_id === tItem.product_id);
           if (!exist) {
               newItems.push({ 
                   ...tItem, 
                   product_unit_id: 1, 
                   unit_name: tItem.unit || 'Viên', // Lấy theo trả về từ RPC json
                   usage_note: tItem.usage_instruction || ''
               }); 
           }
       });
       setItems(newItems);
       setIsDrawerOpen(false);
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
                 <DoctorPrescriptionSearch onSelectProduct={handleSelectProduct} warehouseId={1} />
             </div>
             
             <Space>
                 <Button icon={<FileText size={14}/>} onClick={() => setIsDrawerOpen(true)} disabled={readOnly}>Đơn mẫu</Button>
                 
                 <Button 
                    type={isPrescriptionSent ? "default" : "primary"}
                    className={isPrescriptionSent ? "text-green-600 font-semibold border-green-500" : ""}
                    icon={<CheckCircleOutlined />} 
                    disabled={readOnly || isPrescriptionSent || items.length === 0} 
                    loading={sending}
                    onClick={() => onSendPharmacy && onSendPharmacy(1)} // Hardcode warehouseId = 1 (Nhà thuốc lẻ)
                 >
                    {isPrescriptionSent ? "Đã Chuyển Nhà Thuốc" : "Chuyển Quầy Thuốc"}
                 </Button>
             </Space>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto border border-gray-100 rounded">
            <DoctorPrescriptionTable 
                items={items} 
                setItems={setItems} 
                readOnly={readOnly || isPrescriptionSent} 
            />
        </div>

        {/* Drawer Template */}
        <Drawer 
            title="Thư viện Đơn Thuốc Mẫu" 
            open={isDrawerOpen} 
            onClose={() => setIsDrawerOpen(false)}
            width={450}
            placement="right"
        >
            <div className="flex flex-col h-full">
                <Input.Search 
                    placeholder="Tìm đơn mẫu (vd: Viêm họng)..." 
                    onChange={handleSearchChange} 
                    onSearch={searchTemplates}
                    loading={searchingTemplates}
                    allowClear
                    className="mb-4"
                />
                <List
                    className="flex-1 overflow-auto"
                    dataSource={templateResults}
                    loading={searchingTemplates}
                    renderItem={item => (
                        <List.Item
                            actions={[<Button type="primary" size="small" onClick={() => applyTemplate(item)}>Áp dụng</Button>]}
                            className="bg-gray-50 rounded mb-2 px-3 border border-gray-100"
                        >
                            <List.Item.Meta
                                avatar={<CheckCircleOutlined className="text-green-500 mt-2"/>}
                                title={<span className="font-bold text-blue-700">{item.name}</span>}
                                description={
                                    <div className="flex flex-col text-xs">
                                        {item.diagnosis && <span><span className="font-semibold text-gray-500">Chẩn đoán:</span> {item.diagnosis}</span>}
                                        <span><span className="font-semibold text-gray-500">Gồm:</span> {item.items?.length || 0} loại thuốc</span>
                                    </div>
                                }
                            />
                        </List.Item>
                    )}
                />
            </div>
        </Drawer>
    </Card>
  );
};

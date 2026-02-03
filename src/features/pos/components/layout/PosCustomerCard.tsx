// src/features/pos/components/layout/PosCustomerCard.tsx
import { useState, useEffect } from "react";
import dayjs from 'dayjs';
import { Card, Button, Tag, Space, Typography, Tooltip, Divider } from "antd";
import { UserOutlined, CloseCircleOutlined, EditOutlined, GiftOutlined, MedicineBoxOutlined, WarningOutlined } from "@ant-design/icons";
import { usePosCartStore } from "../../stores/usePosCartStore";
import { PosCustomerSearch } from "../PosCustomerSearch";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { PosCustomerVouchers } from "../PosCustomerVouchers";
import { CustomerFormModal } from "../modals/CustomerFormModal"; 

const { Text } = Typography;

export const PosCustomerCard = () => {
  const { setCustomer, fetchVouchers, getCurrentOrder, setAvailableVouchers } = usePosCartStore();
  const currentOrder = getCurrentOrder();
  const customer = currentOrder?.customer;

  // [NEW] Helper tính tuổi gọn cho POS
  const getCompactAge = (dobString: string) => {
      if (!dobString) return null;
      const birth = dayjs(dobString);
      if (!birth.isValid()) return null;
      
      const now = dayjs();
      const years = now.diff(birth, 'year');
      const months = now.diff(birth.add(years, 'year'), 'month');
      
      if (years === 0 && months === 0) {
          const days = now.diff(birth, 'day');
          return `${days} ngày tuổi`;
      }
      if (years === 0) return `${months} tháng tuổi`;
      
      // Nếu > 0 tháng thì hiện lẻ tháng, nếu chẵn năm thì thôi
      return months > 0 ? `${years} tuổi ${months} tháng` : `${years} tuổi`;
  };

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Logic lấy Voucher: Tự động gọi khi Khách đổi hoặc Tổng tiền đổi
  const subTotal = usePosCartStore(s => s.getTotals().subTotal);
  const debouncedTotal = useDebounce(subTotal, 500);

  useEffect(() => {
      if (customer) {
          fetchVouchers(customer.id, debouncedTotal);
      } else {
          setAvailableVouchers([]);
      }
  }, [customer?.id, debouncedTotal]); 

  // Hàm hiển thị cảnh báo Y tế (Hoặc nút nhắc cập nhật)
  const renderMedicalAlert = () => {
      if (!customer) return null;

      const hasAllergy = customer.allergies && customer.allergies.trim() !== '';
      const hasDisease = customer.medical_history && customer.medical_history.trim() !== '';

      // Trường hợp 1: Có thông tin -> Hiển thị cảnh báo màu
      if (hasAllergy || hasDisease) {
          return (
              <div style={{ marginTop: 8, padding: '8px 10px', background: '#fff2f0', borderRadius: 6, border: '1px solid #ffccc7' }}>
                  {hasAllergy && (
                      <div style={{color: '#cf1322', fontSize: 13, display:'flex', gap: 6, alignItems:'center'}}>
                          <WarningOutlined /> 
                          <span><b>Dị ứng:</b> {customer.allergies}</span>
                      </div>
                  )}
                  {hasDisease && (
                      <div style={{color: '#d46b08', fontSize: 13, display:'flex', gap: 6, alignItems:'center', marginTop: hasAllergy ? 4 : 0}}>
                          <MedicineBoxOutlined />
                          <span><b>Bệnh nền:</b> {customer.medical_history}</span>
                      </div>
                  )}
              </div>
          );
      }

      // Trường hợp 2: Dữ liệu trống -> Hiển thị nút nhắc nhở Dược sĩ khai thác
      return (
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <Tooltip title="Cần khai thác thông tin dị ứng để bán thuốc an toàn">
                  <Tag 
                      icon={<WarningOutlined />} 
                      color="default" 
                      style={{ cursor: 'pointer', borderStyle: 'dashed' }}
                      onClick={() => setIsEditModalOpen(true)}
                  >
                      Cập nhật Dị ứng?
                  </Tag>
              </Tooltip>
              <Tooltip title="Cần khai thác bệnh nền">
                  <Tag 
                      icon={<MedicineBoxOutlined />} 
                      color="default" 
                      style={{ cursor: 'pointer', borderStyle: 'dashed' }}
                      onClick={() => setIsEditModalOpen(true)}
                  >
                      Cập nhật Bệnh nền?
                  </Tag>
              </Tooltip>
          </div>
      );
  };

  return (
    <Card size="small" title={<Space><UserOutlined /> Khách Hàng</Space>} style={{ marginBottom: 12 }}>
       
       {/* Modal Thêm/Sửa Khách Hàng */}
       <CustomerFormModal 
           visible={isEditModalOpen}
           customerToEdit={customer} 
           onCancel={() => setIsEditModalOpen(false)}
           onSuccess={(updatedCustomer) => setCustomer({...customer, ...updatedCustomer})} 
       />

       {customer ? (
          <div>
             {/* 1. Header: Tên + SĐT + Nút thao tác */}
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                   <div style={{display:'flex', alignItems:'center', gap: 8}}>
                       <Text strong style={{ fontSize: 16 }}>{customer.name}</Text>
                       {/* [UPDATE] Ưu tiên dữ liệu tính toán tại FE nếu BE chưa trả về format chuẩn */}
                       {(customer.age_formatted || getCompactAge(customer.dob)) && (
                           <Tag color="cyan" style={{margin:0, fontSize: 11, fontWeight: 500}}>
                               {customer.age_formatted || getCompactAge(customer.dob)}
                           </Tag>
                       )}
                   </div>
                   
                   <div style={{marginTop: 2}}>
                       <Text type="secondary">{customer.phone}</Text>
                       {customer.sub_label && (
                           <span style={{ marginLeft: 8, fontStyle: 'italic', color: '#1890ff', fontSize: 12 }}>
                               ({customer.sub_label})
                           </span>
                       )}
                   </div>
                </div>
                
                <Space size={2}>
                    <Tooltip title="Sửa thông tin khách hàng">
                        <Button type="text" icon={<EditOutlined />} onClick={() => setIsEditModalOpen(true)} />
                    </Tooltip>
                    <Tooltip title="Bỏ chọn khách hàng">
                        <Button type="text" danger icon={<CloseCircleOutlined />} onClick={() => setCustomer(null)} />
                    </Tooltip>
                </Space>
             </div>

             {/* 2. Điểm Tích Lũy & Nợ */}
             <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                 <Tooltip title="100k = 1 điểm">
                    <Tag color="gold" style={{ fontSize: 13, padding: '4px 8px' }}>
                        <GiftOutlined /> Điểm: <b>{customer.loyalty_points || 0}</b>
                    </Tag>
                 </Tooltip>
                 
                 {customer.debt_amount > 0 && (
                    <Tag color="red" style={{ fontSize: 12 }}>
                        Nợ: {customer.debt_amount.toLocaleString()}
                    </Tag>
                 )}
             </div>

             {/* 3. Cảnh báo Y tế (Dị ứng/Bệnh) */}
             {renderMedicalAlert()}

             <Divider style={{margin: '12px 0 0 0'}} dashed />

             {/* 4. Voucher List (Đập vào mắt) */}
             <PosCustomerVouchers />
          </div>
       ) : (
          <PosCustomerSearch 
              onSelect={setCustomer} 
              onAddNew={() => setIsEditModalOpen(true)} // Mở modal thêm mới khi tìm không thấy
          />
       )}
    </Card>
  );
};

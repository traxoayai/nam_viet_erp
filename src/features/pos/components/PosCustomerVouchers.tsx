import { useState } from "react";
import { Button, Tag, Typography, Space } from "antd";
import { GiftOutlined, RightOutlined, ShoppingCartOutlined, CheckCircleFilled } from "@ant-design/icons";
import { usePosCartStore } from "../stores/usePosCartStore";
import { VoucherSelectorModal } from "./modals/VoucherSelectorModal"; // Import Modal cũ để tái sử dụng
import { PosVoucher } from "../types/pos.types";

const { Text } = Typography;

export const PosCustomerVouchers = () => {
  const { availableVouchers, selectedVoucher, applyVoucher } = usePosCartStore();
  const [showModal, setShowModal] = useState(false);

  // Nếu không có voucher nào -> Ẩn luôn khu vực này
  if (availableVouchers.length === 0) return null;

  // Lấy 2 voucher đầu tiên (Core đã sắp xếp ưu tiên: Đủ ĐK -> Sắp đạt -> Giảm sâu)
  const topVouchers = availableVouchers.slice(0, 2);
  const remainingCount = availableVouchers.length - topVouchers.length;

  // Hàm render 1 thẻ voucher nhỏ
  const renderMiniVoucher = (v: PosVoucher) => {
      const isSelected = selectedVoucher?.id === v.id;
      const isDisabled = !v.is_eligible;

      return (
          <div 
              key={v.id}
              onClick={() => v.is_eligible && applyVoucher(isSelected ? null : v)}
              style={{
                  position: 'relative',
                  display: 'flex',
                  marginBottom: 8,
                  backgroundColor: isSelected ? '#f0f5ff' : '#fff',
                  border: isSelected ? '1px solid #1890ff' : '1px dashed #d9d9d9',
                  borderRadius: 6,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.7 : 1,
                  transition: 'all 0.2s',
                  overflow: 'hidden'
              }}
          >
              {/* Cột trái: Icon Gift */}
              <div style={{
                  width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isDisabled ? '#f5f5f5' : '#fff0f6',
                  color: '#eb2f96', borderRight: '1px dashed #e8e8e8'
              }}>
                  <GiftOutlined />
              </div>

              {/* Cột phải: Thông tin */}
              <div style={{ flex: 1, padding: '6px 8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ fontSize: 13, color: isDisabled ? '#999' : '#333' }}>
                          {v.code}
                          {v.discount_type === 'percent' 
                              ? <Tag color="red" style={{marginLeft:6, fontSize: 10, padding: '0 4px'}}> -{v.discount_value}%</Tag> 
                              : <Tag color="red" style={{marginLeft:6, fontSize: 10, padding: '0 4px'}}> -{(v.discount_value/1000)}k</Tag>
                          }
                      </Text>
                      {isSelected && <CheckCircleFilled style={{ color: '#1890ff' }} />}
                  </div>

                  {/* Dòng Upsell Thần Thánh */}
                  {!v.is_eligible && v.missing_amount > 0 ? (
                      <div style={{ fontSize: 11, color: '#d46b08', marginTop: 2, display:'flex', alignItems:'center' }}>
                          <ShoppingCartOutlined style={{marginRight: 4}}/>
                          Mua thêm <b>{v.missing_amount.toLocaleString()}</b>
                      </div>
                  ) : (
                      <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                          {v.description || "HSD: " + v.valid_to.substring(0, 10)}
                      </div>
                  )}
              </div>
          </div>
      );
  };

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
       {/* Header */}
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
           <Space>
               <GiftOutlined style={{ color: '#eb2f96' }} />
               <Text strong style={{ fontSize: 13 }}>Voucher ({availableVouchers.length})</Text>
           </Space>
           {remainingCount > 0 && (
               <Button type="link" size="small" onClick={() => setShowModal(true)} style={{ padding: 0, fontSize: 12 }}>
                   Xem tất cả <RightOutlined style={{fontSize: 10}} />
               </Button>
           )}
       </div>

       {/* List rút gọn */}
       <div>
           {topVouchers.map(v => renderMiniVoucher(v))}
       </div>

       {/* Modal "Xem thêm" (Tái sử dụng modal Shopee cũ) */}
       <VoucherSelectorModal
           visible={showModal}
           onCancel={() => setShowModal(false)}
           vouchers={availableVouchers}
           selectedVoucherId={selectedVoucher?.id}
           onApply={applyVoucher}
       />
    </div>
  );
};

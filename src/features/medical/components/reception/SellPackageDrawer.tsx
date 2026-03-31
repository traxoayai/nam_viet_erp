// src/features/medical/components/reception/SellPackageDrawer.tsx
import React, { useState, useEffect } from "react";
import { Drawer, Button, Select, Collapse, message } from "antd";
import { AppstoreAddOutlined } from "@ant-design/icons";
import { ShoppingCart, User, Plus } from "lucide-react";
import { safeRpc } from "@/shared/lib/safeRpc";
import { CustomerSearchSelect } from "@/features/medical/components/CustomerSearchSelect";
import { getMedicalPackages } from "@/features/medical/api/receptionService"; 

interface SellPackageDrawerProps {
  open: boolean;
  onClose: () => void;
  customerId?: number | null;
}

export const SellPackageDrawer: React.FC<SellPackageDrawerProps> = ({ open, onClose, customerId }) => {
  const [localCustomerId, setLocalCustomerId] = useState<number | null>(customerId || null);
  const [packages, setPackages] = useState<any[]>([]);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setLocalCustomerId(customerId || null);
      setCartItems([]); setTotalPrice(0);
      getMedicalPackages().then(setPackages).catch(e => message.error(e.message));
    }
  }, [open, customerId]);

  const handleSelectPackage = (val: string) => {
    const item = packages.find((p) => p.id.toString() === val);
    if (item) {
      setCartItems((prev) => [...prev, { ...item, uid: Date.now() }]);
      setTotalPrice((prev) => prev + item.price);
    }
  };

  const handleRemoveCartItem = (uid: number, price: number) => {
    setCartItems((prev) => prev.filter((i) => i.uid !== uid));
    setTotalPrice((prev) => prev - price);
  };

  // 🔥 GỌI XUỐNG RPC "VÍ DỊCH VỤ" CỦA CORE
  const handleCheckout = async () => {
    if (!localCustomerId || cartItems.length === 0) return;
    setIsSubmitting(true);
    try {
      await safeRpc("sell_medical_packages", {
        p_customer_id: localCustomerId,
        p_packages: cartItems, // Truyền nguyên mảng JSON xuống
      });
      
      message.success("Đã thu tiền và khởi tạo Ví Dịch Vụ thành công!");
      setCartItems([]); setTotalPrice(0);
      onClose();
    } catch (error: any) {
      message.error("Lỗi khi tạo đơn: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCartItems = () => {
    if (cartItems.length === 0) return (
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col items-center justify-center text-gray-400">
        <ShoppingCart size={48} className="text-gray-200 mb-2" /> Chưa có Gói nào được chọn
      </div>
    );
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-2">
        {cartItems.map((item) => (
          <div key={item.uid} className="bg-white rounded-lg border border-orange-200 shadow-sm p-3 relative">
            <button onClick={() => handleRemoveCartItem(item.uid, item.price)} className="absolute top-2 right-2 text-red-400 hover:text-red-600">Hủy</button>
            <div className="font-bold text-gray-800 pr-8">{item.name}</div>
            <div className="text-orange-600 font-semibold mb-2">{item.price.toLocaleString("vi-VN")} đ</div>
            {item.service_package_items?.length > 0 && (
              <Collapse size="small" ghost>
                <Collapse.Panel header={<span className="text-xs font-semibold text-gray-500 uppercase">Chi tiết Gói</span>} key="1">
                  <div className="flex flex-col gap-2 pl-2 border-l-2 border-orange-200">
                    {item.service_package_items.map((pi: any, i: number) => (
                        <div key={i} className="text-sm flex justify-between items-center py-1 border-b border-dashed border-gray-100 last:border-0">
                          <span className="text-gray-700">{pi.products?.name}</span>
                          <span className="text-gray-500 text-xs bg-gray-100 px-2 py-0.5 rounded">x{pi.quantity} Lần</span>
                        </div>
                    ))}
                  </div>
                </Collapse.Panel>
              </Collapse>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Drawer
      title={<div className="flex items-center gap-2"><AppstoreAddOutlined className="text-white bg-[#fa8c16] p-1 rounded-full text-lg"/> <span className="font-bold">Bán Gói Dịch Vụ (Ví)</span></div>}
      placement="right" width={900} onClose={onClose} open={open} styles={{ body: { backgroundColor: "#f8fafc", padding: 0 } }}
      footer={
        <div className="flex justify-between items-center px-4 py-2">
          <div className="text-lg font-bold">Tổng cộng: <span className="text-orange-600">{totalPrice.toLocaleString("vi-VN")} đ</span></div>
          <div className="flex gap-2">
            <Button onClick={onClose}>Hủy</Button>
            <Button type="primary" style={{ backgroundColor: "#fa8c16", fontWeight: "bold" }} loading={isSubmitting} onClick={handleCheckout} disabled={!localCustomerId || cartItems.length === 0}>
              Thu Tiền & Tạo Gói
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex h-full">
        {/* CỘT TRÁI */}
        <div className="w-[40%] bg-white border-r border-gray-100 p-6 flex flex-col gap-6 h-full overflow-y-auto">
          <div>
            <div className="flex items-center gap-2 mb-3 text-gray-700 font-semibold border-b pb-2"><User size={18} className="text-orange-500" /> Thông Tin Khách Hàng</div>
            <CustomerSearchSelect value={localCustomerId || undefined} onChange={setLocalCustomerId} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3 text-gray-700 font-semibold border-b pb-2"><Plus size={18} className="text-green-500" /> Chọn Gói Cần Bán</div>
            <Select className="w-full" showSearch placeholder="Gõ tên Gói..." options={packages.map((p) => ({ value: p.id.toString(), label: `${p.name} - ${p.price.toLocaleString()}đ` }))} onChange={handleSelectPackage} value={null} filterOption={(input, option) => (option?.label ?? "").toString().toLowerCase().includes(input.toLowerCase())} disabled={!localCustomerId}/>
          </div>
        </div>
        {/* CỘT PHẢI */}
        <div className="w-[60%] bg-slate-50 p-6 flex flex-col h-full">
          <div className="flex items-center gap-2 mb-4 text-gray-700 font-bold text-lg"><ShoppingCart size={20} className="text-[#fa8c16]" /> Giỏ Hàng Gói Dịch Vụ</div>
          {renderCartItems()}
        </div>
      </div>
    </Drawer>
  );
};

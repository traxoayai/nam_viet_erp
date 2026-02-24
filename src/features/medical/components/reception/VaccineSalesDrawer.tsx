// src/features/medical/components/reception/VaccineSalesDrawer.tsx
import { Drawer, Button, Select, Divider, Collapse, message } from "antd";
import { Syringe, ShoppingCart, User, Plus } from "lucide-react";
import React, { useState, useEffect } from "react";

import {
  getVaccines,
  getVaccinePackages,
  generateTimeline,
} from "@/features/medical/api/vaccineService";
import { CustomerSearchSelect } from "@/features/medical/components/CustomerSearchSelect";
import dayjs from "dayjs"; // Bổ sung dayjs

interface VaccineSalesDrawerProps {
  open: boolean;
  onClose: () => void;
  customerId?: number | null;
  openTimelineDrawer?: (customerId: number) => void;
}

export const VaccineSalesDrawer: React.FC<VaccineSalesDrawerProps> = ({
  open,
  onClose,
  customerId,
  openTimelineDrawer,
}) => {
  const [localCustomerId, setLocalCustomerId] = useState<number | null>(
    customerId || null
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dữ liệu API
  const [vaccines, setVaccines] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);

  // Giỏ hàng
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [totalPrice, setTotalPrice] = useState<number>(0);

  // Hàm gọi API
  const loadProducts = async () => {
    try {
      const vData = await getVaccines();
      setVaccines(vData || []);
      const pData = await getVaccinePackages();
      setPackages(pData || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Reset state khi mở lại
  useEffect(() => {
    if (open) {
      setLocalCustomerId(customerId || null);
      setCartItems([]);
      setTotalPrice(0);
      setIsSubmitting(false);
      loadProducts();
    }
  }, [open, customerId]);

  const handleCheckoutAndCreateTimeline = async () => {
    if (!localCustomerId || cartItems.length === 0) return;
    
    setIsSubmitting(true);
    try {
      // 1. (Sau này) Gọi hàm tạo Đơn hàng/Hóa đơn bán hàng ở đây...
      // const order = await salesService.createOrder(...)
      
      // 2. Chạy vòng lặp gọi RPC để TẠO SỔ TIÊM cho từng Item trong Giỏ hàng
      const startDate = dayjs().format("YYYY-MM-DD");
      
      for (const item of cartItems) {
        await generateTimeline({
          p_customer_id: localCustomerId,
          p_start_date: startDate,
          p_order_id: undefined, // Sau này nhét order.id vào đây
          
          // GỬI CHUẨN DỮ LIỆU:
          p_package_id: item.type === "package" ? item.id : undefined,
          
          // Chú ý: Mũi lẻ phải gửi product_id (đã được bóc ra ở API trên)
          p_product_id: item.type === "single" ? item.product_id : undefined,
        });
      }

      message.success("Đã thu tiền và khởi tạo Sổ tiêm thành công!");
      // 3. Dọn dẹp & Tự động chuyển hướng sang xem Timeline
      setCartItems([]);
      setTotalPrice(0);
      onClose(); // Đóng drawer Bán hàng
      
      // Truyền hàm openTimelineDrawer từ ngoài vào để chuyển màn
      if (openTimelineDrawer) {
          openTimelineDrawer(localCustomerId);
      }

    } catch (err: any) {
      message.error("Lỗi khởi tạo sổ tiêm: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý chọn Mũi Lẻ
  const handleSelectVaccine = (val: string) => {
    const item = vaccines.find((v) => v.id.toString() === val);
    if (item) {
      setCartItems((prev) => [
        ...prev,
        { ...item, type: "single", uid: Date.now() },
      ]);
      setTotalPrice((prev) => prev + item.price);
    }
  };

  // Xử lý chọn Gói Tiêm
  const handleSelectPackage = (val: string) => {
    const item = packages.find((p) => p.id.toString() === val);
    if (item) {
      setCartItems((prev) => [
        ...prev,
        { ...item, type: "package", uid: Date.now() },
      ]);
      setTotalPrice((prev) => prev + item.price);
    }
  };

  const handleRemoveCartItem = (uid: number, price: number) => {
    setCartItems((prev) => prev.filter((i) => i.uid !== uid));
    setTotalPrice((prev) => prev - price);
  };

  // Render Collapse (AntD) cho Gói tiêm
  const renderCartItems = () => {
    if (cartItems.length === 0) {
      return (
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-4 overflow-y-auto custom-scrollbar flex flex-col items-center justify-center">
          <ShoppingCart size={48} className="text-gray-200 mb-2" />
          <span className="text-gray-400">
            Chưa có mũi tiêm hoặc gói nào được chọn
          </span>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-2">
        {cartItems.map((item) => (
          <div
            key={item.uid}
            className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 relative"
          >
            <button
              onClick={() => handleRemoveCartItem(item.uid, item.price)}
              className="absolute top-2 right-2 text-red-400 hover:text-red-600 transition"
            >
              Hủy
            </button>

            <div className="font-bold text-gray-800 pr-8">{item.name}</div>
            <div className="text-blue-600 font-semibold mb-2">
              {item.price.toLocaleString("vi-VN")} đ
            </div>

            {item.type === "package" && item.service_package_items ? (
              <Collapse size="small" ghost>
                <Collapse.Panel
                  header={
                    <span className="text-xs font-semibold text-gray-500 uppercase">
                      Xem Phác Đồ Gói ({item.service_package_items.length} Mũi)
                    </span>
                  }
                  key="1"
                >
                  <div className="flex flex-col gap-2 pl-2 border-l-2 border-blue-200">
                    {item.service_package_items.map((pi: any, i2: number) => {
                      // Tính nhẩm ngày dự kiến
                      const expected = new Date();
                      expected.setDate(
                        expected.getDate() + (pi.schedule_days || 0)
                      );

                      return (
                        <div key={i2} className="text-sm flex justify-between">
                          <span className="text-gray-700 font-medium">
                            {pi.products?.name}
                          </span>
                          <span className="text-orange-600 text-xs">
                            Sau {pi.schedule_days || 0} ngày
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Collapse.Panel>
              </Collapse>
            ) : null}
          </div>
        ))}
      </div>
    );
  };
  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <Syringe
            className="text-[#722ed1] bg-[#f9f0ff] p-1 rounded-full"
            size={24}
          />
          Bán Tiêm Chủng (Vaccine)
        </div>
      }
      placement="right"
      width={1000} // Đủ rộng layout Split View 40-60
      onClose={onClose}
      open={open}
      styles={{ body: { backgroundColor: "#f8fafc", padding: 0 } }}
      footer={
        <div className="flex justify-between items-center px-4 py-2">
          <div className="text-lg font-bold">
            Tổng cộng:{" "}
            <span className="text-blue-600">
              {totalPrice.toLocaleString("vi-VN")} đ
            </span>
          </div>
          <div className="flex gap-2">
            <Button onClick={onClose}>Hủy</Button>
            <Button
              type="primary"
              style={{ 
                backgroundColor: "#722ed1", 
                borderColor: "#722ed1", 
                color: "white", 
                fontWeight: "bold", 
                boxShadow: "0 4px 6px -1px rgba(114, 46, 209, 0.3)" 
              }}
              disabled={!localCustomerId || cartItems.length === 0}
              loading={isSubmitting}
              onClick={handleCheckoutAndCreateTimeline}
            >
              Thu Tiền & Tạo Sổ Tiêm
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex h-full">
        {/* ---------- CỘT TRÁI (40%): Chọn Khách & Chọn Dịch vụ ---------- */}
        <div className="w-[40%] bg-white border-r border-gray-100 p-6 flex flex-col gap-6 h-full overflow-y-auto custom-scrollbar">
          {/* SECTION 1: KHÁCH HÀNG */}
          <div>
            <div className="flex items-center gap-2 mb-3 text-gray-700 font-semibold border-b pb-2">
              <User size={18} className="text-blue-500" />
              <span>Thông Tin Khách Hàng</span>
            </div>
            <CustomerSearchSelect
              value={localCustomerId || undefined}
              onChange={(id) => setLocalCustomerId(id)}
            />
            {!localCustomerId && (
              <p className="text-xs text-orange-500 mt-2 italic">
                *Bắt buộc chọn khách hàng để tạo phác đồ.
              </p>
            )}
          </div>

          {/* SECTION 2: TÌM KIẾM VẮC-XIN */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3 text-gray-700 font-semibold border-b pb-2">
              <Plus size={18} className="text-green-500" />
              <span>Chỉ Định Tiêm Chủng</span>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">
                  Tìm Mũi Lẻ
                </label>
                <Select
                  className="w-full"
                  showSearch
                  placeholder="Gõ tên Vắc-xin..."
                  options={vaccines.map((v: any) => ({
                    value: v.id.toString(),
                    label: `${v.name} - ${v.price.toLocaleString()}đ`,
                  }))}
                  onChange={handleSelectVaccine}
                  value={null}
                  filterOption={(input, option) =>
                    (option?.label ?? "")
                      .toString()
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  disabled={!localCustomerId}
                />
              </div>

              <Divider className="my-1 text-gray-300 text-xs">HOẶC</Divider>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">
                  Tìm Gói Tiêm
                </label>
                <Select
                  className="w-full"
                  showSearch
                  style={{ borderColor: "#722ed1" }}
                  placeholder="Gõ tên Gói tiêm..."
                  options={packages.map((p: any) => ({
                    value: p.id.toString(),
                    label: `${p.name} - ${p.price.toLocaleString()}đ`,
                  }))}
                  onChange={handleSelectPackage}
                  value={null}
                  filterOption={(input, option) =>
                    (option?.label ?? "")
                      .toString()
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  disabled={!localCustomerId}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ---------- CỘT PHẢI (60%): Giỏ hàng & Phác đồ tự động ---------- */}
        <div className="w-[60%] bg-slate-50 p-6 flex flex-col h-full">
          <div className="flex items-center gap-2 mb-4 text-gray-700 font-bold text-lg">
            <ShoppingCart size={20} className="text-[#722ed1]" />
            <span>Giỏ Hàng & Phác Đồ Dự Kiến</span>
          </div>

          {renderCartItems()}
        </div>
      </div>
    </Drawer>
  );
};

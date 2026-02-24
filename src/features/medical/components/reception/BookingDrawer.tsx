// src/features/medical/components/reception/BookingDrawer.tsx
import { Drawer, Select, Tag, Avatar } from "antd";
import dayjs from "dayjs";
import { Plus, Printer, User, Edit3 } from "lucide-react";

import { CustomerSearchSelect } from "@/features/medical/components/CustomerSearchSelect";

export const BookingDrawer = ({
  open,
  onClose,
  rooms,
  services,
  formData,
  setFormData,
  selectedServices,
  setSelectedServices,
  handleCreate,
}: any) => {
  // Paste logic modal from ReceptionPage later
  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <Plus
            className="bg-blue-600 text-white p-0.5 rounded-full"
            size={20}
          />
          Khám Chữa Bệnh (Booking)
        </div>
      }
      placement="right"
      width={800}
      onClose={onClose}
      open={open}
      styles={{
        body: {
          backgroundColor: "#f8fafc",
          padding: 0,
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
        {/* 1. Customer Selection Area */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="block text-sm font-bold text-gray-700">
              Khách hàng <span className="text-red-500">*</span>
            </label>
            {formData.customerId ? (
              <button
                onClick={() =>
                  setFormData((p: any) => ({
                    ...p,
                    customerId: null,
                    customerData: null,
                  }))
                }
                className="text-xs text-blue-600 hover:underline"
              >
                Thay đổi / Chọn lại
              </button>
            ) : null}
          </div>

          {!formData.customerId ? (
            <CustomerSearchSelect
              value={formData.customerId as number}
              onChange={(val, customer) => {
                setFormData({
                  ...formData,
                  customerId: val,
                  customerData: customer, // Save full data for Card
                });
              }}
            />
          ) : (
            // [NEW] CUSTOMER INFO CARD (POS STYLE)
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-4 items-start relative">
              <Avatar
                size={48}
                style={{ backgroundColor: "#1890ff" }}
                icon={<User />}
              />
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg leading-none">
                      {formData.customerData?.name}
                    </h3>
                    <div className="text-sm text-gray-500 mt-1 flex gap-2">
                      <span>{formData.customerData?.code}</span>
                      <span>•</span>
                      <span>{formData.customerData?.phone}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Tag color="blue">
                      {dayjs().year() -
                        dayjs(formData.customerData?.dob).year()}{" "}
                      tuổi
                    </Tag>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white px-2 py-1 rounded border border-blue-100 text-gray-600">
                    <span className="font-bold">Tiền sử:</span>{" "}
                    {formData.customerData?.medical_history || "Chưa ghi nhận"}
                  </div>
                  <div className="bg-white px-2 py-1 rounded border border-red-100 text-red-600">
                    <span className="font-bold">Dị ứng:</span>{" "}
                    {formData.customerData?.allergies || "Không"}
                  </div>
                </div>
              </div>
              <button
                title="Sửa thông tin KH"
                className="absolute top-2 right-2 text-gray-400 hover:text-blue-600"
              >
                <Edit3 size={16} />
              </button>
            </div>
          )}
        </div>

        {/* 2. Dịch vụ (Select Multiple) */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Dịch vụ (Chọn nhiều)
          </label>
          <Select
            mode="multiple"
            style={{ width: "100%" }}
            placeholder="Chọn dịch vụ (Khám, Tiêm, Siêu âm)..."
            size="large"
            value={selectedServices}
            onChange={setSelectedServices}
            options={
              services?.map((s: any) => ({
                label: `${s.name} - ${parseInt(s.price).toLocaleString()}đ`,
                value: s.id,
              })) || []
            }
          />
        </div>

        {/* 3. Time, Room */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Thời gian hẹn
            </label>
            <input
              type="datetime-local"
              className="w-full p-2 border border-gray-300 rounded-lg text-sm font-mono"
              value={formData.appointmentTime}
              onChange={(e) =>
                setFormData({ ...formData, appointmentTime: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Phòng / Khu vực
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
              value={formData.roomId}
              onChange={(e) =>
                setFormData({ ...formData, roomId: e.target.value })
              }
            >
              <option value="">-- Tự động xếp --</option>
              {rooms?.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              )) || null}
            </select>
          </div>
        </div>

        {/* 4. Notes & Priority */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Mức độ ưu tiên
            </label>
            <div className="flex bg-gray-100 p-1 rounded-lg gap-1">
              {["normal", "emergency", "vip"].map((p) => (
                <button
                  key={p}
                  onClick={() =>
                    setFormData({ ...formData, priority: p as any })
                  }
                  className={`flex-1 py-1.5 text-xs font-bold rounded transition capitalize ${
                    formData.priority === p
                      ? "bg-white shadow text-blue-700"
                      : "text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {p === "emergency" ? "Cấp cứu" : p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Ghi chú
            </label>
            <textarea
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none h-20"
              placeholder="Triệu chứng, lý do khám..."
              value={formData.note}
              onChange={(e) =>
                setFormData({ ...formData, note: e.target.value })
              }
            ></textarea>
          </div>
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 mt-auto">
        <button
          onClick={onClose}
          className="px-5 py-2.5 text-gray-600 font-bold text-sm hover:bg-gray-200 rounded-lg transition"
        >
          Hủy bỏ
        </button>

        <button
          onClick={() => handleCreate(false)}
          className="px-5 py-2.5 border border-blue-600 text-blue-600 font-bold text-sm rounded-lg hover:bg-blue-50 transition"
        >
          Lưu Lịch Hẹn
        </button>

        <button
          onClick={() => handleCreate(true)}
          className="px-6 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-lg shadow-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <Printer size={18} /> Lưu & In Phiếu
        </button>
      </div>
    </Drawer>
  );
};

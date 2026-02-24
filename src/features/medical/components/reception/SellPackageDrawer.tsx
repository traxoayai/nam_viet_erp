// src/features/medical/components/reception/SellPackageDrawer.tsx
import { AppstoreAddOutlined } from "@ant-design/icons";
import { Drawer } from "antd";

export const SellPackageDrawer = ({ open, onClose }: any) => {
  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <AppstoreAddOutlined
            className="text-[#fa8c16]"
            style={{ fontSize: 20 }}
          />
          Tạo Gói Khám (Bán Gói)
        </div>
      }
      placement="right"
      width={700}
      onClose={onClose}
      open={open}
      styles={{ body: { backgroundColor: "#f8fafc", padding: "24px" } }}
    >
      <div className="text-gray-500 italic p-4 text-center border border-dashed rounded bg-white">
        Giao diện chọn Gói Khám đang được thi công...
      </div>
    </Drawer>
  );
};

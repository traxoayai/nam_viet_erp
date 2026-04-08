import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
  Radio,
  Select,
  InputNumber,
  Space,
  Typography,
  Divider,
} from "antd";
import {
  searchCustomersB2B,
  type CustomerB2BOption,
  type PortalRegistrationRequest,
} from "@/features/sales/api/portalRegistrationService";

const { Text } = Typography;

type Props = {
  open: boolean;
  request: PortalRegistrationRequest | null;
  loading: boolean;
  onConfirm: (
    existingCustomerId: number | null,
    debtLimit: number,
    paymentTerm: number,
  ) => void;
  onCancel: () => void;
};

const ApproveRegistrationModal: React.FC<Props> = ({
  open,
  request,
  loading,
  onConfirm,
  onCancel,
}) => {
  const [linkMode, setLinkMode] = useState<"new" | "existing">("new");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    null,
  );
  const [debtLimit, setDebtLimit] = useState(50_000_000);
  const [paymentTerm, setPaymentTerm] = useState(30);
  const [customers, setCustomers] = useState<CustomerB2BOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLinkMode("new");
      setSelectedCustomerId(null);
      setDebtLimit(50_000_000);
      setPaymentTerm(30);
    }
  }, [open]);

  const handleSearch = useCallback(async (value: string) => {
    setSearchLoading(true);
    try {
      const results = await searchCustomersB2B(value);
      setCustomers(results);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && linkMode === "existing") {
      handleSearch("");
    }
  }, [open, linkMode, handleSearch]);

  if (!request) return null;

  return (
    <Modal
      title="Phê duyệt đăng ký Portal"
      open={open}
      onOk={() =>
        onConfirm(
          linkMode === "existing" ? selectedCustomerId : null,
          debtLimit,
          paymentTerm,
        )
      }
      onCancel={onCancel}
      okText="Xác nhận duyệt"
      cancelText="Hủy"
      confirmLoading={loading}
      okButtonProps={{
        disabled: linkMode === "existing" && !selectedCustomerId,
      }}
      width={560}
    >
      <div className="mb-4">
        <Text>
          Duyệt cho <Text strong>{request.business_name}</Text> ({request.email}
          )
        </Text>
      </div>

      <Divider orientation="left" plain>
        Liên kết khách hàng
      </Divider>
      <Radio.Group
        value={linkMode}
        onChange={(e) => setLinkMode(e.target.value as "new" | "existing")}
        className="mb-3"
      >
        <Space direction="vertical">
          <Radio value="new">Tạo khách hàng B2B mới</Radio>
          <Radio value="existing">Liên kết với khách hàng có sẵn</Radio>
        </Space>
      </Radio.Group>

      {linkMode === "existing" && (
        <Select
          showSearch
          placeholder="Tìm theo tên, mã KH, SĐT, email..."
          className="w-full mb-4"
          loading={searchLoading}
          filterOption={false}
          onSearch={handleSearch}
          value={selectedCustomerId}
          onChange={(val: number) => setSelectedCustomerId(val)}
          options={customers.map((c) => ({
            label: `${c.customer_code} — ${c.name}${c.tax_code ? ` (MST: ${c.tax_code})` : ""}`,
            value: c.id,
          }))}
        />
      )}

      <Divider orientation="left" plain>
        Chính sách công nợ
      </Divider>
      <Space size="large">
        <div>
          <Text type="secondary" className="block mb-1">
            Hạn mức công nợ (VNĐ)
          </Text>
          <InputNumber
            value={debtLimit}
            onChange={(v) => setDebtLimit(v ?? 50_000_000)}
            min={0}
            step={5_000_000}
            formatter={(v) =>
              `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
            }
            parser={(v) => Number(v?.replace(/,/g, "") ?? 0)}
            style={{ width: 200 }}
          />
        </div>
        <div>
          <Text type="secondary" className="block mb-1">
            Kỳ thanh toán (ngày)
          </Text>
          <InputNumber
            value={paymentTerm}
            onChange={(v) => setPaymentTerm(v ?? 30)}
            min={0}
            max={365}
            style={{ width: 120 }}
          />
        </div>
      </Space>
    </Modal>
  );
};

export default ApproveRegistrationModal;

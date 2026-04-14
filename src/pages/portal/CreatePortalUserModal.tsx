import React, { useState, useEffect, useCallback } from "react";
import {
  Modal, Radio, Select, Input, InputNumber,
  Space, Typography, Divider, App as AntApp,
} from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import {
  searchCustomersB2B,
  type CustomerB2BOption,
} from "@/features/sales/api/portalRegistrationService";
import {
  createPortalUserFromERP,
  createCustomerB2BInline,
} from "@/features/sales/api/portalUserService";

const { Text } = Typography;

type Props = { open: boolean; onClose: () => void; onSuccess: () => void };
type CustomerMode = "existing" | "new";

const fmtMoney = (v: number | undefined) =>
  `${v ?? 0}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const parseMoney = (v: string | undefined) =>
  Number(v?.replace(/,/g, "") ?? 0);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text type="secondary" className="block mb-1">{children}</Text>
);

const CreatePortalUserModal: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const { message: antMessage } = AntApp.useApp();

  const [customerMode, setCustomerMode] = useState<CustomerMode>("existing");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customers, setCustomers] = useState<CustomerB2BOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [bizName, setBizName] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [bizEmail, setBizEmail] = useState("");
  const [vatAddress, setVatAddress] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [debtLimit, setDebtLimit] = useState(100_000_000);
  const [paymentTerm, setPaymentTerm] = useState(30);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("staff");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCustomerMode("existing");
    setSelectedCustomerId(null);
    setBizName(""); setTaxCode(""); setBizPhone(""); setBizEmail("");
    setVatAddress(""); setShippingAddress("");
    setDebtLimit(100_000_000); setPaymentTerm(30);
    setEmail(""); setDisplayName(""); setPhone(""); setRole("staff");
  }, [open]);

  const handleSearchCustomer = useCallback(async (value: string) => {
    setSearchLoading(true);
    try {
      setCustomers(await searchCustomersB2B(value));
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && customerMode === "existing") handleSearchCustomer("");
  }, [open, customerMode, handleSearchCustomer]);

  const validate = (): string | null => {
    if (!email.trim()) return "Email portal user là bắt buộc";
    if (customerMode === "new" && !bizName.trim())
      return "Tên doanh nghiệp là bắt buộc khi tạo khách hàng mới";
    if (customerMode === "existing" && !selectedCustomerId)
      return "Vui lòng chọn khách hàng B2B";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { antMessage.warning(err); return; }

    setSubmitting(true);
    try {
      const customerId =
        customerMode === "new"
          ? await createCustomerB2BInline({
              name: bizName.trim(),
              taxCode: taxCode.trim() || undefined,
              phone: bizPhone.trim() || undefined,
              email: bizEmail.trim() || undefined,
              vatAddress: vatAddress.trim() || undefined,
              shippingAddress: shippingAddress.trim() || undefined,
              debtLimit, paymentTerm,
            })
          : selectedCustomerId!;

      await createPortalUserFromERP({
        customerB2bId: customerId,
        email: email.trim(),
        displayName: displayName.trim() || undefined,
        phone: phone.trim() || undefined,
        role,
      });
      antMessage.success("Tạo Portal User thành công! Email mời đã được gửi.");
      onSuccess();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      antMessage.error(`Lỗi tạo Portal User: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Tạo Portal User mới"
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
      okText="Tạo Portal User"
      cancelText="Hủy"
      confirmLoading={submitting}
      width={640}
      destroyOnClose
    >
      <Divider orientation="left" plain>Khách hàng B2B</Divider>
      <Radio.Group
        value={customerMode}
        onChange={(e) => setCustomerMode(e.target.value as CustomerMode)}
        className="mb-3"
      >
        <Space direction="vertical">
          <Radio value="existing">Chọn khách hàng có sẵn</Radio>
          <Radio value="new">Tạo khách hàng mới</Radio>
        </Space>
      </Radio.Group>

      {customerMode === "existing" ? (
        <Select
          showSearch
          placeholder="Tìm theo tên, mã KH, SĐT, email..."
          className="w-full mb-4"
          loading={searchLoading}
          filterOption={false}
          onSearch={handleSearchCustomer}
          value={selectedCustomerId}
          onChange={(val: number) => setSelectedCustomerId(val)}
          options={customers.map((c) => ({
            label: `${c.customer_code} — ${c.name}${c.tax_code ? ` (MST: ${c.tax_code})` : ""}`,
            value: c.id,
          }))}
        />
      ) : (
        <div className="space-y-3 mb-4">
          <div>
            <Label>Tên doanh nghiệp *</Label>
            <Input value={bizName} onChange={(e) => setBizName(e.target.value)} placeholder="Công ty TNHH ABC" />
          </div>
          <Space className="w-full" size="middle">
            <div className="flex-1">
              <Label>MST</Label>
              <Input value={taxCode} onChange={(e) => setTaxCode(e.target.value)} placeholder="0123456789" />
            </div>
            <div className="flex-1">
              <Label>SĐT</Label>
              <Input value={bizPhone} onChange={(e) => setBizPhone(e.target.value)} placeholder="028..." />
            </div>
            <div className="flex-1">
              <Label>Email</Label>
              <Input value={bizEmail} onChange={(e) => setBizEmail(e.target.value)} placeholder="info@abc.vn" />
            </div>
          </Space>
          <div>
            <Label>Địa chỉ VAT</Label>
            <Input value={vatAddress} onChange={(e) => setVatAddress(e.target.value)} placeholder="Địa chỉ xuất hóa đơn..." />
          </div>
          <div>
            <Label>Địa chỉ giao hàng</Label>
            <Input value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} placeholder="Địa chỉ nhận hàng..." />
          </div>
          <Space size="large">
            <div>
              <Label>Hạn mức nợ (VNĐ)</Label>
              <InputNumber
                value={debtLimit} onChange={(v) => setDebtLimit(v ?? 100_000_000)}
                min={0} step={5_000_000} formatter={fmtMoney} parser={parseMoney}
                style={{ width: 200 }}
              />
            </div>
            <div>
              <Label>Kỳ thanh toán (ngày)</Label>
              <InputNumber
                value={paymentTerm} onChange={(v) => setPaymentTerm(v ?? 30)}
                min={0} max={365} style={{ width: 120 }}
              />
            </div>
          </Space>
        </div>
      )}

      <Divider orientation="left" plain>Thông tin Portal User</Divider>
      <div className="space-y-3 mb-4">
        <div>
          <Label>Email *</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.vn" />
        </div>
        <Space className="w-full" size="middle">
          <div className="flex-1">
            <Label>Tên hiển thị</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nguyễn Văn A" />
          </div>
          <div className="flex-1">
            <Label>SĐT</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0901..." />
          </div>
          <div className="flex-1">
            <Label>Role</Label>
            <Select
              value={role} onChange={setRole} className="w-full"
              options={[{ label: "Owner", value: "owner" }, { label: "Staff", value: "staff" }]}
            />
          </div>
        </Space>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
        <InfoCircleOutlined className="text-blue-500 mt-0.5" />
        <Text type="secondary" className="text-sm">
          User sẽ nhận email mời với link đặt mật khẩu. Sau khi đặt mật khẩu,
          user có thể đăng nhập vào B2B Portal.
        </Text>
      </div>
    </Modal>
  );
};

export default CreatePortalUserModal;

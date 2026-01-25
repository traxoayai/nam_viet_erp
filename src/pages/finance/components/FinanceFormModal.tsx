// src/pages/finance/components/FinanceFormModal.tsx
import {
  UploadOutlined,
  QrcodeOutlined,
  BankOutlined,
} from "@ant-design/icons";
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Radio,
  Row,
  Col,
  Card,
  Typography,
  Divider,
  Upload,
  Image,
  Alert,
  Button,
  Spin,
} from "antd";
import dayjs from "dayjs";
import React, { useEffect, useState } from "react";

import { useFinanceFormLogic } from "../hooks/useFinanceFormLogic";

import { useBankStore } from "@/features/finance/stores/useBankStore";
import { useFinanceStore } from "@/features/finance/stores/useFinanceStore";
import { useTransactionCategoryStore } from "@/features/finance/stores/useTransactionCategoryStore";
import { supabase } from "@/shared/lib/supabaseClient";

const { Option } = Select;
const { Text } = Typography;
const DENOMINATIONS = [
  500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000,
];

interface Props {
  open: boolean;
  onCancel: () => void;
  initialFlow: "in" | "out";
  initialValues?: any; 
  onSuccess?: () => void;
}

export const FinanceFormModal: React.FC<Props> = ({
  open,
  onCancel,
  initialFlow,
  initialValues,
  onSuccess,
}) => {
  const { funds, fetchFunds } = useFinanceStore();
  const { banks, fetchBanks } = useBankStore();
  const { categories, fetchCategories } = useTransactionCategoryStore();

  const [checkingPending, setCheckingPending] = useState(false);
  const [pendingTrans, setPendingTrans] = useState<any[]>([]);

  const {
    form,
    loading,
    users,
    suppliers,
    openAdvances,
    businessType,
    setBusinessType,
    qrUrl,
    cashTallyTotal,
    calculateCashTally,
    fileList,
    setFileList,
    reimburseDiff,
    handleReimburseCalc,
    manualBankInfo = { bin: "", acc: "", holder: "" },
    setManualBankInfo,
    handleEmployeeChange,
    handleAdvanceSelect,
    handleSupplierChange,
    generateQR,
    handleFinish,
    partnerOptions,
    isSearching,
    currentDebt,
    handleSearchPartner,
    handleSelectPartner,
  } = useFinanceFormLogic(open, onCancel, initialFlow, initialValues);

  useEffect(() => {
    fetchFunds();
    fetchBanks();
    if (categories.length === 0) fetchCategories();
  }, []);

  // [NEW] Check Pending Transactions
  useEffect(() => {
    const checkPendingTransactions = async () => {
      if (initialValues?.ref_type && initialValues?.ref_id && open) {
        setCheckingPending(true);
        const { data } = await supabase
          .from('finance_transactions')
          .select('code, amount, created_at')
          .eq('ref_type', initialValues.ref_type)
          .eq('ref_id', String(initialValues.ref_id))
          .eq('status', 'pending');
        
        setPendingTrans(data || []);
        setCheckingPending(false);
      } else {
        setPendingTrans([]);
      }
    };

    checkPendingTransactions();
    checkPendingTransactions();
  }, [initialValues, open]);

  // [NEW] Auto-fill Partner Details when Opened with Initial Values
  useEffect(() => {
    if (open && initialValues?.partner_id && initialValues?.partner_type) {
        // Trigger select partner to load bank info etc.
        handleSelectPartner(Number(initialValues.partner_id), initialValues.partner_type);
    }
  }, [open, initialValues]); // Run once when opening with values

  const amount = Form.useWatch("amount", form);
  const desc = Form.useWatch("description", form);
  const flow = Form.useWatch("flow", form);

  useEffect(() => {
    if (flow === "out" && amount > 0) {
      generateQR(amount, desc);
    }
  }, [amount, desc, manualBankInfo, flow]);

  return (
    <Modal
      title={initialFlow === 'in' ? "Lập Phiếu Thu" : "Lập Phiếu Chi"}
      open={open}
      onCancel={onCancel}
      onOk={form.submit}
      width={850}
      okText="Lưu Phiếu"
      cancelText="Hủy"
      confirmLoading={loading}
      destroyOnHidden
      maskClosable={false}
      centered
    >
      <Form form={form} layout="vertical" onFinish={async (values) => {
         const success = await handleFinish(values);
         if (success && onSuccess) onSuccess();
      }} initialValues={initialValues}>
        {/* Hidden Fields for Ref & Partner */}
        <Form.Item name="ref_type" hidden><Input /></Form.Item>
        <Form.Item name="ref_id" hidden><Input /></Form.Item>
        <Form.Item name="partner_type" hidden><Input /></Form.Item>
        <Form.Item name="partner_id" hidden><Input /></Form.Item>
        
        {/* Loading / Checking Pending */}
        {checkingPending && (
           <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Spin tip="Đang kiểm tra phiếu trùng..." />
           </div>
        )}

        {/* Pending Warning */}
        {pendingTrans.length > 0 && (
          <Alert
            message="Cảnh báo trùng lặp"
            description={
              <div>
                Đơn hàng này đang có <b>{pendingTrans.length} phiếu chi</b> đang chờ kế toán duyệt. 
                Vui lòng kiểm tra kỹ để tránh chi 2 lần.
                <ul>
                  {pendingTrans.map((t: any) => (
                    <li key={t.code}>
                      <b>{t.code}</b>: {Number(t.amount).toLocaleString()}đ ({dayjs(t.created_at).format('DD/MM HH:mm')})
                    </li>
                  ))}
                </ul>
              </div>
            }
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* ... Header ... */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="business_type"
              label="Loại nghiệp vụ"
              rules={[{ required: true }]}
            >
              <Select onChange={setBusinessType} disabled={!!initialValues?.business_type}>
                <Option value="trade">Thanh toán Mua/Bán</Option>
                <Option value="advance">Tạm ứng nhân viên</Option>
                <Option value="reimbursement">Hoàn ứng / Quyết toán</Option>
                <Option value="other">Khác</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="flow" label="Loại phiếu">
              <Radio.Group
                disabled
              >
                <Radio value="in" className="text-green-600">
                  <span style={{ color: "#52c41a", fontWeight: 600 }}>
                    Phiếu Thu (+)
                  </span>
                </Radio>
                <Radio value="out" className="text-red-600">
                  <span style={{ color: "#f5222d", fontWeight: 600 }}>
                    Phiếu Chi (-)
                  </span>
                </Radio>
              </Radio.Group>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="category_id" label="Hạng mục / Lý do (Kế toán)">
          <Select
            placeholder="Chọn hạng mục..."
            allowClear
            showSearch
            optionFilterProp="children"
          >
            {categories
              .filter((c) => c.type === (flow === "in" ? "thu" : "chi"))
              .map((c) => (
                <Option key={c.id} value={c.id}>
                  {c.code} - {c.name}
                </Option>
              ))}
          </Select>
        </Form.Item>

        {/* A. TẠM ỨNG */}
        {businessType === "advance" && (
          <Card
            size="small"
            style={{
              background: "#fff7e6",
              marginBottom: 16,
              border: "1px solid #ffe7ba",
            }}
          >
            <Text strong type="warning">
              Chi tiền tạm ứng cho nhân viên.
            </Text>
            <Divider style={{ margin: "8px 0" }} />
            <Form.Item
              name="employee_id"
              label="Nhân viên tạm ứng"
              rules={[{ required: true }]}
            >
              <Select
                placeholder="Chọn nhân viên..."
                showSearch
                optionFilterProp="label"
                options={users.map((u) => ({ label: u.name, value: u.key }))}
              />
            </Form.Item>
          </Card>
        )}

        {/* B. HOÀN ỨNG (UPDATED UI) */}
        {businessType === "reimbursement" && (
          <Card
            size="small"
            style={{
              background: "#f0f5ff",
              marginBottom: 16,
              border: "1px solid #adc6ff",
            }}
          >
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  name="employee_id"
                  label="Nhân viên quyết toán"
                  rules={[{ required: true, message: "Chọn nhân viên" }]}
                >
                  <Select
                    placeholder="Chọn nhân viên..."
                    showSearch
                    optionFilterProp="label"
                    options={users.map((u) => ({
                      label: u.name,
                      value: u.key,
                    }))}
                    onChange={handleEmployeeChange}
                  />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item
                  name="ref_advance_id"
                  label="Hoàn cho phiếu Tạm ứng nào?"
                  rules={[{ required: true, message: "Chọn phiếu tạm ứng" }]}
                >
                  <Select
                    placeholder="Chọn phiếu tạm ứng gốc..."
                    onChange={handleAdvanceSelect}
                    loading={loading} // Hiển thị loading nếu đang fetch
                    notFoundContent={
                      openAdvances.length === 0
                        ? "Không có phiếu tạm ứng nào"
                        : null
                    }
                  >
                    {openAdvances.map((adv) => (
                      <Option key={adv.id} value={adv.id}>
                        {adv.code} - {Number(adv.amount).toLocaleString()}đ (
                        {dayjs(adv.transaction_date).format("DD/MM/YYYY")})
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                {/* AURA FIX: Khóa ô nhập tiền đã ứng để tránh sai lệch */}
                <Form.Item
                  name="advanced_amount"
                  label="Đã tạm ứng (Tự động)"
                  tooltip="Số tiền lấy từ phiếu tạm ứng đã chọn."
                >
                  <InputNumber
                    style={{
                      width: "100%",
                      backgroundColor: "#fff1f0",
                      color: "#cf1322",
                      fontWeight: "bold",
                    }}
                    formatter={(v) =>
                      `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                    }
                    readOnly
                    placeholder="Tự động hiển thị..."
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="actual_spent"
                  label="Thực chi (Theo hóa đơn)"
                  rules={[{ required: true, message: "Nhập thực chi" }]}
                >
                  <InputNumber
                    style={{ width: "100%", fontWeight: "bold" }}
                    formatter={(v) =>
                      `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                    }
                    onChange={handleReimburseCalc}
                    placeholder="Nhập số tiền..."
                  />
                </Form.Item>
              </Col>
              {reimburseDiff !== null && reimburseDiff !== 0 && (
                <Col span={24}>
                  <Alert
                    message={
                      reimburseDiff > 0
                        ? `Chi > Ứng: Công ty CHI THÊM ${reimburseDiff.toLocaleString()} đ`
                        : `Chi < Ứng: Nhân viên NỘP LẠI ${Math.abs(reimburseDiff).toLocaleString()} đ`
                    }
                    type={reimburseDiff > 0 ? "error" : "success"}
                    showIcon
                  />
                </Col>
              )}
            </Row>
          </Card>
        )}

        {/* C. MUA BÁN */}
        {(businessType === "trade" || businessType === "other") && (
          <Row gutter={16}>
            {/* Nếu đã có partner_name từ initValues (từ PO), hiển thị dạng text cho gọn */}
             {initialValues?.partner_name ? (
                <Col span={24}>
                    <Form.Item label="Đối tác (Nhà cung cấp / Khách hàng)">
                        <Input value={initialValues.partner_name} readOnly style={{ background: '#f5f5f5', fontWeight: 600 }} />
                    </Form.Item>
                    <Form.Item name="partner_name" hidden><Input /></Form.Item>
                </Col>
             ) : (
               <>
                        {/* Updated Partner Type Select */}
                        <Col span={8}>
                        <Form.Item
                            name="partner_type"
                            label="Đối tượng"
                            initialValue="supplier"
                        >
                            <Select onChange={() => {
                                // Reset các trường khi đổi loại
                                form.setFieldsValue({ partner_id: null, partner_name: null });
                            }}>
                            <Option value="supplier">Nhà cung cấp</Option>
                            <Option value="customer">Khách lẻ (B2C)</Option>
                            <Option value="customer_b2b">Khách Doanh nghiệp</Option>
                            <Option value="employee">Nhân viên</Option>
                            <Option value="other">Khác</Option>
                            </Select>
                        </Form.Item>
                        </Col>
                        
                        {/* Dynamic Partner Select */}
                        <Col span={16}>
                        <Form.Item shouldUpdate={(prev, curr) => prev.partner_type !== curr.partner_type} noStyle>
                            {({ getFieldValue }) => {
                                const type = getFieldValue("partner_type");

                                // 1. KHÁCH LẺ hoặc KHÁCH B2B
                                if (type === 'customer' || type === 'customer_b2b') {
                                    return (
                                        <div>
                                            <Form.Item 
                                                name="partner_id" 
                                                label={type === 'customer' ? "Tìm Khách lẻ (Tên, SĐT)" : "Tìm Doanh nghiệp (Tên, MST)"}
                                                rules={[{ required: true, message: "Vui lòng chọn khách hàng" }]}
                                            >
                                                <Select
                                                    showSearch
                                                    placeholder="Gõ để tìm kiếm..."
                                                    defaultActiveFirstOption={false}
                                                    filterOption={false} // Tắt filter client để dùng server-side
                                                    onSearch={(val) => handleSearchPartner(val, type)}
                                                    onChange={(val) => handleSelectPartner(val, type)}
                                                    notFoundContent={isSearching ? <Spin size="small" /> : null}
                                                    options={partnerOptions}
                                                />
                                            </Form.Item>
                                            
                                            {/* Hiển thị Công Nợ */}
                                            {currentDebt !== null && (
                                                <div style={{ marginTop: -10, marginBottom: 10, color: currentDebt > 0 ? '#faad14' : '#52c41a' }}>
                                                    <span>Công nợ hiện tại: </span>
                                                    <strong style={{ fontSize: 16 }}>
                                                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(currentDebt)}
                                                    </strong>
                                                    {currentDebt > 0 && <span style={{ marginLeft: 5 }}>(Phải thu)</span>}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                // 2. NHÀ CUNG CẤP
                                if (type === "supplier") {
                                    return (
                                        <Form.Item
                                        name="supplier_id"
                                        label="Chọn Nhà cung cấp"
                                        rules={[{ required: true }]}
                                        >
                                        <Select
                                            showSearch
                                            optionFilterProp="label"
                                            placeholder="Tìm NCC..."
                                            options={suppliers.map((s) => ({
                                            label: s.name,
                                            value: s.id,
                                            }))}
                                            onChange={handleSupplierChange}
                                        />
                                        </Form.Item>
                                    );
                                }
                                
                                // 3. NHÂN VIÊN
                                if (type === "employee") {
                                     return (
                                        <Form.Item
                                            name="employee_id"
                                            label="Chọn Nhân viên"
                                            rules={[{ required: true }]}
                                        >
                                            <Select
                                                showSearch
                                                optionFilterProp="label"
                                                options={users.map((u) => ({ label: u.name, value: u.key }))}
                                            />
                                        </Form.Item>
                                     );
                                }

                                // 4. KHÁC
                                return (
                                    <Form.Item
                                    name="partner_name"
                                    label="Tên Đối tượng / Người nộp / Người nhận"
                                    rules={[{ required: true }]}
                                    >
                                    <Input />
                                    </Form.Item>
                                );
                            }}
                        </Form.Item>
                        </Col>
               </>
             )}
          </Row>
        )}

        <Divider />

        {/* Amount & Fund */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="amount"
              label="Số tiền giao dịch"
              rules={[{ required: true }]}
            >
              <InputNumber
                style={{
                  width: "100%",
                  fontSize: 16,
                  fontWeight: "bold",
                  color: "#1890ff",
                }}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                addonAfter="₫"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="fund_account_id"
              label="Nguồn tiền"
              rules={[{ required: true }]}
            >
              <Select placeholder="Chọn quỹ..." loading={funds.length === 0}>
                {funds.map((f) => (
                  <Option key={f.id} value={f.id}>
                    {f.name} (Dư: {Number(f.balance).toLocaleString()}đ)
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* VIETQR */}
        {flow === "out" && businessType === "trade" && (
          <Card
            size="small"
            style={{
              background: "#f9f9f9",
              marginBottom: 16,
              border: "1px solid #d9d9d9",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text strong>
                <BankOutlined /> Thông tin chuyển khoản & QR Code
              </Text>
            </div>
            <Row gutter={8} style={{ marginTop: 8 }}>
              <Col span={8}>
                <Select
                  placeholder="Ngân hàng"
                  style={{ width: "100%" }}
                  value={manualBankInfo?.bin}
                  onChange={(val) =>
                    setManualBankInfo((prev) => ({ ...prev, bin: val }))
                  }
                  options={banks.map((b) => ({
                    label: b.short_name,
                    value: b.bin,
                  }))}
                  showSearch
                />
              </Col>
              <Col span={8}>
                <Input
                  placeholder="Số tài khoản"
                  value={manualBankInfo?.acc}
                  onChange={(e) =>
                    setManualBankInfo((prev) => ({
                      ...prev,
                      acc: e.target.value,
                    }))
                  }
                />
              </Col>
              <Col span={8}>
                <Input
                  placeholder="Chủ tài khoản"
                  value={manualBankInfo?.holder}
                  onChange={(e) =>
                    setManualBankInfo((prev) => ({
                      ...prev,
                      holder: e.target.value,
                    }))
                  }
                />
              </Col>
            </Row>
            {qrUrl ? (
              <div
                style={{
                  textAlign: "center",
                  marginTop: 12,
                  padding: 10,
                  background: "#fff",
                  borderRadius: 8,
                }}
              >
                <Image src={qrUrl} width={180} />
                <div
                  style={{
                    marginTop: 4,
                    color: "#1890ff",
                    fontWeight: 500,
                  }}
                >
                  <QrcodeOutlined /> Quét mã để thanh toán
                </div>
              </div>
            ) : null}
          </Card>
        )}

        <Form.Item
          noStyle
          shouldUpdate={(prev, curr) =>
            prev.fund_account_id !== curr.fund_account_id
          }
        >
          {({ getFieldValue }) => {
            const fundId = getFieldValue("fund_account_id");
            const fund = funds.find((f) => f.id === fundId);
            if (fund?.type === "cash") {
              return (
                <Card
                  size="small"
                  title="Bảng kê tiền mặt"
                  style={{
                    marginBottom: 16,
                    borderColor: "#b7eb8f",
                    background: "#f6ffed",
                  }}
                >
                  <Row gutter={[8, 8]}>
                    {DENOMINATIONS.map((denom) => (
                      <Col span={8} key={denom}>
                        <Form.Item
                          name={["cash_tally", denom]}
                          label={`${denom.toLocaleString()}đ`}
                          style={{ marginBottom: 0 }}
                        >
                          <InputNumber
                            min={0}
                            placeholder="SL"
                            style={{ width: "100%" }}
                            onChange={() =>
                              calculateCashTally(
                                form.getFieldValue("cash_tally")
                              )
                            }
                          />
                        </Form.Item>
                      </Col>
                    ))}
                  </Row>
                  <div style={{ marginTop: 10, textAlign: "right" }}>
                    <Text
                      strong
                      style={{
                        color:
                          cashTallyTotal === amount ? "#52c41a" : "#f5222d",
                      }}
                    >
                      {cashTallyTotal.toLocaleString()} ₫
                    </Text>
                  </div>
                </Card>
              );
            }
            return null;
          }}
        </Form.Item>

        <Form.Item label="Chứng từ">
          <Upload
            fileList={fileList}
            onChange={({ fileList }) => setFileList(fileList)}
            beforeUpload={() => false}
            maxCount={1}
          >
            <Button icon={<UploadOutlined />}>Tải ảnh hóa đơn</Button>
          </Upload>
        </Form.Item>

        <Form.Item
          name="description"
          label="Diễn giải"
          rules={[{ required: true }]}
        >
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// src/pages/finance/hooks/useFinanceFormLogic.ts
import { Form, App } from "antd";
import { useState, useEffect, useCallback } from "react";

import type { UploadFile } from "antd/es/upload/interface";

import { useUserStore } from "@/features/auth/stores/useUserStore";
import { financeService } from "@/features/finance/api/financeService";
import { useFinanceStore } from "@/features/finance/stores/useFinanceStore";
import { useTransactionCategoryStore } from "@/features/finance/stores/useTransactionCategoryStore";
import { CreateTransactionParams } from "@/features/finance/types/finance";
import { useSupplierStore } from "@/features/purchasing/stores/supplierStore";
import { uploadFile } from "@/shared/api/storageService";

type PartnerOption = {
  label: string;
  value: number;
  original: Record<string, unknown> & { name?: string };
};

interface FinanceFormValues {
  flow?: "in" | "out";
  business_type?: "trade" | "advance" | "reimbursement" | "other";
  partner_type?: string;
  partner_id?: number;
  partner_name?: string;
  supplier_id?: number;
  employee_id?: string;
  fund_account_id?: number;
  amount?: number;
  category_id?: number;
  transaction_date?: { toISOString: () => string };
  description?: string;
  cash_tally?: Record<string, number>;
  ref_advance_id?: number;
  ref_type?: string;
  ref_id?: string;
  advanced_amount?: number;
  actual_spent?: number;
  b2b_bulk_allocations?: Array<Record<string, unknown>>;
}

export const useFinanceFormLogic = (
  open: boolean,
  onCancel: () => void,
  initialFlow: "in" | "out",
  initialValues?: Record<string, unknown>
) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const { createTransaction, fetchOpenAdvances, openAdvances } =
    useFinanceStore();
  const { users, fetchUsers } = useUserStore();
  const { suppliers, fetchSuppliers } = useSupplierStore();
  const { categories, fetchCategories } = useTransactionCategoryStore();

  const [businessType, setBusinessType] = useState<
    "trade" | "advance" | "reimbursement" | "other"
  >("trade");
  const [loading, setLoading] = useState(false);

  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [cashTallyTotal, setCashTallyTotal] = useState(0);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [reimburseDiff, setReimburseDiff] = useState<number | null>(null);
  const [manualBankInfo, setManualBankInfo] = useState({
    bin: "",
    acc: "",
    holder: "",
  });

  const [partnerOptions, setPartnerOptions] = useState<PartnerOption[]>([]);
  const [currentDebt, setCurrentDebt] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();

      // 1. Set Default
      form.setFieldsValue({ flow: initialFlow, business_type: "trade" });

      // 2. [NEW] Pre-fill from Props (e.g. from PO Page)
      if (initialValues) {
        form.setFieldsValue(initialValues);

        // Update state if business_type changed
        const bt = initialValues.business_type;
        if (
          bt === "trade" ||
          bt === "advance" ||
          bt === "reimbursement" ||
          bt === "other"
        ) {
          setBusinessType(bt);
        }

        // Fix: If supplier_id provided -> Load Bank Info
        const supplierId = initialValues.supplier_id;
        if (typeof supplierId === "number" && suppliers.length > 0) {
          const s = suppliers.find((x) => x.id === supplierId);
          if (s) {
            setManualBankInfo({
              bin: s.bank_bin || "",
              acc: s.bank_account || "",
              holder: s.bank_holder || "",
            });
          }
        }
      } else {
        // Default Reset
        setBusinessType("trade");
        setManualBankInfo({ bin: "", acc: "", holder: "" });
      }

      setFileList([]);
      setQrUrl(null);
      setCashTallyTotal(0);
      setQrUrl(null);
      setCashTallyTotal(0);
      setReimburseDiff(null);

      // Reset Search State
      setPartnerOptions([]);
      setCurrentDebt(null);
      setIsSearching(false);

      if (users.length === 0) fetchUsers();
      if (suppliers.length === 0) fetchSuppliers();
      if (categories.length === 0) fetchCategories();
    }
  }, [
    open,
    initialFlow,
    initialValues, // Add dependency
    form,
    users.length,
    fetchUsers,
    suppliers,
    fetchSuppliers,
    categories.length,
    fetchCategories,
  ]);

  // --- LOGIC HOÀN ỨNG (UPDATED) ---

  const handleEmployeeChange = async (userId: string) => {
    if (businessType === "reimbursement") {
      // Reset các trường liên quan
      form.setFieldsValue({
        ref_advance_id: null,
        advanced_amount: 0,
        actual_spent: 0,
      });
      setReimburseDiff(null);

      // Gọi Store để tải danh sách phiếu tạm ứng
      await fetchOpenAdvances(userId);
    }
  };

  const handleReimburseCalc = useCallback(() => {
    const advanced = form.getFieldValue("advanced_amount") || 0;
    const spent = form.getFieldValue("actual_spent") || 0;
    const diff = spent - advanced;
    setReimburseDiff(diff);

    if (diff > 0) {
      // Chi thêm cho nhân viên
      form.setFieldsValue({ flow: "out", amount: diff });
    } else {
      // Thu lại tiền thừa
      form.setFieldsValue({ flow: "in", amount: Math.abs(diff) });
    }
  }, [form]);

  // AURA FIX: Hàm xử lý khi chọn phiếu tạm ứng cụ thể
  const handleAdvanceSelect = (advanceId: number) => {
    const advance = openAdvances.find((a) => a.id === advanceId);
    if (advance) {
      // 1. Tự động điền số tiền đã ứng (QUAN TRỌNG)
      const advanceAmt = Number(advance.amount);
      form.setFieldsValue({ advanced_amount: advanceAmt });

      // 2. Tính toán lại ngay lập tức (nếu đã nhập thực chi trước đó)
      handleReimburseCalc();

      message.success(`Đã chọn phiếu tạm ứng: ${advanceAmt.toLocaleString()}đ`);
    }
  };

  const handleSupplierChange = (supplierId: number) => {
    // Reset trước
    setManualBankInfo({ bin: "", acc: "", holder: "" });
    setQrUrl(null);

    // 1. Tìm trong Store (Dữ liệu đã có sẵn khi load trang)
    const selectedSupplier = suppliers.find((s) => s.id === supplierId);

    if (selectedSupplier) {
      // / @ts-ignore - (Tạm thời ignore nếu Type chưa update kịp, nhưng dữ liệu thực tế đã có)
      const { bank_bin, bank_account, bank_holder } = selectedSupplier;

      if (bank_bin && bank_account) {
        setManualBankInfo({
          bin: bank_bin,
          acc: bank_account,
          holder: bank_holder || "", // Đã có sẵn từ Store
        });

        // Tự động tạo QR nếu đã nhập số tiền
        // (Effect generateQR sẽ tự chạy khi manualBankInfo thay đổi)

        message.success(
          `Đã điền thông tin ngân hàng: ${bank_holder || bank_account}`
        );
      } else {
        message.info("Nhà cung cấp này chưa có thông tin ngân hàng.");
      }
    }
  };

  // --- LOGIC TÌM KIẾM ĐỐI TÁC (NEW) ---
  const handleSearchPartner = async (
    keyword: string,
    type: "customer" | "customer_b2b"
  ) => {
    if (!keyword) return;
    setIsSearching(true);
    try {
      if (type === "customer") {
        // B2C
        const dataB2C = await financeService.searchCustomersB2C(keyword);

        // Map data cho Select
        setPartnerOptions(
          (dataB2C as Array<Record<string, unknown>>).map((item) => ({
            label: `${String(item.name ?? "")} (${String(item.phone ?? "")})`,
            value: Number(item.id),
            original: item as PartnerOption["original"],
          }))
        );
      } else {
        // B2B
        const dataB2B = await financeService.searchCustomersB2B(keyword);

        setPartnerOptions(
          (dataB2B as Array<Record<string, unknown>>).map((item) => ({
            label: `${String(item.name ?? "")} - MST: ${String(item.tax_code ?? "")}`,
            value: Number(item.id),
            original: item as PartnerOption["original"],
          }))
        );
      }
    } catch (err) {
      console.error("Lỗi tìm kiếm:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPartner = async (
    partnerId: number,
    type: "customer" | "customer_b2b"
  ) => {
    // 1. Reset nợ cũ
    setCurrentDebt(null);

    // 2. Tìm object trong options để lấy tên hiển thị
    const selected = partnerOptions.find((opt) => opt.value === partnerId);
    if (selected) {
      // Set form field partner_name (để lưu vào DB)
      form.setFieldsValue({
        partner_name: selected.original.name,
        partner_id: partnerId, // Lưu ID
      });
    }

    // 3. Gọi API lấy nợ Real-time
    // 3. Gọi API lấy nợ Real-time
    try {
      const debt = await financeService.getPartnerDebt(partnerId, type);
      setCurrentDebt(debt);
    } catch (e) {
      console.error("Lỗi lấy công nợ:", e);
    }
  };

  const generateQR = (amount: number, desc: string) => {
    if (manualBankInfo.bin && manualBankInfo.acc && amount > 0) {
      const description = encodeURIComponent(desc || "Thanh toan");
      const accountName = encodeURIComponent(manualBankInfo.holder || "");
      const url = `https://img.vietqr.io/image/${manualBankInfo.bin}-${manualBankInfo.acc}-compact2.png?amount=${amount}&addInfo=${description}&accountName=${accountName}`;
      setQrUrl(url);
    } else {
      setQrUrl(null);
    }
  };

  const calculateCashTally = (values: Record<string, number>) => {
    if (!values) return;
    let total = 0;
    Object.entries(values).forEach(([denom, count]) => {
      total += Number(denom) * (count || 0);
    });
    setCashTallyTotal(total);
  };

  const handleFinish = async (values: FinanceFormValues) => {
    setLoading(true);
    try {
      let evidenceUrl = null;
      if (fileList.length > 0 && fileList[0].originFileObj) {
        try {
          evidenceUrl = await uploadFile(
            fileList[0].originFileObj,
            "finance_evidence"
          );
        } catch (err) {
          console.warn("Lỗi upload ảnh:", err);
        }
      }

      // [NEW] Prepare target_bank_info for 'out' flow
      let targetBankInfo = null;
      if (values.flow === "out" && manualBankInfo?.bin && manualBankInfo?.acc) {
        targetBankInfo = {
          bin: manualBankInfo.bin,
          acc: manualBankInfo.acc,
          holder: manualBankInfo.holder || "",
        };
      }

      // [NEW] B2B Bulk Payment Logic (Gọi RPC riêng biệt của Core thay vì tạo phiếu đơn lẻ)
      if (
        values.b2b_bulk_allocations &&
        values.b2b_bulk_allocations.length > 0
      ) {
        await financeService.processBulkPayment({
          p_customer_id: Number(values.partner_id),
          p_total_amount: Number(values.amount),
          p_allocations: values.b2b_bulk_allocations,
          p_fund_account_id: values.fund_account_id,
          p_description: values.description,
        });
        message.success("Phân bổ thanh toán và gạch nợ B2B thành công!");
        onCancel();
        return true;
      }

      // [REVERT 2026-04-24] Bỏ auto-completed cho phiếu thu order.
      // Nghiệp vụ: mọi phiếu tạo thủ công qua form đều phải status='pending'
      // → Thủ Quỹ vào "Quản lý Thu Chi" bấm "Xác nhận đã thu" mới chuyển
      // 'completed' → trigger auto_allocate_payment_to_orders fire → order
      // thành 'Đã TT'. Tránh tình trạng NV KD bấm tạo phiếu thu là đơn auto
      // 'Đã TT' dù tiền chưa thực nộp quỹ.
      // Ngoại lệ (thu qua quét QR Timo tự động): đi webhook SePay, INSERT
      // finance_transactions trực tiếp với status='completed', bypass form
      // này → không cần special-case ở đây.
      const defaultStatus = "pending";

      const payload: CreateTransactionParams = {
        p_flow: values.flow as "in" | "out",
        p_business_type: values.business_type ?? "trade",
        p_fund_id: Number(values.fund_account_id),
        p_amount: Number(values.amount),
        p_category_id: values.category_id,
        p_transaction_date: values.transaction_date
          ? values.transaction_date.toISOString()
          : new Date().toISOString(),
        p_description: values.description,
        p_status: defaultStatus,
        p_evidence_url: evidenceUrl || undefined,
        p_cash_tally: values.cash_tally,
        p_ref_advance_id: values.ref_advance_id,
        p_ref_type: values.ref_type,
        p_ref_id: values.ref_id,
        p_partner_type: "other",
        p_target_bank_info: targetBankInfo, // [NEW] Add to payload
      };

      // Xử lý đối tượng mặc định từ Select Form
      if (
        values.business_type === "advance" ||
        values.business_type === "reimbursement"
      ) {
        payload.p_partner_type = "employee";
        payload.p_partner_id = values.employee_id;
      } else if (values.business_type === "trade") {
        // [FIX BỌC THÉP] Truyền chính xác type mà user đã chọn trên Form
        payload.p_partner_type =
          values.partner_type as CreateTransactionParams["p_partner_type"];

        if (values.partner_type === "supplier") {
          // Fallback id nếu truyền nhầm sang partner_id
          const rawId = values.supplier_id ?? values.partner_id;
          payload.p_partner_id = rawId != null ? String(rawId) : undefined;

          const sup = suppliers.find(
            (s) => s.id === Number(payload.p_partner_id)
          );
          // Fallback name: Ưu tiên tên trong Store, nếu không có thì lấy tên từ form UI
          payload.p_partner_name = sup ? sup.name : values.partner_name;
        } else if (
          values.partner_type === "customer" ||
          values.partner_type === "customer_b2b"
        ) {
          payload.p_partner_id =
            values.partner_id != null ? String(values.partner_id) : undefined;
          payload.p_partner_name = values.partner_name;
        } else if (
          values.partner_type === "shipping_partner" ||
          values.partner_type === "other"
        ) {
          // Nhà xe hoặc Khác hiện tại chỉ nhập tên tay (Chưa có select ID)
          payload.p_partner_name = values.partner_name;
        }
      } else {
        payload.p_partner_type = "other";
        payload.p_partner_name = values.partner_name;
      }

      const success = await createTransaction(payload);
      if (success) onCancel();
      return success;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Có lỗi xảy ra";
      message.error(msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    form,
    loading,
    users,
    suppliers,
    openAdvances,
    categories,
    businessType,
    setBusinessType,
    qrUrl,
    setQrUrl,
    cashTallyTotal,
    calculateCashTally,
    fileList,
    setFileList,
    reimburseDiff,
    handleReimburseCalc,
    manualBankInfo,
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
  };
};

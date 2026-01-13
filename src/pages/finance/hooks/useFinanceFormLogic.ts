// src/pages/finance/hooks/useFinanceFormLogic.ts
import { Form, App } from "antd";
import { useState, useEffect, useCallback } from "react";

import type { UploadFile } from "antd/es/upload/interface";

import { uploadFile } from "@/shared/api/storageService";
import { useSupplierStore } from "@/features/purchasing/stores/supplierStore";
import { useFinanceStore } from "@/features/finance/stores/useFinanceStore";
import { useTransactionCategoryStore } from "@/features/finance/stores/useTransactionCategoryStore";
import { useUserStore } from "@/features/auth/stores/useUserStore";
import { CreateTransactionParams } from "@/features/finance/types/finance";

export const useFinanceFormLogic = (
  open: boolean,
  onCancel: () => void,
  initialFlow: "in" | "out",
  initialValues?: any // [NEW] Support pre-fill
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

  useEffect(() => {
    if (open) {
      form.resetFields();
      
      // 1. Set Default
      form.setFieldsValue({ flow: initialFlow, business_type: "trade" });

      // 2. [NEW] Pre-fill from Props (e.g. from PO Page)
      if (initialValues) {
         form.setFieldsValue(initialValues);
         
         // Update state if business_type changed
         if (initialValues.business_type) {
            setBusinessType(initialValues.business_type);
         }
         
         // Fix: If supplier_id provided -> Load Bank Info
         if (initialValues.supplier_id && suppliers.length > 0) {
             // Delay slightly to ensure suppliers loaded? Or just depend on suppliers
            const s = suppliers.find(x => x.id === initialValues.supplier_id);
            if(s) {
                 setManualBankInfo({
                    bin: s.bank_bin || '',
                    acc: s.bank_account || '',
                    holder: s.bank_holder || ''
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
      setReimburseDiff(null);
      // setManualBankInfo handled above

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
    suppliers.length,
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

  const handleFinish = async (values: any) => {
    setLoading(true);
    try {
      let evidenceUrl = null;
      if (fileList.length > 0 && fileList[0].originFileObj) {
        try {
          evidenceUrl = await uploadFile(
            fileList[0].originFileObj,
            "finance_evidence"
          );
        } catch (err: any) {
          console.warn("Lỗi upload ảnh:", err);
        }
      }

      const payload: CreateTransactionParams = {
        p_flow: values.flow,
        p_business_type: values.business_type,
        p_fund_id: values.fund_account_id,
        p_amount: values.amount,
        p_category_id: values.category_id,
        p_transaction_date: values.transaction_date ? values.transaction_date.toISOString() : new Date().toISOString(),
        p_description: values.description,
        p_status: "pending",
        p_evidence_url: evidenceUrl || undefined,
        p_cash_tally: values.cash_tally,
        p_ref_advance_id: values.ref_advance_id,
        p_ref_type: values.ref_type, // [NEW]
        p_ref_id: values.ref_id,     // [NEW]
        p_partner_type: "other",
      };

      if (["advance", "reimbursement"].includes(values.business_type)) {
        payload.p_partner_type = "employee";
        payload.p_partner_id = values.employee_id;
      } else if (values.business_type === "trade") {
        if (values.partner_type === "supplier") {
          payload.p_partner_type = "supplier";
          payload.p_partner_id = values.supplier_id;
          const sup = suppliers.find((s) => s.id === values.supplier_id);
          if (sup) payload.p_partner_name = sup.name;
        } else {
          payload.p_partner_type = "customer";
          payload.p_partner_name = values.partner_name;
        }
      } else {
        payload.p_partner_name = values.partner_name;
      }

      const success = await createTransaction(payload);
      if (success) onCancel();
    } catch (error: any) {
      message.error(error.message || "Có lỗi xảy ra");
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
  };
};

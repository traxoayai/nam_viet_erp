// src/features/pos/components/modals/VatInvoiceModal.tsx
import { Modal, Form, Input, Table, InputNumber, Tag, Button, Space, App } from "antd";
import { FileExcelOutlined, ThunderboltOutlined } from "@ant-design/icons";
import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import dayjs from "dayjs";

import { sepayService } from "@/features/finance/api/sepayService";
import type { SepayCreateInvoiceRequest } from "@/features/finance/types/sepay.types";
import { safeRpc } from "@/shared/lib/safeRpc";
import { supabase } from "@/shared/lib/supabaseClient";

interface Props {
  visible: boolean;
  onCancel: () => void;
  orderItems: any[];
  customer: any;
  onOk?: () => void;
}

export const VatInvoiceModal: React.FC<Props> = ({
  visible,
  onCancel,
  orderItems,
  customer,
  onOk,
}) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [vatItems, setVatItems] = useState<any[]>([]);
  const [sepayLoading, setSepayLoading] = useState(false);

  // 1. Auto-fill khi mở modal
  useEffect(() => {
    if (visible) {
      // Auto-fill customer info nếu có
      if (customer) {
        form.setFieldsValue({
          customer_name: customer.buyer_name || customer.name || "",
          tax_code: customer.tax_code || customer.id_card_number || "",
          address: customer.address || "",
          email: customer.email || "",
        });
      }
      // Luôn load VAT data khi có sản phẩm
      if (orderItems.length > 0) {
        checkVatBalance();
      }
    } else {
      form.resetFields();
      setVatItems([]);
    }
  }, [visible, customer, orderItems]);

  // 2a. Trừ kho VAT sau khi xuất SEPAY thành công (single atomic RPC)
  const deductVatAfterExport = async (items: any[]) => {
    try {
      const deductItems = items
        .filter((item) => item.vat_qty > 0)
        .map((item) => ({
          product_id: item.id,
          unit: item.unit || "Viên",
          quantity: item.vat_qty,
          vat_rate: item.vat_rate,
        }));

      if (deductItems.length === 0) return;

      await safeRpc("batch_deduct_vat_for_pos", {
        p_items: deductItems as any,
      });
    } catch (err: any) {
      message.warning("Lỗi trừ kho VAT - vui lòng kiểm tra thủ công");
    }
  };

  // 2b. Check VAT Balance (Giữ nguyên logic)
  const checkVatBalance = async () => {
    try {
      const productIds = orderItems.map((i) => i.id);
      const { data, error } = await supabase
        .from("vat_inventory_ledger")
        .select("product_id, quantity_balance, vat_rate")
        .in("product_id", productIds);

      if (error) throw error;

      const items = orderItems.map((item) => {
        const vatInfo = data?.find((v) => v.product_id === item.id);
        const rate = vatInfo?.vat_rate ?? 10; // Fallback 10% (dược phẩm)
        const balance = vatInfo?.quantity_balance ?? 0;
        const hasLedger = !!vatInfo;

        return {
          ...item,
          max_vat_qty: hasLedger ? balance : item.qty, // Không có kho VAT → cho xuất hết
          vat_qty: hasLedger ? Math.min(item.qty, balance) : item.qty,
          vat_rate: rate,
          has_ledger: hasLedger,
          status: hasLedger && item.qty > balance ? "shortage" : "enough",
        };
      });
      setVatItems(items);
    } catch (err) {
      console.error(err);
      message.error("Lỗi kiểm tra kho VAT");
    }
  };

  // 3. [UPDATE] Tính toán tổng tiền (BACK-CALCULATION LOGIC)
  // Giá bán (item.price) là giá ĐÃ GỒM THUẾ.
  // Đơn giá hóa đơn = Giá bán / (1 + VAT%)
  const totals = vatItems.reduce(
    (acc, item) => {
      const vatPercent = item.vat_rate / 100;

      // Tổng thanh toán (Gross) của dòng này
      const grossTotalLine = item.price * item.vat_qty;

      // Thành tiền trước thuế (Net Total) = Gross / (1 + VAT)
      const netTotalLine = grossTotalLine / (1 + vatPercent);

      // Tiền thuế = Gross - Net
      const taxLine = grossTotalLine - netTotalLine;

      return {
        goods: acc.goods + netTotalLine,
        tax: acc.tax + taxLine,
        pay: acc.pay + grossTotalLine,
      };
    },
    { goods: 0, tax: 0, pay: 0 }
  );

  // Helper 1 (Giữ nguyên)
  const getPaymentMethodCode = (method: string) => {
    const m = (method || "").toLowerCase();
    if (m.includes("chuyển khoản") || m.includes("bank")) return "2";
    if (m.includes("thẻ") || m.includes("card")) return "4";
    if (m.includes("công nợ") || m.includes("debt")) return "5";
    return "1";
  };

  // [FIXED] Export Excel với giá Net & Sửa lỗi Workbook Empty
  const handleExportExcel = async () => {
    // 1. Validate
    const invalidItems = vatItems.filter((i) => i.vat_qty > i.max_vat_qty);
    if (invalidItems.length > 0) {
      message.error("Có sản phẩm vượt quá tồn kho VAT cho phép!");
      return;
    }
    const validItems = vatItems.filter((i) => i.vat_qty > 0);
    if (validItems.length === 0) {
      message.warning("Không có sản phẩm nào để xuất!");
      return;
    }

    try {
      // [FIXED] Lấy dữ liệu mới nhất từ Form (Do người dùng đã check/sửa)
      const values = form.getFieldsValue();

      // 2. Prepare Data Headers (Theo Template MISA/Viettel/VNPT phổ biến)
      const headers = [
        "Mã hóa đơn",
        "Mã số thuế",
        "Mã QHNSNN",
        "Tên đơn vị, tổ chức",
        "Người mua hàng",
        "Số CCCD/Số hộ chiếu",
        "Địa chỉ",
        "Số điện thoại",
        "Email",
        "Hình thức thanh toán",
        "Số tài khoản ngân hàng",
        "Tên ngân hàng",
        "Tiền chiết khấu",
        "Ghi chú",
        "Loại hàng hóa",
        "Tên hàng hóa",
        "Đơn vị tính",
        "Số lượng",
        "Đơn giá",
        "Thành tiền",
        "VAT",
        "Tổng tiền hàng",
        "Tổng tiền thuế",
        "Tổng tiền thanh toán",
      ];

      const invoiceCode = `HD_${orderItems[0]?.code || Date.now()}`;
      const paymentMethod = getPaymentMethodCode(
        customer?.payment_method || "cash"
      );

      // 3. Map Data Rows
      const excelRows = validItems.map((item, index) => {
        const isBaseRow = index === 0;

        let vatStr = String(item.vat_rate);
        if (vatStr === "0") vatStr = "0";

        // Tính toán Net/Gross
        const vatPercent = item.vat_rate / 100;
        const grossPrice = item.price;
        const netPrice = grossPrice / (1 + vatPercent);
        const netAmount = netPrice * item.vat_qty;

        // --- LOGIC MAPPING MỚI ---
        // 1. Tên Người Mua (Col E): Luôn lấy từ customer_name trên Form
        const buyerName = values.customer_name || "";

        // 2. Tên Đơn vị (Col D): Nếu MST dài -> Công ty, ngược lại -> Trống (hoặc tùy logic Sếp)
        const taxCode = values.tax_code || "";
        const companyName =
          taxCode.length >= 10 && !taxCode.includes("-")
            ? values.customer_name
            : "";

        // 3. Địa chỉ & Email
        const address = values.address || "";
        const email = values.email || "";

        return [
          invoiceCode, // A: Mã hóa đơn
          taxCode, // B: Mã số thuế (Ưu tiên điền vào đây)
          "", // C
          companyName, // D: Tên đơn vị
          buyerName, // E: Người mua hàng (QUAN TRỌNG: Đã fix)
          taxCode, // F: Số CCCD/Hộ chiếu (Điền luôn MST/CCCD vào đây cho chắc)
          address, // G: Địa chỉ (QUAN TRỌNG: Đã fix)
          customer?.phone || "", // H: SĐT
          email, // I: Email
          isBaseRow ? paymentMethod : "", // J
          "",
          "",
          0,
          "",
          "0", // K, L, M, N, O
          item.name, // P: Tên hàng
          item.unit || "Cái", // Q: ĐVT
          item.vat_qty, // R: Số lượng
          parseFloat(netPrice.toFixed(2)), // S: Đơn giá (Trước thuế)
          parseFloat(netAmount.toFixed(2)), // T: Thành tiền (Trước thuế)
          vatStr, // U: Thuế suất
          isBaseRow ? parseFloat(totals.goods.toFixed(0)) : "", // V: Tổng tiền hàng
          isBaseRow ? parseFloat(totals.tax.toFixed(0)) : "", // W: Tổng tiền thuế
          isBaseRow ? parseFloat(totals.pay.toFixed(0)) : "", // X: Tổng thanh toán
        ];
      });

      // 4. Create Workbook & Worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...excelRows]);

      // [FIX CRITICAL] THÊM DÒNG NÀY ĐỂ GHIM SHEET VÀO WORKBOOK
      XLSX.utils.book_append_sheet(wb, ws, "Danh sách hàng hóa");

      // 5. Format Column Width
      ws["!cols"] = [
        { wch: 15 },
        { wch: 15 },
        { wch: 10 },
        { wch: 30 },
        { wch: 20 },
        { wch: 15 },
        { wch: 40 },
        { wch: 15 },
        { wch: 25 },
        { wch: 10 },
        { wch: 15 },
        { wch: 15 },
        { wch: 10 },
        { wch: 20 },
        { wch: 8 },
        { wch: 30 },
        { wch: 8 },
        { wch: 10 },
        { wch: 12 },
        { wch: 15 },
        { wch: 8 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
      ];

      // 6. Write File
      const fileName = `VAT_${invoiceCode}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);

      // Trừ kho VAT sau khi xuất Excel (giống SEPAY path)
      await deductVatAfterExport(validItems);

      if (onOk) onOk();
      message.success("Đã xuất file Excel thành công!");
      onCancel();
    } catch (err: any) {
      console.error(err);
      message.error("Lỗi tạo file Excel: " + err.message);
    }
  };
  // SEPAY E-Invoice Export
  const handleSepayExport = async () => {
    const invalidItems = vatItems.filter((i) => i.vat_qty > i.max_vat_qty);
    if (invalidItems.length > 0) {
      message.error("Có sản phẩm vượt quá tồn kho VAT cho phép!");
      return;
    }
    const validItems = vatItems.filter((i) => i.vat_qty > 0);
    if (validItems.length === 0) {
      message.warning("Không có sản phẩm nào để xuất!");
      return;
    }

    try {
      const values = await form.validateFields();
      setSepayLoading(true);

      const taxCode = values.tax_code || "";
      const isCompany = taxCode.length >= 10 && !taxCode.includes("-");

      // Config (template_code, invoice_series, provider_account_id)
      // được xử lý server-side trong Edge Function sepay-proxy
      const payload: SepayCreateInvoiceRequest = {
        template_code: "",
        invoice_series: "",
        issued_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        currency: "VND",
        provider_account_id: "",
        payment_method: "TM/CK",
        is_draft: false,
        buyer: {
          type: isCompany ? "company" : "personal",
          name: values.customer_name || "",
          legal_name: isCompany ? values.customer_name : undefined,
          tax_code: taxCode || undefined,
          address: values.address || undefined,
          email: values.email || undefined,
        },
        items: validItems.map((item, idx) => {
          const vatPercent = item.vat_rate / 100;
          const netPrice = item.price / (1 + vatPercent);
          return {
            line_number: idx + 1,
            line_type: 1 as const,
            item_code: item.sku || item.barcode,
            item_name: item.name,
            unit: item.unit || "Cái",
            quantity: item.vat_qty,
            unit_price: Math.round(netPrice),
            tax_rate: item.vat_rate as any,
          };
        }),
      };

      const result = await sepayService.createInvoice(payload);

      if (result.success) {
        message.success(
          `Đã gửi SEPAY! Tracking: ${result.data.tracking_code}`
        );

        // Trừ kho VAT ngay sau khi SEPAY accept
        await deductVatAfterExport(validItems);

        // Poll for completion (non-blocking)
        try {
          const finalResult = await sepayService.pollUntilComplete(
            result.data.tracking_code
          );
          const pdfUrl = finalResult.data?.invoice?.pdf_url;
          if (pdfUrl) {
            message.success("Hóa đơn đã xuất thành công!");
            window.open(pdfUrl, "_blank");
          }
        } catch {
          message.info(
            "Hóa đơn đang xử lý. Kiểm tra lại sau."
          );
        }

        if (onOk) onOk();
        onCancel();
      }
    } catch (err: any) {
      message.error(err.message || "Lỗi xuất hóa đơn qua SEPAY");
    } finally {
      setSepayLoading(false);
    }
  };

  // 4. [UPDATE] Cấu hình cột hiển thị trên Modal
  const columns = [
    { title: "Sản phẩm", dataIndex: "name" },
    {
      title: "SL Mua",
      dataIndex: "qty",
      align: "center" as const,
      render: (v: number) => <span className="text-gray-400">{v}</span>,
      width: 100,
    },
    {
      title: "ĐVT",
      dataIndex: "unit",
      align: "center" as const,
      width: 60,
      render: (u: string) => <Tag>{u || "Cái"}</Tag>,
    },
    {
      title: "SL Xuất VAT",
      width: 120,
      render: (_: any, r: any, idx: number) => (
        <div>
          <InputNumber
            min={0}
            max={r.max_vat_qty}
            value={r.vat_qty}
            onChange={(val) => {
              const newItems = vatItems.map((item, i) =>
                i === idx ? { ...item, vat_qty: val || 0 } : item
              );
              setVatItems(newItems);
            }}
            status={r.vat_qty > r.max_vat_qty ? "error" : ""}
            size="small"
            style={{ width: 70 }}
          />
          <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
            {r.has_ledger ? (
              <>Kho: {r.max_vat_qty}{r.qty > r.max_vat_qty && <span style={{ color: "#ff4d4f", marginLeft: 4 }}>Thiếu</span>}</>
            ) : (
              <span style={{ color: "#1677ff" }}>VAT {r.vat_rate}%</span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "VAT (%)",
      dataIndex: "vat_rate",
      align: "center" as const,
      render: (v: number) => <Tag color="blue">{v}%</Tag>,
    },

    // [NEW COLUMN] Hiển thị đơn giá Net để User đối chiếu
    {
      title: "Đơn giá (Net)",
      align: "right" as const,
      render: (_: any, r: any) => {
        const netPrice = r.price / (1 + r.vat_rate / 100);
        return (
          <div>
            <div className="font-medium">
              {netPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-gray-400">
              Giá bán: {r.price.toLocaleString()}
            </div>
          </div>
        );
      },
    },

    {
      title: "Thành tiền (Net)",
      align: "right" as const,
      render: (_: any, r: any) => {
        const netPrice = r.price / (1 + r.vat_rate / 100);
        return (netPrice * r.vat_qty).toLocaleString(undefined, {
          maximumFractionDigits: 0,
        });
      },
    },
  ];

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <span className="text-blue-600 font-bold">XUẤT HÓA ĐƠN VAT</span>{" "}
          <Tag color="geekblue">E-Invoice</Tag>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      width={950}
      footer={
        <Space>
          <Button onClick={onCancel}>Hủy</Button>
          <Button
            icon={<FileExcelOutlined />}
            onClick={handleExportExcel}
          >
            Tải file Excel
          </Button>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleSepayExport}
            loading={sepayLoading}
          >
            Xuất qua SEPAY (E-Invoice)
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" className="mb-4">
        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <Form.Item
            name="customer_name"
            label="Tên Đơn vị / Khách hàng"
            rules={[{ required: true }]}
          >
            <Input placeholder="Nhập tên..." />
          </Form.Item>
          <Form.Item
            name="tax_code"
            label="Mã số thuế / CCCD"
            rules={[{ required: true }]}
          >
            <Input placeholder="Nhập MST..." />
          </Form.Item>
          <Form.Item
            name="address"
            label="Địa chỉ xuất hóa đơn"
            className="col-span-2"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email nhận hóa đơn"
            className="col-span-2"
          >
            <Input placeholder="khachhang@example.com" />
          </Form.Item>
        </div>
      </Form>

      <Table
        dataSource={vatItems}
        columns={columns}
        pagination={false}
        size="small"
        rowKey="id"
        scroll={{ y: 250 }}
      />

      <div className="flex justify-end mt-4 text-right gap-8 bg-blue-50 p-4 rounded-lg border border-blue-100">
        <div>
          <div className="text-xs text-gray-500">Tổng tiền hàng (Net)</div>
          <div className="font-bold">
            {totals.goods.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Tiền thuế GTGT</div>
          <div className="font-bold text-red-600">
            {totals.tax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Tổng thanh toán</div>
          <div className="font-bold text-xl text-blue-700">
            {totals.pay.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-gray-400">(Khớp giá bán lẻ)</div>
        </div>
      </div>
    </Modal>
  );
};

// src/features/pos/components/modals/VatInvoiceModal.tsx
import { Modal, Form, Input, Table, InputNumber, message, Tag } from "antd";
import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";

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
  const [form] = Form.useForm();
  const [vatItems, setVatItems] = useState<any[]>([]);

  // 1. Auto-fill khi mở modal
  useEffect(() => {
    if (visible && customer) {
      form.setFieldsValue({
        // Ưu tiên lấy buyer_name nếu có, không thì lấy name
        customer_name: customer.buyer_name || customer.name || "",

        // Map CCCD/MST vào chung 1 trường tax_code
        tax_code: customer.tax_code || customer.id_card_number || "",

        address: customer.address || "",
        email: customer.email || "",
      });
      checkVatBalance();
    } else if (!visible) {
      form.resetFields();
    }
  }, [visible, customer, orderItems]);

  // 2. Check VAT Balance (Giữ nguyên logic)
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
        const rate = vatInfo?.vat_rate ?? 0;
        const balance = vatInfo?.quantity_balance ?? 0;

        return {
          ...item,
          max_vat_qty: balance,
          vat_qty: Math.min(item.qty, balance),
          vat_rate: rate,
          status: item.qty > balance ? "shortage" : "enough",
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

      if (onOk) onOk();
      message.success("Đã xuất file Excel thành công!");
      onCancel();
    } catch (err: any) {
      console.error(err);
      message.error("Lỗi tạo file Excel: " + err.message);
    }
  };
  // [UPDATE] Export Excel với giá Net
  //   const handleExportExcel = async () => {
  //     // Validate (Giữ nguyên)
  //     const invalidItems = vatItems.filter(i => i.vat_qty > i.max_vat_qty);
  //     if (invalidItems.length > 0) {
  //         message.error("Có sản phẩm vượt quá tồn kho VAT cho phép!");
  //         return;
  //     }
  //     const validItems = vatItems.filter(i => i.vat_qty > 0);
  //     if (validItems.length === 0) {
  //         message.warning("Không có sản phẩm nào để xuất!");
  //         return;
  //     }

  //     try {
  //         // Header (Giữ nguyên)
  //         const headers = [
  //             "Mã hóa đơn", "Mã số thuế", "Mã QHNSNN", "Tên đơn vị, tổ chức", "Người mua hàng",
  //             "Số CCCD/Số hộ chiếu", "Địa chỉ", "Số điện thoại", "Email", "Hình thức thanh toán",
  //             "Số tài khoản ngân hàng", "Tên ngân hàng", "Tiền chiết khấu", "Ghi chú", "Loại hàng hóa",
  //             "Tên hàng hóa", "Đơn vị tính", "Số lượng", "Đơn giá", "Thành tiền",
  //             "VAT", "Tổng tiền hàng", "Tổng tiền thuế", "Tổng tiền thanh toán"
  //         ];

  //         const invoiceCode = `HD_${orderItems[0]?.code || Date.now()}`; // Fix: order_code -> code (nếu item map từ RPC)
  //         const paymentMethod = getPaymentMethodCode(customer?.payment_method || 'cash');

  //         const excelRows = validItems.map((item, index) => {
  //             const isBaseRow = index === 0;

  //             let vatStr = String(item.vat_rate);
  //             if (vatStr === '0') vatStr = '0';

  //             // [LOGIC MỚI] Tính toán cho từng dòng Excel
  //             const vatPercent = item.vat_rate / 100;
  //             const grossPrice = item.price; // Giá bán lẻ (đã gồm thuế)

  //             // Đơn giá (Net Price) để in lên hóa đơn
  //             const netPrice = grossPrice / (1 + vatPercent);

  //             // Thành tiền (Net Amount)
  //             const netAmount = netPrice * item.vat_qty;

  //             return [
  //                 invoiceCode,                            // A
  //                 customer?.tax_code || '',               // B
  //                 '',                                     // C
  //                 customer?.customer_name || '',          // D
  //                 customer?.buyer_name || '',             // E
  //                 '',                                     // F
  //                 customer?.address || '',                // G
  //                 customer?.phone || '',                  // H
  //                 customer?.email || '',                  // I
  //                 isBaseRow ? paymentMethod : '',         // J
  //                 '', '', 0, '', '0',                     // K, L, M, N, O
  //                 item.name,                              // P
  //                 item.unit || 'Cái',                     // Q
  //                 item.vat_qty,                           // R: Số lượng

  //                 // [FIX] Cột S: Xuất Đơn giá Net (Làm tròn 2 số lẻ nếu cần)
  //                 parseFloat(netPrice.toFixed(2)),        // S

  //                 // [FIX] Cột T: Thành tiền Net
  //                 parseFloat(netAmount.toFixed(2)),       // T

  //                 vatStr,                                 // U

  //                 // Tổng (Chỉ dòng đầu)
  //                 isBaseRow ? parseFloat(totals.goods.toFixed(0)) : '',  // V
  //                 isBaseRow ? parseFloat(totals.tax.toFixed(0)) : '',    // W
  //                 isBaseRow ? parseFloat(totals.pay.toFixed(0)) : ''     // X: Tổng thanh toán (Khớp giá bán)
  //             ];
  //         });

  //         const wb = XLSX.utils.book_new();
  //         const ws = XLSX.utils.aoa_to_sheet([headers, ...excelRows]);
  //         ws['!cols'] = [{wch:15}, {wch:15}, {wch:10}, {wch:30}, {wch:20}, {wch:15}, {wch:40}, {wch:15}, {wch:25}, {wch:10}, {wch:15}, {wch:15}, {wch:10}, {wch:20}, {wch:8}, {wch:30}, {wch:8}, {wch:10}, {wch:12}, {wch:15}, {wch:8}, {wch:15}, {wch:15}, {wch:15}];

  //         const fileName = `VAT_${invoiceCode}_${new Date().toISOString().slice(0,10)}.xlsx`;
  //         XLSX.writeFile(wb, fileName);

  //         if (onOk) onOk();
  //         message.success("Đã xuất file Excel chuẩn định dạng!");
  //         onCancel();

  //     } catch (err: any) {
  //         console.error(err);
  //         message.error("Lỗi tạo file Excel: " + err.message);
  //     }
  //   };

  // 4. [UPDATE] Cấu hình cột hiển thị trên Modal
  const columns = [
    { title: "Sản phẩm", dataIndex: "name" },
    {
      title: "SL Mua",
      dataIndex: "qty",
      align: "center" as const,
      render: (v: number) => <span className="text-gray-400">{v}</span>,
    },
    {
      title: "ĐVT",
      dataIndex: "unit",
      align: "center" as const,
      width: 80,
      render: (u: string) => <Tag>{u || "Cái"}</Tag>,
    },
    {
      title: "SL Xuất VAT",
      width: 140,
      render: (_: any, r: any, idx: number) => (
        <div>
          <InputNumber
            min={0}
            max={r.max_vat_qty}
            value={r.vat_qty}
            onChange={(val) => {
              const newItems = [...vatItems];
              newItems[idx].vat_qty = val || 0;
              setVatItems(newItems);
            }}
            status={r.vat_qty > r.max_vat_qty ? "error" : ""}
            style={{ width: "100%" }}
          />
          <div className="flex justify-between text-[10px] mt-1">
            <span className="text-gray-500">Kho: {r.max_vat_qty}</span>
            {r.qty > r.max_vat_qty && (
              <Tag color="red" style={{ margin: 0 }}>
                Thiếu hàng
              </Tag>
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
      onOk={() => handleExportExcel()}
      okText="Xác nhận & Tải file Excel"
    >
      <Form form={form} layout="vertical" className="mb-4">
        {/* ... (Giữ nguyên form inputs) ... */}
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

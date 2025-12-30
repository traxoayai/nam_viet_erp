import React, { useEffect, useState } from "react";
import { Modal, Form, Input, Table, InputNumber, message, Tag } from "antd";
import { supabase } from "@/shared/lib/supabaseClient";

interface Props {
  visible: boolean;
  onCancel: () => void;
  orderItems: any[];
  totalAmount: number;
  customer: any; // [NEW] Nhận object khách hàng từ POS
}

export const VatInvoiceModal: React.FC<Props> = ({ visible, onCancel, orderItems, customer }) => {
  const [form] = Form.useForm();
  const [vatItems, setVatItems] = useState<any[]>([]);
  // const [loading, setLoading] = useState(false);

  // 1. Tự động điền thông tin khi mở Modal
  useEffect(() => {
    if (visible) {
      // Auto-fill thông tin khách hàng
      if (customer) {
        form.setFieldsValue({
            customer_name: customer.name, // Ưu tiên tên cty nếu là khách B2B
            tax_code: customer.tax_code || "", // Nếu bảng customer có cột này
            address: customer.address || "",
            email: customer.email || ""
        });
      } else {
        form.resetFields();
      }
      
      checkVatBalance();
    }
  }, [visible, customer, orderItems]);

  // 2. Check tồn kho VAT và Auto-fill số lượng
  const checkVatBalance = async () => {
    // setLoading(true);
    try {
      const productIds = orderItems.map(i => i.id);
      
      // Lấy tồn kho VAT thực tế
      const { data, error } = await supabase
        .from('vat_inventory_ledger')
        .select('product_id, quantity_balance, vat_rate')
        .in('product_id', productIds);
      
      if (error) throw error;

      const items = orderItems.map(item => {
        const vatInfo = data?.find(v => v.product_id === item.id);
        
        // Logic Rate: Nếu không có trong DB thì để 0 (User tự sửa nếu cần)
        const rate = vatInfo?.vat_rate ?? 0; 
        const balance = vatInfo?.quantity_balance ?? 0;

        return {
          ...item,
          max_vat_qty: balance, 
          // Mặc định xuất bằng số lượng mua, nhưng không quá tồn kho VAT
          vat_qty: Math.min(item.qty, balance), 
          vat_rate: rate,
          status: item.qty > balance ? 'shortage' : 'enough' // Cờ đánh dấu trạng thái
        };
      });
      setVatItems(items);
    } catch (err) {
      console.error(err);
      message.error("Lỗi kiểm tra kho VAT");
    } finally {
      // setLoading(false);
    }
  };

  // 3. Tính toán tổng tiền
  const totals = vatItems.reduce((acc, item) => {
      const amt = item.price * item.vat_qty;
      const tax = amt * (item.vat_rate / 100);
      return { 
          goods: acc.goods + amt, 
          tax: acc.tax + tax, 
          pay: acc.pay + amt + tax 
      };
  }, { goods: 0, tax: 0, pay: 0 });

  const columns = [
    { title: 'Sản phẩm', dataIndex: 'name' },
    { 
        title: 'SL Mua', 
        dataIndex: 'qty', 
        align: 'center' as const, 
        render: (v: number) => <span className="text-gray-400">{v}</span> 
    },
    { 
        title: 'SL Xuất VAT', 
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
                   status={r.vat_qty > r.max_vat_qty ? 'error' : ''}
                   style={{ width: '100%' }}
                />
                <div className="flex justify-between text-[10px] mt-1">
                    <span className="text-gray-500">Kho: {r.max_vat_qty}</span>
                    {r.qty > r.max_vat_qty && <Tag color="red" style={{margin:0}}>Thiếu hàng</Tag>}
                </div>
            </div>
        )
    },
    { 
        title: 'VAT (%)', 
        dataIndex: 'vat_rate',
        align: 'center' as const,
        render: (v: number) => <Tag color="blue">{v}%</Tag>
    },
    { 
        title: 'Thành tiền', 
        align: 'right' as const,
        render: (_: any, r: any) => (r.price * r.vat_qty).toLocaleString() 
    }
  ];

  return (
    <Modal 
       title={<div className="flex items-center gap-2"><span className="text-blue-600 font-bold">XUẤT HÓA ĐƠN VAT</span> <Tag color="geekblue">E-Invoice</Tag></div>}
       open={visible} 
       onCancel={onCancel}
       width={950}
       onOk={() => { /* Logic submit form */ }}
       okText="Phát hành Hóa đơn"
    >
       <Form form={form} layout="vertical" className="mb-4">
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <Form.Item name="customer_name" label="Tên Đơn vị / Khách hàng" rules={[{ required: true }]}>
                  <Input placeholder="Nhập tên..." />
              </Form.Item>
              <Form.Item name="tax_code" label="Mã số thuế / CCCD" rules={[{ required: true }]}>
                  <Input placeholder="Nhập MST..." />
              </Form.Item>
              <Form.Item name="address" label="Địa chỉ xuất hóa đơn" className="col-span-2" rules={[{ required: true }]}>
                  <Input />
              </Form.Item>
              <Form.Item name="email" label="Email nhận hóa đơn" className="col-span-2">
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
           <div><div className="text-xs text-gray-500">Tổng tiền hàng</div><div className="font-bold">{totals.goods.toLocaleString()}</div></div>
           <div><div className="text-xs text-gray-500">Tiền thuế GTGT</div><div className="font-bold text-red-600">{totals.tax.toLocaleString()}</div></div>
           <div><div className="text-xs text-gray-500">Tổng thanh toán</div><div className="font-bold text-xl text-blue-700">{totals.pay.toLocaleString()}</div></div>
       </div>
    </Modal>
  );
};
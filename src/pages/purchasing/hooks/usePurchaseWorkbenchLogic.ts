import { Form, message, Modal } from "antd";
import { useState, useCallback, useEffect } from "react";
import { purchaseOrderService } from "@/features/purchasing/api/purchaseOrderService";
import { useProductStore } from "@/features/product/stores/productStore";
import dayjs from "dayjs";

export interface WorkbenchItem {
  id?: string;
  product_id: string;
  product_name?: string;
  sku?: string;
  product_image?: string;
  unit_name?: string;
  quantity: number;
  unit_price: number; 
  vat_rate: number;
  discount_rate: number;
  allocated_shipping: number;
  bonus_quantity: number; // [SENKO FIX]: Thêm trường Số lượng tặng
  final_base_cost?: number; 
}

export interface WorkbenchFormValues {
  supplier_id?: string;
  expected_delivery_date?: any;
  shipping_method?: string;
  shipping_company?: string;
  shipper_name?: string;
  shipper_phone?: string;
  total_packages?: number;
  shipping_fee: number;
  supplier_program_id?: string;
  items: WorkbenchItem[];
}

export const usePurchaseWorkbenchLogic = (poId?: string) => {
  const [form] = Form.useForm<WorkbenchFormValues>();
  const [poStatus, setPoStatus] = useState<"DRAFT" | "PENDING" | "CONFIRMED" | "COMPLETED">("DRAFT");
  
  const [totals, setTotals] = useState({
    totalGoods: 0,
    totalVat: 0,
    totalShipping: 0,
    totalDiscount: 0,
    finalTotal: 0,
  });

  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const { suppliers, fetchCommonData } = useProductStore();

  useEffect(() => {
    // Chỉ fetch nếu chưa có dữ liệu NCC
    if (suppliers.length === 0) {
      fetchCommonData();
    }
    if (poId && poId !== 'new') {
      loadOrder(poId);
    }
  }, [poId]);

  const loadOrder = async (id: string) => {
    try {
      setLoading(true);
      const rawData = await purchaseOrderService.getPODetail(Number(id));
      if (!rawData) throw new Error("Không tìm thấy đơn hàng");
      const data = rawData as unknown as Record<string, unknown>;
      setPoStatus(data.status as "DRAFT" | "PENDING" | "CONFIRMED" | "COMPLETED");

      form.setFieldsValue({
        supplier_id: data.supplier_id as string,
        expected_delivery_date: data.expected_delivery_date ? dayjs(data.expected_delivery_date as string) : undefined,
        shipping_method: data.shipping_method as string,
        shipping_company: data.shipping_company as string,
        shipper_name: data.shipper_name as string,
        shipper_phone: data.shipper_phone as string,
        total_packages: (data.total_packages as number) || 0,
        shipping_fee: Number(data.shipping_fee) || 0,
        items: ((data.items as unknown[]) || []).map((item: unknown) => {
          const i = item as WorkbenchItem & Record<string, unknown>;
          return {
            ...i,
            is_bonus: (i.quantity as number) === 0 && (i.bonus_quantity as number) > 0,
          };
        }) as WorkbenchItem[],
      });
      calculateTotals();
    } catch (error: any) {
      console.error(error);
      message.error("Lỗi tải đơn mua: " + (error.message || ""));
    } finally {
      setLoading(false);
    }
  };

  // [SENKO FIX 1 & 2]: Tính toán an toàn & Phân bổ Ship theo Giá trị
  const calculateTotals = useCallback(() => {
    const items = form.getFieldValue('items') || [];
    const shippingFee = form.getFieldValue('shipping_fee') || 0;

    let totalGoods = 0;
    let totalVat = 0;
    let totalDiscount = 0;
    let totalLineValue = 0; // Dùng để chia tỷ trọng Ship

    // Bước 1: Tính tổng giá trị để phân bổ
    items.forEach((item: WorkbenchItem) => {
      const qty = item.quantity || 0;
      const price = item.unit_price || 0;
      totalLineValue += (qty * price); 
    });

    // Bước 2: Tính chi tiết từng dòng
    const newItems = items.map((item: WorkbenchItem) => {
      const qty = item.quantity || 0;
      const price = item.unit_price || 0;
      const vat = item.vat_rate || 0;
      const discount = item.discount_rate || 0;
      const bonusQty = item.bonus_quantity || 0; // [SENKO FIX 3]

      const lineTotal = qty * price;
      const lineDiscount = lineTotal * (discount / 100);
      const lineAfterDiscount = lineTotal - lineDiscount;
      const lineVat = lineAfterDiscount * (vat / 100);

      totalGoods += lineTotal;
      totalDiscount += lineDiscount;
      totalVat += lineVat;

      // Phân bổ Ship theo Giá Trị (Value-based Allocation)
      const allocated_shipping = totalLineValue > 0 ? (lineTotal / totalLineValue) * shippingFee : 0;
      
      // Tính Giá Vốn cuối cùng
      let final_base_cost = 0;
      const totalQtyReceived = qty + bonusQty;
      if (totalQtyReceived > 0) {
        final_base_cost = (lineAfterDiscount + lineVat + allocated_shipping) / totalQtyReceived;
      }

      return {
        ...item,
        allocated_shipping,
        final_base_cost
      };
    });

    // Chỉ cập nhật UI, KO gọi setFieldsValue để tránh Loop
    setTotals({
      totalGoods,
      totalVat,
      totalShipping: shippingFee,
      totalDiscount,
      finalTotal: totalGoods + totalVat + shippingFee - totalDiscount,
    });

    // Trả về item mới để UI dùng nếu cần thiết (Tránh gõ 1 cái giật 1 cái)
    return newItems;
  }, [form]);

  const handleValuesChange = (changedValues: any, allValues: any) => {
    // Nếu người dùng đang gõ vào final_base_cost, KHÔNG tính toán lại tổng
    if (changedValues.items) {
      const isEditingBaseCost = changedValues.items.some((item: any) => item && item.final_base_cost !== undefined);
      if (isEditingBaseCost) {
        // Chỉ tính tổng giá, ko chạy thuật toán allocate để ghi đè base_cost
        updateFinalTotalOnly(allValues);
        return;
      }
    }
    
    if (changedValues.items || changedValues.shipping_fee !== undefined) {
       calculateTotals();
    }
  };

  const updateFinalTotalOnly = (allValues: any) => {
    const items = allValues.items || [];
    const shippingFee = allValues.shipping_fee || 0;
    
    let totalGoods = 0;
    let totalVat = 0;
    let totalDiscount = 0;

    items.forEach((item: any) => {
      const qty = item.quantity || 0;
      const price = item.unit_price || 0;
      const vat = item.vat_rate || 0;
      const discount = item.discount_rate || 0;

      const lineTotal = qty * price;
      const lineDiscount = lineTotal * (discount / 100);
      const lineAfterDiscount = lineTotal - lineDiscount;
      const lineVat = lineAfterDiscount * (vat / 100);

      totalGoods += lineTotal;
      totalDiscount += lineDiscount;
      totalVat += lineVat;
    });

    setTotals({
      totalGoods,
      totalVat,
      totalShipping: shippingFee,
      totalDiscount,
      finalTotal: totalGoods + totalVat + shippingFee - totalDiscount,
    });
  };

  const handleSelectProduct = (_: any, option: any) => {
    if (!option) return;
    const product = option.product;
    if (!product) return;

    const currentItems = form.getFieldValue("items") || [];
    
    const newItem: WorkbenchItem = {
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      product_image: product.image_url,
      unit_name: product.purchasing_unit || product.wholesale_unit || "Cái",
      quantity: 1,
      bonus_quantity: 0,
      unit_price: product.actual_cost || 0,
      vat_rate: 0,
      discount_rate: 0,
      allocated_shipping: 0,
    };

    form.setFieldsValue({ items: [...currentItems, newItem] });
    calculateTotals();
  };

  const handleRemoveItem = (index: number) => {
    const currentItems = form.getFieldValue("items") || [];
    const newItems = [...currentItems];
    newItems.splice(index, 1);
    form.setFieldsValue({ items: newItems });
    calculateTotals();
  };

  const handleUploadXML = (_file: File) => {
    setTimeout(() => {
      const mockDataFromXml: WorkbenchItem[] = [];
      Modal.confirm({
        title: 'Phát hiện dữ liệu Hóa đơn XML',
        content: 'Ghi đè hay Cộng dồn?',
        okText: 'Ghi đè',
        cancelText: 'Cộng dồn',
        onOk() {
          form.setFieldsValue({ items: mockDataFromXml });
          calculateTotals();
          message.success('Đã ghi đè dữ liệu từ XML');
        },
        onCancel() {
          const currentItems = form.getFieldValue('items') || [];
          form.setFieldsValue({ items: [...currentItems, ...mockDataFromXml] });
          calculateTotals();
          message.success('Đã cộng dồn dữ liệu từ XML');
        }
      });
    }, 500);
    return false;
  };

  const handleSaveDraft = async () => {
    try {
      setSaveLoading(true);
      const values = await form.validateFields();
      const payload = { ...values };

      if (poId && poId !== 'new') {
        await purchaseOrderService.updatePO(Number(poId), payload, values.items);
        message.success("Cập nhật nháp thành công");
      } else {
        const createPayload = {
          ...payload,
          supplier_id: Number(payload.supplier_id),
          status: "DRAFT" as "DRAFT" | "PENDING",
        };
        await purchaseOrderService.createPO(createPayload);
        message.success("Tạo đơn mua hàng thành công");
      }
    } catch (error: any) {
      if (!error.errorFields) {
        message.error("Lỗi: " + (error.message || ""));
      }
    } finally {
      setSaveLoading(false);
    }
  };

  const handleOrder = async () => {
    if (!poId || poId === 'new') {
      message.error("Vui lòng lưu nháp trước khi đặt hàng");
      return;
    }
    try {
      setSaveLoading(true);
      await purchaseOrderService.confirmPO(Number(poId));
      message.success("Đặt hàng thành công");
      loadOrder(poId); // reload status
    } catch (error: any) {
      console.error(error);
      message.error("Lỗi: " + (error.message || ""));
    } finally {
      setSaveLoading(false);
    }
  };

  const showSaveDraft = poStatus === 'DRAFT';
  const showPrint = true; 
  const showOrder = poStatus === 'DRAFT';
  const showPayment = poStatus === 'PENDING' || poStatus === 'CONFIRMED';
  const showUpdateCost = poStatus === 'PENDING' || poStatus === 'CONFIRMED';

  return {
    form,
    poStatus,
    setPoStatus,
    loading,
    saveLoading,
    totals,
    suppliers,
    handleValuesChange,
    handleUploadXML,
    calculateTotals,
    handleSelectProduct,
    handleRemoveItem,
    handleSaveDraft,
    handleOrder,
    flags: {
      showSaveDraft,
      showPrint,
      showOrder,
      showPayment,
      showUpdateCost
    }
  };
};
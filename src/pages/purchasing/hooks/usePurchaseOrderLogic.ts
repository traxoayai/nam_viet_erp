import { Form, App } from "antd";
import dayjs from "dayjs";
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { supabase } from "@/shared/lib/supabaseClient";
import { purchaseOrderService } from "@/features/purchasing/api/purchaseOrderService";
import { useProductStore } from "@/features/product/stores/productStore";
import { POItem } from "@/features/purchasing/types/purchaseOrderTypes";

// Interface cho Shipping Partner
interface ShippingPartner {
  id: number;
  name: string;
  type: string;
  phone: string;
  address?: string;
  cut_off_time?: string;
  shipping_rules?: { fee: number; min_quantity?: number }[];
}

export const usePurchaseOrderLogic = () => {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id && id !== "new";

  const { suppliers, fetchCommonData } = useProductStore();

  // --- STATE ---
  const [loading, setLoading] = useState(false);
  const [itemsList, setItemsList] = useState<POItem[]>([]);
  const [poCode, setPoCode] = useState<string>("");
  const [poStatus, setPoStatus] = useState<string>("DRAFT");
  const [financials, setFinancials] = useState({
    subtotal: 0,
    final: 0,
    paid: 0,
    totalCartons: 0,
  });
  const [searchKey, setSearchKey] = useState<number>(0);
  const [shippingPartners, setShippingPartners] = useState<ShippingPartner[]>([]);
  const [supplierInfo, setSupplierInfo] = useState<any>(null);

  // Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentInitialValues, setPaymentInitialValues] = useState<any>(null);
  const [costModalOpen, setCostModalOpen] = useState(false);

  // --- 1. KHỞI TẠO DỮ LIỆU ---
  useEffect(() => {
    const initData = async () => {
      try {
        if (suppliers.length === 0) await fetchCommonData();
        await fetchShippingPartners();
        if (isEditMode) {
          await loadOrderDetail(Number(id));
        }
      } catch (error) {
        console.error("Init Data Error:", error);
      }
    };
    initData();
  }, [id]);

  const fetchShippingPartners = async () => {
    const { data } = await supabase
      .from("shipping_partners")
      .select("*")
      .eq("status", "active");
    setShippingPartners(data || []);
  };

  const loadOrderDetail = async (poId: number) => {
    setLoading(true);
    try {
      const po = await purchaseOrderService.getPODetail(poId);
      if (!po) throw new Error("Không tìm thấy đơn hàng");

      setPoCode(po.code);
      setPoStatus(po.status || "DRAFT");

      if (po.supplier?.id) {
        const { data: richInfo } = await supabase.rpc(
          "get_supplier_quick_info",
          { p_supplier_id: po.supplier.id }
        );
        setSupplierInfo(richInfo || po.supplier);
      }

      const mappedItems: POItem[] = (po.items || []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        sku: item.sku,
        name: item.product_name,
        image_url: item.image_url,
        quantity: item.quantity_ordered,
        available_units: item.available_units || [],
        uom: item.uom_ordered || item.unit || item.wholesale_unit,
        unit_price: Number(item.unit_price),
        discount: 0,
        _items_per_carton: item.items_per_carton || 1,
        _wholesale_unit: item.wholesale_unit,
        _retail_unit: item.retail_unit,
        _base_price: Number(item.unit_price) /
          (item.uom_ordered === item.wholesale_unit ? 1 : 1 / (item.items_per_carton || 1)),
        vat_rate: item.vat_rate || 0,
        rebate_rate: item.rebate_rate || 0,
        allocated_shipping_fee: item.allocated_shipping_fee || 0,
        bonus_quantity: item.bonus_quantity || 0,
        is_bonus: item.is_bonus || false // [FIX] Map bonus status
      }));

      setItemsList(mappedItems);

      form.setFieldsValue({
        supplier_id: po.supplier?.id,
        expected_delivery_date: po.expected_delivery_date
          ? dayjs(po.expected_delivery_date)
          : null,
        note: po.note,
        delivery_method: po.delivery_method || "internal",
        shipping_partner_id: po.shipping_partner_id || undefined,
        shipping_fee: po.shipping_fee || 0,
        carrier_name: po.carrier_name,
        carrier_phone: po.carrier_phone,
        total_packages: po.total_packages,
        expected_delivery_time: po.expected_delivery_time 
            ? dayjs(po.expected_delivery_time) // [FIX] Ensure backend sends full timestamp or handled correctly
            : null, 
        items: mappedItems,
      });

      calculateTotals(mappedItems); 
    } catch (error: any) {
      message.error(error.message || "Lỗi tải đơn hàng");
      navigate("/purchase-orders");
    } finally {
      setLoading(false);
    }
  };

  // --- 2. LOGIC TÍNH TOÁN ---

  const handleSupplierChange = async (supplierId: number) => {
    const found = suppliers.find((s) => s.id === supplierId);
    if (found) {
      const { data } = await supabase.rpc("get_supplier_quick_info", {
        p_supplier_id: supplierId,
      });
      if (data) {
        setSupplierInfo(data);
        if (data.lead_time) {
          form.setFieldsValue({
            expected_delivery_date: dayjs().add(data.lead_time, "day"),
          });
        }
      } else {
        setSupplierInfo(found);
      }
    }
  };

  const calculateTotals = useCallback(
    (currentItems: POItem[]) => {
      let sub = 0;
      let cartons = 0;
      
      currentItems.forEach((item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unit_price) || 0;
        sub += qty * price;

        const packSize = item._items_per_carton || 1;
        if (item.uom === item._wholesale_unit) cartons += qty;
        else cartons += qty / packSize;
      });

      const ship = form.getFieldValue("shipping_fee") || 0;
      
      setFinancials((prev) => ({
        ...prev,
        subtotal: sub,
        final: sub + ship,
        totalCartons: parseFloat(cartons.toFixed(1)),
      }));

       const currentPackages = form.getFieldValue('total_packages');
       if (!currentPackages || currentPackages === 0) {
           form.setFieldsValue({ total_packages: Math.ceil(cartons) });
       }
    },
    [form]
  );

  const handlePartnerChange = (partnerId: number) => {
    const partner = shippingPartners.find((p) => p.id === partnerId);
    if (partner) {
      form.setFieldsValue({
        carrier_name: partner.name,
        carrier_phone: partner.phone,
        // carrier_address logic here if needed
      });
    }
  };

  const handleShippingFeeChange = () => {
      calculateTotals(itemsList);
  };

  const handleSelectProduct = (_: any, option: any) => {
    setSearchKey((prev) => prev + 1);
    const p = option.product;

    if (itemsList.find((i) => i.product_id === p.id)) {
      message.warning("Sản phẩm đã có trong danh sách!");
      return;
    }

    let unitsData = p.available_units || p.units || [];
    if (unitsData.length === 0) {
       if (p.wholesale_unit) unitsData.push({ unit_name: p.wholesale_unit, conversion_rate: p.items_per_carton || 1, is_base: false });
       if (p.retail_unit && p.retail_unit !== p.wholesale_unit) unitsData.push({ unit_name: p.retail_unit, conversion_rate: 1, is_base: true });
    }

    const newItem: POItem = {
      product_id: p.id,
      sku: p.sku,
      name: p.name,
      image_url: p.image_url,
      quantity: 1,
      available_units: unitsData,
      uom: p.wholesale_unit || (unitsData.length > 0 ? unitsData[0].unit_name : "Hộp"),
      unit_price: p.latest_purchase_price || p.actual_cost || 0,
      discount: 0,
      _items_per_carton: p.items_per_carton || 1,
      _wholesale_unit: p.wholesale_unit || "Hộp",
      _retail_unit: p.retail_unit || "Vỉ",
      _base_price: p.actual_cost || 0,
    };

    const newItems = [newItem, ...itemsList];
    setItemsList(newItems);
    form.setFieldsValue({ items: newItems });
    calculateTotals(newItems);
    message.success("Đã thêm sản phẩm");
  };

  const handleItemChange = (index: number, field: keyof POItem, value: any) => {
    const newItems = [...itemsList];
    const item = { ...newItems[index], [field]: value };

    if (field === "uom") {
      if (value === item._wholesale_unit) {
        item.unit_price = item._base_price;
      } else {
        item.unit_price = item._base_price / (item._items_per_carton || 1);
      }
    }

    newItems[index] = item;
    setItemsList(newItems);
    form.setFieldsValue({ items: newItems });
    calculateTotals(newItems);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = itemsList.filter((_, i) => i !== index);
    setItemsList(newItems);
    form.setFieldsValue({ items: newItems });
    calculateTotals(newItems);
  };

  // --- 3. CORE LOGIC: SAVE & CONFIRM ---

  // [NEW] Hàm dùng chung để lưu dữ liệu (Gọi RPC Update)
  const handleSaveOrder = async (values: any) => {
      // 1. Lấy Items từ State (Giá mới nhất)
      if (itemsList.length === 0) throw new Error("Vui lòng chọn ít nhất 1 sản phẩm");

      const payloadItems = itemsList.map((item) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price), // Giá mới nhất từ Table
        uom: item.uom,
        is_bonus: (item as any).is_bonus || false,
      }));

      // 2. Prepare Data
      const payloadData = {
        supplier_id: values.supplier_id,
        expected_delivery_date: values.expected_delivery_date,
        note: values.note,
        delivery_method: values.delivery_method,
        shipping_partner_id: values.shipping_partner_id,
        shipping_fee: values.shipping_fee,
        
        // Logistics
        carrier_name: values.carrier_name,
        carrier_contact: values.carrier_contact, // Optional field
        carrier_phone: values.carrier_phone,
        total_packages: values.total_packages,
        expected_delivery_time: values.expected_delivery_time 
           ? dayjs(values.expected_delivery_time).format('HH:mm') 
           : null,
      };

      if (isEditMode) {
        // Update
        await purchaseOrderService.updatePO(Number(id), payloadData, payloadItems);
        return Number(id);
      } else {
        // Create
        const result = await purchaseOrderService.createPO({
            ...payloadData,
            expected_date: payloadData.expected_delivery_date,
            supplier_id: values.supplier_id,
            items: payloadItems,
            status: 'DRAFT'
        });
        return result.id;
      }
  };

  // Nút Lưu Nháp (UI Trigger)
  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const savedId = await handleSaveOrder(values);
      message.success(isEditMode ? "Đã cập nhật đơn hàng!" : "Tạo đơn nháp thành công!");
      
      if (!isEditMode) {
          navigate(`/purchase-orders/${savedId}`);
      } else {
          // [CRITICAL] Reload lại để hiển thị dữ liệu đã lưu
          loadOrderDetail(savedId);
      }
    } catch (err: any) {
      console.error(err);
      message.error(err.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  // Nút Đặt Hàng (UI Trigger) - [FIXED LOGIC]
  const confirmOrder = async () => {
    try {
        // 1. Validate Form & State
        const values = await form.validateFields();
        if (itemsList.length === 0) return message.warning("Đơn hàng rỗng!");

        modal.confirm({
            title: "Xác nhận Đặt hàng?",
            content: 'Đơn hàng sẽ được Lưu và chuyển trạng thái sang "Đã Đặt Hàng". Thông tin sẽ được chốt.',
            okText: "Lưu & Đặt hàng",
            onOk: async () => {
                setLoading(true);
                try {
                    // 2. [CRITICAL] AUTO-SAVE: Lưu dữ liệu mới nhất vào DB trước
                    // Nếu đang tạo mới -> Tạo xong lấy ID để confirm
                    // Nếu đang sửa -> Update DB
                    const savedId = await handleSaveOrder(values);

                    // 3. Confirm RPC (Đổi trạng thái)
                    await purchaseOrderService.confirmPO(savedId);
                    
                    message.success("Đã đặt hàng thành công!");
                    navigate("/purchase-orders"); // Quay về list
                } catch (err: any) {
                    message.error(err.message || "Lỗi khi đặt hàng");
                } finally {
                    setLoading(false);
                }
            },
        });
    } catch (err) {
        message.error("Vui lòng kiểm tra lại thông tin nhập liệu");
    }
  };

  const requestPayment = () => {
    const remaining = financials.final - (financials.paid || 0);
    if (remaining <= 0) {
        message.info("Đơn hàng này đã thanh toán đủ!");
        return;
    }
    setPaymentInitialValues({
        business_type: 'trade', 
        flow: 'out',
        partner_type: 'supplier',
        supplier_id: form.getFieldValue("supplier_id"),
        amount: remaining,
        description: `Thanh toán cho đơn hàng ${poCode}`,
        ref_type: 'purchase_order',
        ref_id: Number(id)
    });
    setPaymentModalOpen(true);
  };

  const handleCalculateInbound = () => {
      navigate(`/purchasing/costing/${id}`);
  };

  const handleConfirmFinancials = async (processedItems: any[]) => {
      setLoading(true);
      try {
          await purchaseOrderService.confirmPOFinancials(Number(id), processedItems);
          message.success("Nhập kho & Chốt giá vốn thành công!");
          setCostModalOpen(false);
          loadOrderDetail(Number(id));
      } catch (error: any) {
          console.error(error);
          message.error(error.message || "Lỗi nhập kho");
      } finally {
          setLoading(false);
      }
  };

  return {
    form,
    isEditMode,
    loading,
    poCode,
    poStatus,
    itemsList,
    financials,
    searchKey,
    shippingPartners,
    suppliers,
    supplierInfo,
    handleSelectProduct,
    handleItemChange,
    handleRemoveItem,
    onFinish,
    confirmOrder,
    requestPayment,
    calculateTotals,
    handleSupplierChange,
    paymentModalOpen,
    setPaymentModalOpen,
    paymentInitialValues,
    costModalOpen,
    setCostModalOpen,
    handleCalculateInbound,
    handleConfirmFinancials,
    handleShippingFeeChange,
    handlePartnerChange,
  };
};
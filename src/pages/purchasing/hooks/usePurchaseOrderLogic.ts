// src/pages/purchasing/hooks/usePurchaseOrderLogic.ts
import { Form, App } from "antd";
import dayjs from "dayjs";
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { supabase } from "@/shared/lib/supabaseClient";
import { purchaseOrderService } from "@/features/purchasing/api/purchaseOrderService";
import { useProductStore } from "@/features/product/stores/productStore";
// Import Interface từ file Type chung để tránh lỗi vòng lặp
import { POItem } from "@/features/purchasing/types/purchaseOrderTypes";

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
    paid: 0, // [NEW]
    totalCartons: 0,
  });
  const [searchKey, setSearchKey] = useState<number>(0);
  const [shippingPartners, setShippingPartners] = useState<any[]>([]);
  const [supplierInfo, setSupplierInfo] = useState<any>(null);

  // [NEW] Modal Payment State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentInitialValues, setPaymentInitialValues] = useState<any>(null);

  // [NEW] Cost Allocation Modal V34
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

  // Tải danh sách đối tác vận chuyển
  const fetchShippingPartners = async () => {
    const { data } = await supabase
      .from("shipping_partners")
      .select("id, name, type, phone")
      .eq("status", "active");
    setShippingPartners(data || []);
  };

  // Tải chi tiết đơn hàng
  const loadOrderDetail = async (poId: number) => {
    setLoading(true);
    try {
      const po = await purchaseOrderService.getPODetail(poId);
      if (!po) throw new Error("Không tìm thấy đơn hàng");

      setPoCode(po.code);
      setPoStatus(po.status || "DRAFT");

      // Load thông tin chi tiết NCC
      if (po.supplier?.id) {
        const { data: richInfo } = await supabase.rpc(
          "get_supplier_quick_info",
          { p_supplier_id: po.supplier.id }
        );
        setSupplierInfo(richInfo || po.supplier);
      }

      // Map items từ DB về UI
      // [FIX] Map đầy đủ available_units từ API
      const mappedItems: POItem[] = (po.items || []).map((item: any) => ({
        id: item.id, // [IMPORTANT] Map Item ID for update/financials
        product_id: item.product_id,
        sku: item.sku,
        name: item.product_name,
        image_url: item.image_url,
        quantity: item.quantity_ordered,
        
        // Map mảng đơn vị động (QUAN TRỌNG)
        available_units: item.available_units || [],

        // Map đơn vị đang chọn
        uom: item.uom_ordered || item.unit || item.wholesale_unit,
        
        unit_price: Number(item.unit_price),
        discount: 0,
        
        // Các trường meta (Giữ nguyên để fallback)
        _items_per_carton: item.items_per_carton || 1,
        _wholesale_unit: item.wholesale_unit,
        _retail_unit: item.retail_unit,
        
        // Tính giá base
        // Tính giá base
        _base_price:
          Number(item.unit_price) /
          (item.uom_ordered === item.wholesale_unit
            ? 1
            : 1 / (item.items_per_carton || 1)),
        
        // [NEW] Map VAT/Rebate from DB if exists (For display accuracy)
        vat_rate: item.vat_rate || 0,
        rebate_rate: item.rebate_rate || 0,
        allocated_shipping_fee: item.allocated_shipping_fee || 0,
        bonus_quantity: item.bonus_quantity || 0,
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
        
        // [NEW] Logistics Fields
        carrier_name: po.carrier_name,
        carrier_phone: po.carrier_phone,
        total_packages: po.total_packages,
        expected_delivery_time: po.expected_delivery_time 
            ? dayjs(po.expected_delivery_time, 'HH:mm') 
            : null,

        items: mappedItems,
      });

      calculateTotals(mappedItems, po.total_paid || 0); // Pass paid amount
    } catch (error: any) {
      message.error(error.message || "Lỗi tải đơn hàng");
      navigate("/purchase-orders");
    } finally {
      setLoading(false);
    }
  };

  // --- 2. XỬ LÝ LOGIC NGHIỆP VỤ ---

  // Khi chọn NCC -> Lấy thông tin chi tiết & Gợi ý ngày giao
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

  // Tính tổng tiền & số thùng
  const calculateTotals = useCallback(
    // [FIX] Payment V2: Final Amount = SL * Price * (1 + VAT)
    // Note: VAT is currently only available in CostAllocationModal or from DB if confirmed.
    // If not confirmed, we assume VAT=0 for display or we need to add VAT input to main table?
    // Request says "Phải luôn hiển thị là Giá trị Hóa đơn cần thanh toán".
    // If we don't have VAT input in main table, we can't show it accurately before Costing.
    // However, if the order is Confirmed/Costing done, `vat_rate` might be in DB.
    // Let's try to use `vat_rate` if it exists in item.
    (currentItems: POItem[], currentPaid?: number) => {
      let sub = 0;
      let totalInvoice = 0;
      let cartons = 0;
      
      currentItems.forEach((item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unit_price) || 0;
        const packSize = item._items_per_carton || 1;
        const vat = (item as any).vat_rate || 0; // Get VAT if available

        const lineTotal = qty * price;
        sub += lineTotal;
        totalInvoice += lineTotal * (1 + vat / 100);

        // Logic tính thùng
        if (item.uom === item._wholesale_unit) {
          cartons += qty;
        } else {
          cartons += qty / packSize;
        }
      });

      const ship = form.getFieldValue("shipping_fee") || 0;
      // Final Payment = Total Invoice + Ship (if Ship is external/separate bill? Or Ship is part of invoice?)
      // Usually Ship is separate service. But `final_amount` usually means "Everything I need to pay for this PO".
      // If Ship is "Allocated", it's part of COGS but maybe not part of Supplier Payment if paid to 3rd party.
      // However, `shipping_fee` field in PO usually means fee paid to Supplier or Carrier.
      // Let's assume Add Ship to Final.
      
      setFinancials((prev) => ({
        subtotal: sub,
        final: totalInvoice + ship, // [UPDATED] Use Invoice Value with VAT
        paid: currentPaid !== undefined ? currentPaid : prev.paid,
        totalCartons: parseFloat(cartons.toFixed(1)),
      }));
    },
    [form]

 );

  // Khi chọn sản phẩm từ ô tìm kiếm
  // Khi chọn sản phẩm từ ô tìm kiếm
  const handleSelectProduct = (_: any, option: any) => {
    setSearchKey((prev) => prev + 1); // Reset thanh tìm kiếm
    const p = option.product;

    if (itemsList.find((i) => i.product_id === p.id)) {
      message.warning("Sản phẩm đã có trong danh sách!");
      return;
    }

    // [SENKO FIX]: Xử lý danh sách đơn vị (available_units)
    // 1. Ưu tiên lấy từ API nếu có (p.available_units hoặc p.units)
    // 2. Nếu không có, tự tạo mảng giả lập từ wholesale_unit và retail_unit cũ
    // Mục đích: Đảm bảo Dropdown chọn đơn vị luôn có dữ liệu, không bị trắng trơn.
    let unitsData = p.available_units || p.units || [];

    if (unitsData.length === 0) {
       // Fallback an toàn: Tạo thủ công
       if (p.wholesale_unit) {
         unitsData.push({
           unit_name: p.wholesale_unit,
           conversion_rate: p.items_per_carton || 1, // Giả định rate theo quy cách thùng
           is_base: false
         });
       }
       if (p.retail_unit && p.retail_unit !== p.wholesale_unit) {
         unitsData.push({
           unit_name: p.retail_unit,
           conversion_rate: 1,
           is_base: true
         });
       }
    }

    // Tạo item mới
    const newItem: POItem = {
      product_id: p.id,
      sku: p.sku,
      name: p.name,
      image_url: p.image_url,
      quantity: 1,

      // [QUAN TRỌNG] Gán danh sách đơn vị vào item để Table hiển thị
      available_units: unitsData,

      // Mặc định chọn đơn vị Sỉ (hoặc cái đầu tiên tìm thấy)
      uom: p.wholesale_unit || (unitsData.length > 0 ? unitsData[0].unit_name : "Hộp"),

      // Giá nhập: Ưu tiên giá nhập gần nhất -> Giá vốn -> 0
      unit_price: p.latest_purchase_price || p.actual_cost || 0,
      discount: 0,

      // Các trường meta cũ (để tính toán fallback)
      _items_per_carton: p.items_per_carton || 1,
      _wholesale_unit: p.wholesale_unit || "Hộp",
      _retail_unit: p.retail_unit || "Vỉ",
      _base_price: p.actual_cost || 0,
    };

    const newItems = [newItem, ...itemsList]; // Thêm lên đầu
    setItemsList(newItems);
    form.setFieldsValue({ items: newItems });
    calculateTotals(newItems);
    message.success("Đã thêm sản phẩm");
  };

  // Khi thay đổi thông tin trên bảng (SL, ĐVT, Giá)
  const handleItemChange = (index: number, field: keyof POItem, value: any) => {
    const newItems = [...itemsList];
    const item = { ...newItems[index], [field]: value };

    // Logic tự động đổi giá khi đổi ĐVT
    if (field === "uom") {
      if (value === item._wholesale_unit) {
        // Chọn Sỉ -> Giá = Giá Sỉ (base)
        item.unit_price = item._base_price;
      } else {
        // Chọn Lẻ -> Giá = Giá Sỉ / Quy cách
        item.unit_price = item._base_price / (item._items_per_carton || 1);
      }
    }

    newItems[index] = item;
    setItemsList(newItems);
    form.setFieldsValue({ items: newItems });
    calculateTotals(newItems);
  };

  // Xóa sản phẩm
  const handleRemoveItem = (index: number) => {
    const newItems = itemsList.filter((_, i) => i !== index);
    setItemsList(newItems);
    form.setFieldsValue({ items: newItems });
    calculateTotals(newItems);
  };

  // --- 3. ACTIONS (LƯU / ĐẶT HÀNG) ---

  // Nút Lưu Nháp
  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      if (itemsList.length === 0)
        throw new Error("Vui lòng chọn ít nhất 1 sản phẩm");

      // Map items (Có fallback quantity = 1 để tránh lỗi DB)
      const payloadItems = itemsList.map((item) => ({
        product_id: item.product_id,
        quantity:
          item.quantity && Number(item.quantity) > 0
            ? Number(item.quantity)
            : 1,
        uom: item.uom,
        unit_price: item.unit_price || 0,
        is_bonus: (item as any).is_bonus || false, // [NEW] Support bonus items
      }));

      const payloadData = {
        supplier_id: values.supplier_id,
        expected_delivery_date: values.expected_delivery_date,
        note: values.note,
        delivery_method: values.delivery_method,
        shipping_partner_id: values.shipping_partner_id,
        shipping_fee: values.shipping_fee,
        
        // [NEW] Logistics & Time Format
        carrier_name: values.carrier_name,
        carrier_phone: values.carrier_phone,
        total_packages: values.total_packages,
        expected_delivery_time: values.expected_delivery_time 
           ? dayjs(values.expected_delivery_time).format('HH:mm') 
           : null,
      };

      if (isEditMode) {
        await purchaseOrderService.updatePO(
          Number(id),
          payloadData,
          payloadItems
        );
        message.success("Cập nhật đơn hàng thành công");
        // Reload lại để cập nhật state mới nhất nếu cần
        loadOrderDetail(Number(id));
      } else {
        const result = await purchaseOrderService.createPO({
            ...payloadData,
            expected_date: payloadData.expected_delivery_date, // [FIX] Map correctly
            supplier_id: values.supplier_id, // Ensure strict type matching
            items: payloadItems,
            status: 'DRAFT'
        });
        
        // Result is { id, code, ... }
        const newId = result.id;
        
        message.success("Tạo đơn nháp thành công");
        navigate(`/purchase-orders/${newId}`);
      }
    } catch (err: any) {
      console.error(err);
      message.error(err.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  // Nút Đặt Hàng (Chuyển trạng thái)
  const confirmOrder = () => {
    if (!isEditMode)
      return message.warning("Vui lòng Lưu nháp trước khi đặt hàng");

    modal.confirm({
      title: "Xác nhận Đặt hàng?",
      content:
        'Đơn hàng sẽ chuyển sang trạng thái "Đã Đặt Hàng" (PENDING). Bạn không thể sửa chi tiết sau bước này.',
      okText: "Đặt hàng ngay",
      onOk: async () => {
        setLoading(true);
        try {
          await purchaseOrderService.confirmPO(Number(id));
          message.success("Đã đặt hàng thành công!");
          navigate("/purchase-orders");
        } catch (err: any) {
          message.error(err.message);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // Nút Yêu cầu Thanh toán (Mới)
  const requestPayment = () => {
    // 1. Check số tiền còn lại
    const remaining = financials.final - (financials.paid || 0);

    if (remaining <= 0) {
        message.info("Đơn hàng này đã thanh toán đủ!");
        return;
    }

    // 2. Open Finance Modal
    setPaymentInitialValues({
        business_type: 'trade', 
        flow: 'out',
        partner_type: 'supplier',
        supplier_id: form.getFieldValue("supplier_id"), // Auto-fill Supplier
        amount: remaining, // Suggest remaining amount
        description: `Thanh toán cho đơn hàng ${poCode}`,
        
        // [NEW] Backend Reference
        ref_type: 'purchase_order',
        ref_id: Number(id)
    });
    setPaymentModalOpen(true);
  };

  // [NEW] Open Cost Modal
  const handleCalculateInbound = () => {
      if (itemsList.length === 0) {
          message.warning("Đơn hàng chưa có sản phẩm!");
          return;
      }
      setCostModalOpen(true);
  };

  // [NEW] Submit Landed Cost Data to Backend
  const handleConfirmFinancials = async (processedItems: any[]) => {
      setLoading(true);
      try {
          // Prepare Payload matching "confirm_purchase_order_financials"
          // We need to map UI "id" back to DB "id"
          // Note: In loadOrderDetail, we didn't map "id" field explicitly for itemsList?
          // Let's check loadOrderDetail -> "const mappedItems". It does NOT map 'id'.
          // Wait, PO items from DB MUST have an ID for this to work.
          // FIX: In loadOrderDetail, I need to check if 'id' is mapped.
          // Looking at file content: mappedItems doesn't have 'id'.
          // WARNING: We must fix loadOrderDetail mapping first or use product_id if API supports it.
          // Request says: "id": 888, // ID dòng (purchase_order_items.id)
          // So we need 'id'.
          
          await purchaseOrderService.confirmPOFinancials(Number(id), processedItems);
          message.success("Nhập kho & Chốt giá vốn thành công!");
          setCostModalOpen(false);
          // Refresh
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
    
    // [NEW]
    // [NEW]
    paymentModalOpen,
    setPaymentModalOpen,
    paymentInitialValues,
    
    // [NEW]
    costModalOpen,
    setCostModalOpen,
    handleCalculateInbound,
    handleConfirmFinancials,
  };
};

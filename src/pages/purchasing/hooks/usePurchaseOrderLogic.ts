// src/pages/purchasing/hooks/usePurchaseOrderLogic.ts
import { Form, App } from "antd";
import dayjs from "dayjs";
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useProductStore } from "@/features/product/stores/productStore";
import { purchaseOrderService } from "@/features/purchasing/api/purchaseOrderService";
import { POItem } from "@/features/purchasing/types/purchaseOrderTypes";
import { safeRpc } from "@/shared/lib/safeRpc";
import { supabase } from "@/shared/lib/supabaseClient";
import { moneyLineTotal, moneyAdd } from "@/shared/utils/money";

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
  const [poStatus, setPoStatus] = useState<string>("");
  const [costingConfirmedAt, setCostingConfirmedAt] = useState<string | null>(null);
  const [financials, setFinancials] = useState({
    subtotal: 0,
    shippingFee: 0,
    final: 0, // = subtotal only (dùng cho thanh toán NCC)
    paid: 0,
    totalCartons: 0,
  });
  const [searchKey, setSearchKey] = useState<number>(0);
  const [shippingPartners, setShippingPartners] = useState<ShippingPartner[]>(
    []
  );
  const [supplierInfo, setSupplierInfo] = useState<any>(null);

  // Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentInitialValues, setPaymentInitialValues] = useState<any>(null);

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
    setShippingPartners((data || []) as unknown as ShippingPartner[]);
  };

  const loadOrderDetail = async (poId: number) => {
    setLoading(true);
    try {
      const poRaw = await purchaseOrderService.getPODetail(poId);
      if (!poRaw) throw new Error("Không tìm thấy đơn hàng");
      const po = poRaw as unknown as Record<string, unknown>;

      setPoCode(po.code as string);
      if (!po.status) throw new Error("Đơn hàng không có trạng thái hợp lệ");
      setPoStatus(po.status as string);
      setCostingConfirmedAt((po.costing_confirmed_at as string) || null);

      const supplier = po.supplier as Record<string, unknown> | undefined;
      if (supplier?.id) {
        const { data: richInfo } = await safeRpc(
          "get_supplier_quick_info",
          { p_supplier_id: supplier.id as number }
        );
        // Merge: thông tin cơ bản từ PO supplier + debt từ RPC
        const richObj = richInfo as unknown as Record<string, unknown> | null;
        setSupplierInfo({ ...supplier, ...richObj });
      }

      const mappedItems: POItem[] = ((po.items as unknown[]) || []).map((item: unknown) => {
        const i = item as Record<string, unknown>;
        // [FIX] Normalize Data Keys (Phòng trường hợp RPC trả về biến thể khác)
        const wholesaleUnit =
          (i.wholesale_unit as string) || (i.wholesaleUnit as string) || "Hộp";
        const retailUnit = (i.retail_unit as string) || (i.retailUnit as string) || "Vỉ";
        const itemsPerCarton =
          (i.items_per_carton as number) || (i.itemsPerCarton as number) || 1;

        return {
          id: i.id as number,
          product_id: i.product_id as number,
          sku: i.sku as string,
          name: i.product_name as string,
          image_url: i.image_url as string,
          quantity: i.quantity_ordered as number,
          available_units: (i.available_units as POItem["available_units"]) || [],
          // [LOGIC] Ưu tiên lấy đơn vị đã lưu trong đơn hàng
          uom: (i.uom_ordered as string) || (i.unit as string) || wholesaleUnit,
          unit_price: Number(i.unit_price),
          discount: 0,
          _items_per_carton: itemsPerCarton,
          _wholesale_unit: wholesaleUnit,
          _retail_unit: retailUnit,
          // [LOGIC] Tính lại giá gốc (Wholesale Price) để dùng khi đổi ĐVT
          _base_price:
            Number(i.unit_price) /
            (i.uom_ordered === wholesaleUnit ? 1 : 1 / itemsPerCarton),
          vat_rate: (i.vat_rate as number) || 0,
          rebate_rate: (i.rebate_rate as number) || 0,
          allocated_shipping_fee: (i.allocated_shipping_fee as number) || 0,
          bonus_quantity: (i.bonus_quantity as number) || 0,
          is_bonus: (i.is_bonus as boolean) || false,
        };
      });

      setItemsList(mappedItems);

      form.setFieldsValue({
        supplier_id: supplier?.id as number,
        expected_delivery_date: po.expected_delivery_date
          ? dayjs(po.expected_delivery_date as string)
          : null,
        note: po.note as string,
        delivery_method: (po.delivery_method as string) || "internal",
        shipping_partner_id: (po.shipping_partner_id as number) || undefined,
        shipping_fee: (po.shipping_fee as number) || 0,
        carrier_name: po.carrier_name as string,
        carrier_phone: po.carrier_phone as string,
        total_packages: po.total_packages as number,
        expected_delivery_time: po.expected_delivery_time
          ? dayjs(po.expected_delivery_time as string)
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
      const { data } = await safeRpc("get_supplier_quick_info", {
        p_supplier_id: supplierId,
      });
      // Merge: thông tin cơ bản từ suppliers list + debt từ RPC
      const info = data as unknown as Record<string, unknown> | null;
      setSupplierInfo({ ...found, ...info });
      if (info?.lead_time) {
        form.setFieldsValue({
          expected_delivery_date: dayjs().add(info.lead_time as number, "day"),
        });
      }
    }
  };

  const calculateTotals = useCallback(
    (currentItems: POItem[]) => {
      let sub = 0;
      let cartons = 0;

      currentItems.forEach((item) => {
        const qty = Number(item.quantity) || 0;
        const bonusQty = Number(item.bonus_quantity) || 0;
        const totalQty = qty + bonusQty;
        const price = item.is_bonus ? 0 : Number(item.unit_price) || 0;
        sub = moneyAdd(sub, moneyLineTotal(qty, price));

        const packSize = item._items_per_carton || 1;
        if (item.uom === item._wholesale_unit) cartons += totalQty;
        else cartons += totalQty / packSize;
      });

      const ship = form.getFieldValue("shipping_fee") || 0;

      setFinancials((prev) => ({
        ...prev,
        subtotal: sub,
        shippingFee: ship,
        final: sub, // Chỉ tiền hàng — thanh toán NCC dựa trên final
        totalCartons: parseFloat(cartons.toFixed(1)),
      }));

      const currentPackages = form.getFieldValue("total_packages");
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

  // [FIX CRITICAL] Xử lý chọn sản phẩm
  const handleSelectProduct = (_: any, option: any) => {
    setSearchKey((prev) => prev + 1);
    const p = option.product;

    if (itemsList.find((i) => i.product_id === p.id)) {
      message.warning("Sản phẩm đã có trong danh sách!");
      return;
    }

    // 1. [FIX] Normalize Key Names (Chấp nhận cả snake_case và camelCase)
    const wholesaleUnit = p.wholesale_unit || p.wholesaleUnit || "Hộp";
    const retailUnit = p.retail_unit || p.retailUnit || "Vỉ";
    const itemsPerCarton = p.items_per_carton || p.itemsPerCarton || 1;
    // Giá cost: Ưu tiên giá nhập gần nhất -> giá vốn thực tế -> 0
    const basePrice =
      p.latest_purchase_price || p.latestPurchasePrice || p.last_price || p.actual_cost || p.price || 0;

    // 2. Logic tạo dropdown Units
    const unitsData = p.available_units || p.units || [];
    if (unitsData.length === 0) {
      // Chỉ push nếu unit tồn tại và không trùng
      if (wholesaleUnit)
        unitsData.push({
          unit_name: wholesaleUnit,
          conversion_rate: itemsPerCarton,
          is_base: false,
        });
      if (retailUnit && retailUnit !== wholesaleUnit)
        unitsData.push({
          unit_name: retailUnit,
          conversion_rate: 1,
          is_base: true,
        });
    }

    const newItem: POItem = {
      product_id: p.id,
      sku: p.sku,
      name: p.name,
      image_url: p.image_url,
      quantity: 1,
      available_units: unitsData,

      // 3. [FIX] Luôn set mặc định là Đơn vị nhập (Wholesale Unit)
      uom: wholesaleUnit,

      // Giá nhập mặc định theo Wholesale Unit
      unit_price: basePrice,

      discount: 0,
      _items_per_carton: itemsPerCarton,
      _wholesale_unit: wholesaleUnit,
      _retail_unit: retailUnit,
      _base_price: basePrice, // Giá gốc tham chiếu
      is_bonus: false,
    };

    const newItems = [newItem, ...itemsList];
    setItemsList(newItems);
    form.setFieldsValue({ items: newItems });
    calculateTotals(newItems);
    message.success(`Đã thêm: ${p.name}`);
  };

  const handleItemChange = (index: number, field: keyof POItem, value: any) => {
    const newItems = [...itemsList];
    const item = { ...newItems[index], [field]: value };

    // Logic: Nếu đổi ĐVT -> Tự động tính lại đơn giá theo quy cách
    if (field === "uom") {
      if (value === item._wholesale_unit) {
        // Chuyển về đơn vị lớn -> Giá = Giá gốc
        item.unit_price = item._base_price;
      } else {
        // Chuyển về đơn vị nhỏ -> Giá = Giá gốc / Quy cách
        item.unit_price = item._base_price / (item._items_per_carton || 1);
      }
    }

    // Logic: Nếu chọn Hàng tặng -> Giá về 0
    if (field === "is_bonus") {
      if (value === true) {
        item.unit_price = 0;
      } else {
        // Khôi phục giá cũ dựa trên UOM hiện tại
        if (item.uom === item._wholesale_unit) {
          item.unit_price = item._base_price;
        } else {
          item.unit_price = item._base_price / (item._items_per_carton || 1);
        }
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
    if (itemsList.length === 0)
      throw new Error("Vui lòng chọn ít nhất 1 sản phẩm");

    const payloadItems = itemsList.map((item) => ({
      product_id: item.product_id,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price), // Giá mới nhất từ Table
      uom: item.uom,
      is_bonus: (item as any).is_bonus || false,
      bonus_quantity: Number(item.bonus_quantity) || 0,
    }));

    // 2. Prepare Data
    const payloadData = {
      supplier_id: values.supplier_id,
      expected_delivery_date: values.expected_delivery_date,
      note: values.note,
      delivery_method: values.delivery_method,
      shipping_partner_id: values.shipping_partner_id,
      shipping_fee: values.shipping_fee,
      status: poStatus || "DRAFT", // Giữ nguyên status hiện tại khi update

      // Logistics
      carrier_name: values.carrier_name,
      carrier_contact: values.carrier_contact,
      carrier_phone: values.carrier_phone,
      total_packages: values.total_packages,
    };

    if (isEditMode) {
      // Update
      await purchaseOrderService.updatePO(
        Number(id),
        payloadData,
        payloadItems
      );
      return Number(id);
    } else {
      // Create
      const result = await purchaseOrderService.createPO({
        ...payloadData,
        expected_date: payloadData.expected_delivery_date,
        supplier_id: values.supplier_id,
        items: payloadItems,
        status: "DRAFT",
      });
      const created = result as unknown as { id: number };
      return created.id;
    }
  };

  // Nút Lưu Nháp (UI Trigger)
  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const savedId = await handleSaveOrder(values);
      message.success(
        isEditMode ? "Đã cập nhật đơn hàng!" : "Tạo đơn nháp thành công!"
      );

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
        content:
          'Đơn hàng sẽ được Lưu và chuyển trạng thái sang "Đã Đặt Hàng". Thông tin sẽ được chốt.',
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
    } catch {
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
      business_type: "trade",
      flow: "out",
      partner_type: "supplier",
      supplier_id: form.getFieldValue("supplier_id"),
      partner_name: supplierInfo?.name,
      amount: remaining,
      description: `Thanh toán cho đơn hàng ${poCode}`,
      ref_type: "purchase_order",
      ref_id: Number(id),
    });
    setPaymentModalOpen(true);
  };

  const requestShippingPayment = () => {
    const shipFee = financials.shippingFee || 0;
    if (shipFee <= 0) {
      message.info("Đơn hàng này không có phí vận chuyển!");
      return;
    }
    const spId = form.getFieldValue("shipping_partner_id");
    const spName = shippingPartners.find((p) => p.id === spId)?.name;
    setPaymentInitialValues({
      business_type: "trade",
      flow: "out",
      partner_type: "shipping_partner",
      partner_name: spName || "",
      amount: shipFee,
      description: `Thanh toán vận chuyển đơn hàng ${poCode}`,
      ref_type: "purchase_order",
      ref_id: Number(id),
    });
    setPaymentModalOpen(true);
  };

  const handleUpdateLogistics = async () => {
    setLoading(true);
    try {
      const values = await form.validateFields();
      await purchaseOrderService.updateLogistics(Number(id), {
        delivery_method: values.delivery_method,
        shipping_partner_id: values.shipping_partner_id,
        shipping_fee: values.shipping_fee,
        total_packages: values.total_packages,
        expected_delivery_date: values.expected_delivery_date
          ? dayjs(values.expected_delivery_date).toISOString()
          : undefined,
        note: values.note,
      });
      message.success("Đã cập nhật thông tin vận chuyển");
      loadOrderDetail(Number(id));
    } catch (err: any) {
      message.error(err.message || "Lỗi cập nhật");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmFinancials = async (processedItems: any[]) => {
    setLoading(true);
    try {
      await purchaseOrderService.confirmPOFinancials(
        Number(id),
        processedItems
      );
      message.success("Nhập kho & Chốt giá vốn thành công!");
      loadOrderDetail(Number(id));
    } catch (error: any) {
      console.error(error);
      message.error(error.message || "Lỗi nhập kho");
    } finally {
      setLoading(false);
    }
  };
  // Thêm vào bên trong usePurchaseOrderLogic
  const cancelOrder = async () => {
    if (!id) return;
    modal.confirm({
      title: "Xác nhận hủy đơn hàng?",
      content:
        "Đơn hàng sẽ chuyển sang trạng thái Đã Hủy và không thể phục hồi. Bạn có chắc chắn muốn hủy?",
      okText: "Đồng ý Hủy",
      okType: "danger",
      cancelText: "Thoát",
      onOk: async () => {
        try {
          await purchaseOrderService.cancelPO(Number(id));
          message.success("Đã hủy đơn hàng!");
          loadOrderDetail(Number(id));
        } catch (error: any) {
          message.error("Lỗi hủy đơn: " + error.message);
        }
      },
    });
  };

  // Đừng quên return cancelOrder ở cuối hook

  return {
    form,
    isEditMode,
    loading,
    poCode,
    poStatus,
    costingConfirmedAt,
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
    requestShippingPayment,
    handleUpdateLogistics,
    calculateTotals,
    handleSupplierChange,
    paymentModalOpen,
    setPaymentModalOpen,
    paymentInitialValues,
    handleConfirmFinancials,
    handleShippingFeeChange,
    handlePartnerChange,
    cancelOrder,
    loadOrderDetail,
  };
};

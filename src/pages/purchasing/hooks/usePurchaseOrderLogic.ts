// src/pages/purchasing/hooks/usePurchaseOrderLogic.ts
import { Form, App } from "antd";
import dayjs from "dayjs";
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { supabase } from "@/lib/supabaseClient";
import { purchaseOrderService } from "@/services/purchaseOrderService";
import { useProductStore } from "@/stores/productStore";
// Import Interface từ file Type chung để tránh lỗi vòng lặp
import { POItem } from "@/types/purchaseOrderTypes";

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
    totalCartons: 0,
  });
  const [searchKey, setSearchKey] = useState<number>(0);
  const [shippingPartners, setShippingPartners] = useState<any[]>([]);
  const [supplierInfo, setSupplierInfo] = useState<any>(null);

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
      const mappedItems: POItem[] = (po.items || []).map((item: any) => ({
        product_id: item.product_id,
        sku: item.sku,
        name: item.product_name,
        image_url: item.image_url,
        quantity: item.quantity_ordered,
        uom: item.uom_ordered || item.wholesale_unit,
        unit_price: Number(item.unit_price),
        discount: 0,
        _items_per_carton: item.items_per_carton || 1,
        _wholesale_unit: item.wholesale_unit,
        _retail_unit: item.retail_unit,
        // Tính lại giá cơ sở (Base Price) để hỗ trợ logic đổi ĐVT
        _base_price:
          Number(item.unit_price) /
          (item.uom_ordered === item.wholesale_unit
            ? 1
            : 1 / (item.items_per_carton || 1)),
      }));

      setItemsList(mappedItems);

      form.setFieldsValue({
        supplier_id: po.supplier?.id,
        expected_delivery_date: po.expected_delivery_date
          ? dayjs(po.expected_delivery_date)
          : null,
        note: po.note,
        delivery_method: po.delivery_method || "internal",
        // Fix: Dùng undefined để Select hiển thị placeholder nếu null
        shipping_partner_id: po.shipping_partner_id || undefined,
        shipping_fee: po.shipping_fee || 0,
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
    (currentItems: POItem[]) => {
      let sub = 0;
      let cartons = 0;
      currentItems.forEach((item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unit_price) || 0;
        const packSize = item._items_per_carton || 1;

        sub += qty * price;

        // Logic tính thùng: Nếu đơn vị là Thùng (Sỉ) -> Cộng thẳng qty
        if (item.uom === item._wholesale_unit) {
          cartons += qty;
        } else {
          cartons += qty / packSize;
        }
      });

      const ship = form.getFieldValue("shipping_fee") || 0;
      setFinancials({
        subtotal: sub,
        final: sub + ship,
        totalCartons: parseFloat(cartons.toFixed(1)),
      });
    },
    [form]
  );

  // Khi chọn sản phẩm từ ô tìm kiếm
  const handleSelectProduct = (_: any, option: any) => {
    setSearchKey((prev) => prev + 1); // Reset thanh tìm kiếm
    const p = option.product;

    if (itemsList.find((i) => i.product_id === p.id)) {
      message.warning("Sản phẩm đã có trong danh sách!");
      return;
    }

    // Tạo item mới (Mặc định là đơn vị Sỉ/Hộp)
    const newItem: POItem = {
      product_id: p.id,
      sku: p.sku,
      name: p.name,
      image_url: p.image_url,
      quantity: 1,
      uom: p.wholesale_unit || "Hộp",
      unit_price: p.actual_cost || 0, // Giá nhập gần nhất hoặc giá vốn
      discount: 0,
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
      }));

      const payloadData = {
        supplier_id: values.supplier_id,
        expected_delivery_date: values.expected_delivery_date,
        note: values.note,
        delivery_method: values.delivery_method,
        shipping_partner_id: values.shipping_partner_id,
        shipping_fee: values.shipping_fee,
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
        const newId = await purchaseOrderService.createDraftPO(
          payloadData,
          payloadItems
        );
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
    modal.confirm({
      title: "Gửi Yêu cầu Thanh toán?",
      content: "Yêu cầu sẽ được gửi đến Kế toán để duyệt chi.",
      okText: "Gửi ngay",
      onOk: async () => {
        // Mockup logic: Có thể gọi API update payment_status = 'pending_approval'
        message.success("Đã gửi yêu cầu thanh toán thành công!");
      },
    });
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
  };
};

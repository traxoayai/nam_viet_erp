// src/features/sales-b2b/create/hooks/useCreateOrderB2B.ts
import { message } from "antd";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { useCallback, useMemo } from "react";

import { useShippingPartnerStore } from "@/features/partners/stores/useShippingPartnerStore";
// QUAN TRỌNG: Import Type chuẩn từ shippingPartner để đồng bộ với Store
import { ShippingPartner } from "@/features/partners/types/shippingPartner";
import { useSalesStore } from "@/features/sales/stores/useSalesStore";
import { DELIVERY_METHODS } from "@/shared/constants/b2b";

dayjs.extend(customParseFormat);

export const useCreateOrderB2B = () => {
  const store = useSalesStore();
  const shippingStore = useShippingPartnerStore();

  // --- 1. LOGIC TÀI CHÍNH (FINANCIALS) ---
  const financials = useMemo(() => {
    const summary = store.getSummary();
    const isOverLimit =
      store.customer &&
      store.customer.debt_limit > 0 &&
      store.customer.current_debt + summary.totalPayable >
        store.customer.debt_limit;

    return {
      ...summary,
      newTotalDebt: summary.totalPayable,
      isOverLimit: !!isOverLimit,
    };
  }, [store.items, store.shippingFee, store.selectedVoucher, store.customer]);

  // --- 2. LOGIC VẬN CHUYỂN (SMART DELIVERY ESTIMATOR) ---
  const estimatedDeliveryText = useMemo(() => {
    if (store.deliveryMethod === "internal") return "Giao trong giờ hành chính";

    const partner = store.shippingPartner;
    if (!partner) return "Chưa có thông tin";

    const now = dayjs();
    const todayStr = now.format("YYYY-MM-DD");

    // Parse Cut-off time (VD: "16:00:00")
    // Fallback về 16:00 nếu không có dữ liệu
    const cutOffTimeStr = partner.cut_off_time || "16:00:00";
    const cutOff = dayjs(`${todayStr} ${cutOffTimeStr}`, "YYYY-MM-DD HH:mm:ss");

    let baseTime = now;
    // Nếu quá giờ chốt đơn -> Tính từ 8:00 AM sáng mai
    if (now.isAfter(cutOff)) {
      baseTime = now.add(1, "day").hour(8).minute(0).second(0);
    }

    // Cộng thời gian giao hàng (speed_hours) - Fallback 24h nếu thiếu
    const speed = partner.speed_hours || 24;
    const estimatedTime = baseTime.add(speed, "hour");

    const diffHours = estimatedTime.diff(now, "hour");

    if (diffHours < 24 && estimatedTime.isSame(now, "day")) {
      return `Dự kiến giao: ${estimatedTime.format("HH:mm")} Hôm nay`;
    }
    return `Dự kiến giao: ${estimatedTime.format("DD/MM/YYYY")} (khoảng ${Math.ceil(diffHours / 24)} ngày)`;
  }, [store.deliveryMethod, store.shippingPartner]);

  // --- 3. ACTIONS (XỬ LÝ LOGIC UI) ---

  // FIX LỖI TYPE MISMATCH: Mapping từ ListRecord -> Full Partner Object
  const selectShippingPartner = useCallback(
    (partnerId: number) => {
      const listRecord = shippingStore.partners.find((p) => p.id === partnerId);

      if (listRecord) {
        // Tạo object đầy đủ để thỏa mãn interface ShippingPartner
        const fullPartner: ShippingPartner = {
          ...listRecord,
          email: null, // Bổ sung field thiếu
          address: null, // Bổ sung field thiếu
          notes: null, // Bổ sung field thiếu
          // speed_hours và base_fee đã có trong ListRecord (nhờ cập nhật Type ở Bước 2)
          // Nếu ListRecord chưa có, cần fallback tại đây:
          speed_hours: listRecord.speed_hours || 24,
          base_fee: listRecord.base_fee || 0,
        };

        store.setShippingPartner(fullPartner);
      }
    },
    [shippingStore.partners, store.setShippingPartner]
  );

  const validateOrder = useCallback(() => {
    if (!store.customer) {
      message.error("Vui lòng chọn Khách hàng!");
      return false;
    }
    if (store.items.length === 0) {
      message.error("Giỏ hàng đang trống!");
      return false;
    }
    if (store.deliveryMethod !== "internal" && !store.shippingPartner) {
      message.error("Vui lòng chọn Đối tác vận chuyển!");
      return false;
    }
    if (store.deliveryMethod !== "coach" && !store.customer.shipping_address) {
      message.warning(
        "Khách hàng này chưa có địa chỉ giao hàng! Vui lòng kiểm tra lại."
      );
    }
    return true;
  }, [
    store.customer,
    store.items,
    store.deliveryMethod,
    store.shippingPartner,
  ]);

  return {
    // State Exports
    customer: store.customer,
    items: store.items,
    deliveryMethod: store.deliveryMethod,
    shippingPartnerId: store.shippingPartner?.id,
    shippingFee: store.shippingFee,
    note: store.note,
    selectedVoucher: store.selectedVoucher,

    // Computed Exports
    financials,
    estimatedDeliveryText,
    deliveryMethods: DELIVERY_METHODS,

    // Action Exports
    setCustomer: store.setCustomer,
    setItems: store.setItems, // [NEW]
    addItem: store.addItem,
    updateItem: store.updateItem,
    removeItem: store.removeItem,
    setDeliveryMethod: store.setDeliveryMethod,
    selectShippingPartner,
    setNote: store.setNote,
    setVoucher: store.setVoucher,

    // FIX: Dùng action setShippingFee thay vì setState
    setShippingFee: store.setShippingFee,
    setManualDiscount: store.setManualDiscount, // [NEW]

    reset: store.reset,
    validateOrder,
  };
};

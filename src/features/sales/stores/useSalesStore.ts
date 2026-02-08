// src/stores/useSalesStore.ts
import { message } from "antd";
import { create } from "zustand";

import {
  CustomerB2B,
  ProductB2B,
  CartItem,
  VoucherRecord,
} from "@/features/sales/types/b2b_sales";
import { ShippingPartner } from "@/features/partners/types/shippingPartner";

interface SalesState {
  // --- STATE ---
  customer: CustomerB2B | null;
  items: CartItem[];
  deliveryMethod: "internal" | "app" | "coach";
  shippingPartner: ShippingPartner | null;
  shippingFee: number;
  totalPackages: number;
  estDeliveryDate: string | null;
  selectedVoucher: VoucherRecord | null;
  note: string;
  manualDiscount: number; // [NEW] Hỗ trợ giảm giá thủ công (khi load đơn cũ hoặc Override)

  // --- ACTIONS ---
  setCustomer: (c: CustomerB2B | null) => void;
  setItems: (items: CartItem[]) => void; // [NEW] Hydration Action
  addItem: (p: ProductB2B, qty?: number) => void;
  updateItem: (key: string, field: keyof CartItem, value: any) => void;
  removeItem: (key: string) => void;
  setDeliveryMethod: (method: "internal" | "app" | "coach") => void;
  setShippingPartner: (p: ShippingPartner | null) => void;
  setPackages: (n: number) => void;

  // FIX: Thêm action cụ thể thay vì dùng setState generic
  setShippingFee: (fee: number) => void;
  setManualDiscount: (d: number) => void; // [NEW]

  setVoucher: (v: VoucherRecord | null) => void;
  setNote: (s: string) => void;
  reset: () => void;

  getSummary: () => {
    totalQty: number;
    subTotal: number;
    discountAmount: number;
    finalTotal: number;
    oldDebt: number;
    totalPayable: number;
  };
}

export const useSalesStore = create<SalesState>((set, get) => ({
  customer: null,
  items: [],
  deliveryMethod: "internal",
  shippingPartner: null,
  shippingFee: 0,
  totalPackages: 1,
  estDeliveryDate: null,
  selectedVoucher: null,
  note: "",
  manualDiscount: 0,

  setCustomer: (c) => set({ customer: c, selectedVoucher: null }),

  addItem: (p, qty = 1) => {
    const { items } = get();
    const existing = items.find((i) => i.id === p.id);
    if (existing) {
      const newQty = existing.quantity + qty;
      const newTotal = newQty * existing.price_wholesale - existing.discount;
      const newItems = items.map((i) =>
        i.id === p.id ? { ...i, quantity: newQty, total: newTotal } : i
      );
      set({ items: newItems });
      message.success(`Cập nhật SL: ${p.name}`);
    } else {
      const newItem: CartItem = {
        ...p,
        stock_quantity: p.stock_quantity || 0, // [NEW] Ensure stock info is preserved
        key: `${p.id}_${Date.now()}`,
        quantity: qty,
        discount: 0,
        total: qty * p.price_wholesale,
      };
      set({ items: [newItem, ...items] });
      message.success(`Đã thêm: ${p.name}`);
    }
  },

  setItems: (items) => set({ items }), // [NEW]


  updateItem: (key, field, value) => {
    const { items } = get();
    const newItems = items.map((item) => {
      if (item.key !== key) return item;
      const updated = { ...item, [field]: value };
      updated.total =
        updated.quantity * updated.price_wholesale - updated.discount;
      return updated;
    });
    set({ items: newItems });
  },

  removeItem: (key) =>
    set((s) => ({ items: s.items.filter((i) => i.key !== key) })),

  setDeliveryMethod: (method) =>
    set({ deliveryMethod: method, shippingPartner: null, shippingFee: 0 }),

  setShippingPartner: (p) => {
    if (!p) {
      set({ shippingPartner: null, shippingFee: 0 });
      return;
    }
    set({ shippingPartner: p, shippingFee: p.base_fee || 0 });
  },

  setPackages: (n) => set({ totalPackages: n }),

  // FIX: Action mới
  setShippingFee: (fee) => set({ shippingFee: fee }),
  setManualDiscount: (d) => set({ manualDiscount: d }), // [NEW]

  setVoucher: (v) => set({ selectedVoucher: v }),
  setNote: (s) => set({ note: s }),

  reset: () =>
    set({
      customer: null,
      items: [],
      selectedVoucher: null,
      note: "",
      shippingPartner: null,
      deliveryMethod: "internal",
      totalPackages: 1,
      shippingFee: 0,
      estDeliveryDate: null,
      manualDiscount: 0,
    }),

  getSummary: () => {
    const s = get();
    const subTotal = s.items.reduce((sum, i) => sum + i.total, 0);
    const totalQty = s.items.reduce((sum, i) => sum + i.quantity, 0);

    let discountAmount = 0;
    
    // Ưu tiên Manual Discount nếu có (Override)
    if (s.manualDiscount > 0) {
        discountAmount = s.manualDiscount;
    } 
    else if (s.selectedVoucher) {
      const v = s.selectedVoucher;
      if (subTotal >= v.min_order_value) {
        discountAmount =
          v.discount_type === "fixed"
            ? v.discount_value
            : (subTotal * v.discount_value) / 100;
        if (v.max_discount_value && discountAmount > v.max_discount_value) {
          discountAmount = v.max_discount_value;
        }
      }
    }

    const finalTotal = subTotal + s.shippingFee - discountAmount;
    const oldDebt = s.customer?.current_debt || 0;
    const totalPayable = finalTotal + oldDebt;

    return {
      totalQty,
      subTotal,
      discountAmount,
      finalTotal,
      oldDebt,
      totalPayable,
    };
  },
}));

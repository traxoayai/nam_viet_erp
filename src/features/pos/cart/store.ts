// src/features/pos/cart/store.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import {
  CartItem,
  CartTotals,
  PosVoucher,
  PosProductSearchResult,
} from "@/features/pos/types/pos.types";

interface PosCartState {
  items: CartItem[];
  // Legacy: customer shape chưa chuẩn hoá (id, name, debt_amount, ...) → refactor riêng PR.
  customer: unknown | null;
  isInvoiceRequested: boolean; // Khách có yêu cầu xuất VAT không?
  selectedVoucher: PosVoucher | null;

  // Actions
  addToCart: (product: PosProductSearchResult) => void;
  removeFromCart: (id: number) => void;
  updateQuantity: (id: number, qty: number) => void;
  updateItemField: (id: number, field: keyof CartItem, value: unknown) => void;

  setCustomer: (cust: unknown) => void;
  toggleInvoiceRequest: () => void; // Đổi tên hàm VAT
  applyVoucher: (voucher: PosVoucher | null) => void;
  clearCart: () => void;

  // Getter
  getTotals: () => CartTotals;
}

export const usePosCartStore = create<PosCartState>()(
  persist(
    (set, get) => ({
      items: [],
      customer: null,
      isInvoiceRequested: false, // Mặc định không xuất
      selectedVoucher: null,

      addToCart: (product) => {
        const { items } = get();
        const existing = items.find((i) => i.id === product.id);
        if (existing) {
          set({
            items: items.map((i) =>
              i.id === product.id ? { ...i, qty: i.qty + 1 } : i
            ),
          });
        } else {
          set({
            items: [
              ...items,
              { ...product, qty: 1, price: product.retail_price, dosage: "" },
            ],
          });
        }
      },

      removeFromCart: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      updateQuantity: (id, qty) =>
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, qty } : i)),
        })),

      updateItemField: (id, field, value) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, [field]: value } : i
          ),
        })),

      setCustomer: (cust) => set({ customer: cust, selectedVoucher: null }),

      toggleInvoiceRequest: () =>
        set((state) => ({ isInvoiceRequested: !state.isInvoiceRequested })),

      applyVoucher: (voucher) => set({ selectedVoucher: voucher }),

      clearCart: () =>
        set({
          items: [],
          customer: null,
          selectedVoucher: null,
          isInvoiceRequested: false,
        }),

      getTotals: () => {
        const { items, selectedVoucher, customer } = get();

        // 1. Tổng tiền hàng
        const subTotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

        // 2. Giảm giá (Voucher)
        let discountVal = 0;
        if (selectedVoucher) {
          if (selectedVoucher.discount_type === "fixed") {
            discountVal = selectedVoucher.discount_value;
          } else {
            discountVal = (subTotal * selectedVoucher.discount_value) / 100;
          }
        }
        if (discountVal > subTotal) discountVal = subTotal; // Không giảm âm tiền

        // 3. Tổng phải thu ĐƠN HÀNG NÀY (KHÔNG gộp nợ cũ — nợ cũ gạch riêng).
        const orderTotal = subTotal - discountVal;

        // 4. Nợ cũ (tham khảo, KHÔNG cộng vào orderTotal).
        const debtAmount = customer?.debt_amount || 0;

        // 5. grandTotal giữ field cho consumers cũ; = orderTotal (không gộp nợ cũ).
        const grandTotal = orderTotal;

        return {
          subTotal,
          discountVal,
          orderTotal,
          debtAmount,
          grandTotal,
        };
      },
    }),
    {
      name: "pos-cart-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

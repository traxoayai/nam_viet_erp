//src/features/pos/stores/usePosCartStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CartItem, CartTotals, PosVoucher, PosProductSearchResult } from "../types/pos.types";
import { message } from "antd";
import { supabase } from "@/shared/lib/supabaseClient";

// Định nghĩa cấu trúc 1 Đơn hàng (Tab)
export interface PosOrder {
  id: string;          // UUID hoặc Timestamp
  name: string;        // "Đơn 1", "Đơn 2"...
  items: CartItem[];
  customer: any | null;
  selectedVoucher: PosVoucher | null;
  isInvoiceRequested: boolean;
  note?: string;       // Ghi chú đơn
}

interface PosCartState {
  orders: PosOrder[];      // Danh sách các tab đơn hàng
  activeOrderId: string;   // ID đơn hàng đang thao tác
  warehouseId: number | null;
  availableVouchers: PosVoucher[]; // Vouchers of active order's customer

  // Actions cho Tab
  createOrder: () => void;           // F1
  setActiveOrder: (id: string) => void;
  removeOrder: (id: string) => void; // Đóng tab
  
  // Actions cho Giỏ hàng (Tác động vào activeOrderId)
  addToCart: (product: PosProductSearchResult) => void;
  removeFromCart: (itemId: number) => void;
  updateQuantity: (itemId: number, qty: number) => void;
  updateItemField: (id: number, field: keyof CartItem, value: any) => void;
  setCustomer: (cust: any) => void;
  
  toggleInvoiceRequest: () => void; 
  setAvailableVouchers: (vouchers: PosVoucher[]) => void;
  applyVoucher: (voucher: PosVoucher | null) => void;
  fetchVouchers: (customerId: number, total: number) => Promise<void>;
  
  clearCart: () => void; // Làm sạch tab hiện tại
  setWarehouseId: (id: number | null) => void;

  // Getter
  getCurrentOrder: () => PosOrder | undefined;
  getTotals: () => CartTotals;
}

export const usePosCartStore = create<PosCartState>()(
  persist(
    (set, get) => ({
      orders: [{ id: 'default', name: 'Đơn 1', items: [], customer: null, selectedVoucher: null, isInvoiceRequested: false }],
      activeOrderId: 'default',
      warehouseId: 1,
      availableVouchers: [],

      getCurrentOrder: () => {
          const { orders, activeOrderId } = get();
          return orders.find(o => o.id === activeOrderId);
      },

      createOrder: () => {
          const { orders } = get();
          const newId = Date.now().toString();
          const newOrder: PosOrder = {
              id: newId,
              name: `Đơn ${orders.length + 1}`,
              items: [],
              customer: null,
              selectedVoucher: null,
              isInvoiceRequested: false
          };
          set({ 
              orders: [...orders, newOrder],
              activeOrderId: newId 
          });
          message.success("Đã tạo đơn mới (F1)");
      },

      setActiveOrder: (id) => {
          set({ activeOrderId: id });
          // Khi chuyển tab, cần load lại voucher cho khách của tab đó nếu cần thiết (optional)
          // Hoặc react component sẽ tự lo việc re-render
      },

      removeOrder: (id) => {
          const { orders, activeOrderId } = get();
          if (orders.length <= 1) {
              // Nếu còn 1 đơn thì chỉ clear data, không xóa tab
              get().clearCart();
              return;
          }
          
          const newOrders = orders.filter(o => o.id !== id);
          // Nếu xóa đơn đang active thì chuyển active sang đơn kế tiếp
          let newActiveId = activeOrderId;
          if (activeOrderId === id) {
              newActiveId = newOrders[newOrders.length - 1].id;
          }
          
          set({ orders: newOrders, activeOrderId: newActiveId });
      },

      addToCart: (product) => {
          const { orders, activeOrderId } = get();
          
          // [FIX] Map lại vị trí kho từ API (phẳng) sang Object (để UI dùng không bị lỗi)
          const normalizedProduct = {
              ...product,
              location: product.location || {
                  cabinet: (product as any).location_cabinet || '',
                  row: (product as any).location_row || '',
                  slot: (product as any).location_slot || ''
              }
          };

          const newOrders = orders.map(order => {
              if (order.id !== activeOrderId) return order;

              // Validate tồn kho...
              if ((normalizedProduct.stock_quantity || 0) <= 0) {
                  message.warning(`"${normalizedProduct.name}" hết hàng!`);
                  return order;
              }

              const existingItem = order.items.find(i => i.id === normalizedProduct.id);
              let newItems = [];
              
              if (existingItem) {
                   if (existingItem.qty + 1 > (normalizedProduct.stock_quantity || 0)) {
                        message.warning(`Kho chỉ còn ${normalizedProduct.stock_quantity}`);
                        return order;
                   }
                   newItems = order.items.map(i => i.id === normalizedProduct.id ? { ...i, qty: i.qty + 1 } : i);
              } else {
                   newItems = [...order.items, { 
                       ...normalizedProduct, 
                       qty: 1, 
                       price: normalizedProduct.retail_price, 
                       dosage: "" 
                   }];
              }
              
              return { ...order, items: newItems };
          });
          
          set({ orders: newOrders });
          message.success("Đã thêm vào giỏ");
      },

      removeFromCart: (id) => {
          const { orders, activeOrderId } = get();
          set({
              orders: orders.map(o => o.id === activeOrderId ? { ...o, items: o.items.filter(i => i.id !== id) } : o)
          });
      },

      updateQuantity: (id, qty) => {
          const { orders, activeOrderId } = get();
          const currentOrder = get().getCurrentOrder();
          if (!currentOrder) return;

          const item = currentOrder.items.find(i => i.id === id);
          if (!item) return;

          // Validate stock
          const productStock = item.stock_quantity || 0;
          if (qty > productStock) {
                message.warning(`Vượt quá tồn kho (${productStock})`);
                return;
          }

          set({
              orders: orders.map(o => o.id === activeOrderId ? { 
                  ...o, 
                  items: o.items.map(i => i.id === id ? { ...i, qty } : i) 
              } : o)
          });
      },

      updateItemField: (id, field, value) => {
          const { orders, activeOrderId } = get();
          set({
              orders: orders.map(o => o.id === activeOrderId ? { 
                  ...o, 
                  items: o.items.map(i => i.id === id ? { ...i, [field]: value } : i) 
              } : o)
          });
      },

      setCustomer: (cust) => {
          const { orders, activeOrderId } = get();
          set({
              orders: orders.map(o => o.id === activeOrderId ? { ...o, customer: cust, selectedVoucher: null } : o)
          });
      },

      toggleInvoiceRequest: () => {
          const { orders, activeOrderId } = get();
          set({
              orders: orders.map(o => o.id === activeOrderId ? { ...o, isInvoiceRequested: !o.isInvoiceRequested } : o)
          });
      },

      setAvailableVouchers: (vouchers) => set({ availableVouchers: vouchers }),

      applyVoucher: (voucher) => {
          const { orders, activeOrderId } = get();
          set({
              orders: orders.map(o => o.id === activeOrderId ? { ...o, selectedVoucher: voucher } : o)
          });
      },

      fetchVouchers: async (customerId, total) => {
          try {
              const { data, error } = await supabase.rpc('get_pos_usable_promotions', { 
                  p_customer_id: customerId, 
                  p_order_total: total 
              });
              
              if (error) {
                  console.error("Lỗi lấy voucher:", error);
                  return;
              }

              const vouchers = (data || []) as PosVoucher[];
              
              set({ availableVouchers: vouchers });
              
              // Validate existing voucher
              const currentOrder = get().getCurrentOrder();
              if (currentOrder && currentOrder.selectedVoucher) {
                  const stillValid = vouchers.find(v => v.id === currentOrder.selectedVoucher?.id && v.is_eligible);
                  if (!stillValid) {
                      get().applyVoucher(null); // Remove invalid voucher
                  }
              }

          } catch (err) {
              console.error(err);
          }
      },
      
      clearCart: () => { // Clears current order logic
          const { orders, activeOrderId } = get();
          set({
              orders: orders.map(o => o.id === activeOrderId ? { ...o, items: [], customer: null, selectedVoucher: null, isInvoiceRequested: false } : o),
              availableVouchers: []
          });
      },
      
      setWarehouseId: (id) => set({ warehouseId: id }),

      getTotals: () => {
        const currentOrder = get().getCurrentOrder();
        if (!currentOrder) return { subTotal: 0, discountVal: 0, debtAmount: 0, grandTotal: 0 };

        const { items, selectedVoucher, customer } = currentOrder;
        
        // 1. Tổng tiền hàng
        const subTotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
        
        // 2. Giảm giá (Voucher)
        let discountVal = 0;
        if (selectedVoucher) {
             if (subTotal >= selectedVoucher.min_order_value) {
                 if (selectedVoucher.discount_type === 'fixed') {
                     discountVal = selectedVoucher.discount_value;
                 } else {
                     discountVal = (subTotal * selectedVoucher.discount_value) / 100;
                     if (selectedVoucher.max_discount_value && discountVal > selectedVoucher.max_discount_value) {
                         discountVal = selectedVoucher.max_discount_value;
                     }
                 }
             } else {
                 discountVal = 0; 
             }
        }
        
        if (discountVal > subTotal) discountVal = subTotal;

        // 3. Nợ cũ
        const debtAmount = customer?.debt_amount || 0;

        // 4. Tổng thanh toán
        const grandTotal = (subTotal - discountVal) + debtAmount;

        return {
            subTotal,
            discountVal,
            debtAmount,
            grandTotal
        };
      },
    }),
    { name: "pos-cart-multi-tab", storage: createJSONStorage(() => localStorage) }
  )
);

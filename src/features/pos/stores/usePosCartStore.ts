import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CartItem, CartTotals, PosVoucher, PosProductSearchResult } from "../types/pos.types";
import { message } from "antd";
import { supabase } from "@/shared/lib/supabaseClient";

interface PosCartState {
  items: CartItem[];
  customer: any | null; // Sẽ chứa { id, name, debt_amount, ... }
  isInvoiceRequested: boolean; // Khách có yêu cầu xuất VAT không?
  selectedVoucher: PosVoucher | null;
  availableVouchers: PosVoucher[]; // [NEW] Quản lý Voucher load từ API
  warehouseId: number | null; // [NEW] Kho đang bán

  // Actions
  addToCart: (product: PosProductSearchResult) => void;
  removeFromCart: (id: number) => void;
  updateQuantity: (id: number, qty: number) => void;
  updateItemField: (id: number, field: keyof CartItem, value: any) => void;
  
  setCustomer: (cust: any) => void;
  setWarehouseId: (id: number | null) => void; // [NEW] Wrapper
  toggleInvoiceRequest: () => void; // Đổi tên hàm VAT
  setAvailableVouchers: (vouchers: PosVoucher[]) => void;
  applyVoucher: (voucher: PosVoucher | null) => void;
  fetchVouchers: (customerId: number, total: number) => Promise<void>;
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
      availableVouchers: [], // [NEW] Init empty
      warehouseId: 1, // Mặc định kho 1, sẽ được update ngay khi vào trang POS


      fetchVouchers: async (customerId, total) => {
          try {
              // Gọi RPC V6 của Core
              const { data, error } = await supabase.rpc('get_pos_usable_promotions', { 
                  p_customer_id: customerId, 
                  p_order_total: total 
              });
              
              if (error) {
                  console.error("Lỗi lấy voucher:", error);
                  return;
              }

              // Format dữ liệu nếu cần (Core trả về snake_case, FE dùng camelCase?)
              // Core V6 trả về JSONB key chuẩn rồi, chỉ cần map nếu type khác biệt
              // Nhưng TypeScript cần ép kiểu cho an toàn
              const vouchers = (data || []) as PosVoucher[];
              
              set({ availableVouchers: vouchers });
              
              // Tự động bỏ chọn Voucher nếu không còn trong danh sách hoặc không đủ điều kiện (Optional)
              const { selectedVoucher } = get();
              if (selectedVoucher) {
                  const stillValid = vouchers.find(v => v.id === selectedVoucher.id && v.is_eligible);
                  if (!stillValid) {
                      set({ selectedVoucher: null }); // Bỏ chọn nếu không còn hợp lệ
                  }
              }

          } catch (err) {
              console.error(err);
          }
      },

      addToCart: (product) => {
        const { items } = get();
        
        // 1. [CRITICAL FIX] Kiểm tra tồn kho trước khi thêm
        if ((product.stock_quantity || 0) <= 0) {
            message.warning(`Sản phẩm "${product.name}" đã hết hàng trong kho này!`);
            return;
        }

        const existing = items.find((i) => i.id === product.id);
        
        // 2. Kiểm tra nếu cộng thêm sẽ vượt quá tồn kho
        if (existing && existing.qty + 1 > (product.stock_quantity || 0)) {
            message.warning(`Không thể thêm. Kho chỉ còn ${product.stock_quantity} sản phẩm.`);
            return;
        }

        if (existing) {
          set({
            items: items.map((i) =>
              i.id === product.id ? { ...i, qty: i.qty + 1 } : i
            ),
          });
        } else {
          set({ items: [...items, { ...product, qty: 1, price: product.retail_price, dosage: "" }] });
        }
      },

      removeFromCart: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      updateQuantity: (id, qty) => {
        const { items } = get();
        const item = items.find((i) => i.id === id);
        if (!item) return;

        // [CRITICAL FIX] Validate số lượng khi sửa tay
        const productStock = item.stock_quantity || 0;
        if (qty > productStock) {
            message.warning(`Vượt quá tồn kho (${productStock})`);
            return;
        }

        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, qty } : i)),
        }));
      },

      updateItemField: (id, field, value) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, [field]: value } : i
          ),
        })),

      setCustomer: (cust) => set({ customer: cust, selectedVoucher: null }),
      
      setWarehouseId: (id) => set({ warehouseId: id }),

      toggleInvoiceRequest: () => set((state) => ({ isInvoiceRequested: !state.isInvoiceRequested })),
      
      setAvailableVouchers: (vouchers) => set({ availableVouchers: vouchers }),

      applyVoucher: (voucher) => set({ selectedVoucher: voucher }),
      
      clearCart: () => set({ items: [], customer: null, selectedVoucher: null, isInvoiceRequested: false, availableVouchers: [] }),

      getTotals: () => {
        const { items, selectedVoucher, customer } = get();
        
        // 1. Tổng tiền hàng
        const subTotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
        
        // 2. Giảm giá (Voucher)
        let discountVal = 0;
        if (selectedVoucher) {
             // Check điều kiện đơn tối thiểu lại lần nữa cho chắc
             if (subTotal >= selectedVoucher.min_order_value) {
                 if (selectedVoucher.discount_type === 'fixed') {
                     discountVal = selectedVoucher.discount_value;
                 } else {
                     // Giảm theo %
                     discountVal = (subTotal * selectedVoucher.discount_value) / 100;
                     // Check tối đa giảm (nếu có config)
                     if (selectedVoucher.max_discount_value && discountVal > selectedVoucher.max_discount_value) {
                         discountVal = selectedVoucher.max_discount_value;
                     }
                 }
             } else {
                 // Nếu lỡ xóa bớt hàng làm không đủ điều kiện -> Tự bỏ voucher
                 // (Ở đây ta tạm tính discount = 0, UI sẽ cảnh báo sau)
                 discountVal = 0; 
             }
        }
        
        if (discountVal > subTotal) discountVal = subTotal; // Không giảm âm tiền

        // 3. Nợ cũ (Lấy từ thông tin khách hàng)
        const debtAmount = customer?.debt_amount || 0;

        // 4. Tổng thanh toán
        // Công thức: (Hàng - Voucher) + Nợ
        const grandTotal = (subTotal - discountVal) + debtAmount;

        return {
            subTotal,
            discountVal,
            debtAmount,
            grandTotal
        };
      },
    }),
    {
      name: "pos-cart-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

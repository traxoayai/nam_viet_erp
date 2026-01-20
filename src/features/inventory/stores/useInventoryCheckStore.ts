// src/features/inventory/stores/useInventoryCheckStore.ts
import { create } from 'zustand';
import { inventoryService } from '../api/inventoryService';
import { InventoryCheckItem, InventoryCheckSession } from '../types/inventory.types';
import { message } from 'antd';
import { debounce } from 'lodash';

interface InventoryCheckState {
    activeSession: InventoryCheckSession | null;
    items: InventoryCheckItem[];
    loading: boolean;
    
    // [LOGIC FOCUS]: ID sản phẩm đang được highlight
    activeItemId: number | null; 

    // Actions
    fetchSessionDetails: (checkId: number) => Promise<void>;
    
    // Hàm update đặc biệt: Tự tính Hộp/Lẻ -> Tổng
    updateItemQuantity: (itemId: number, boxQty: number, unitQty: number) => void;
    
    // Điều hướng
    setActiveItem: (id: number) => void;
    moveToNextItem: () => void;
    
    completeSession: (userId: string) => Promise<void>;

    // [NEW ACTIONS]
    saveCheckInfo: (note: string) => Promise<void>;
    cancelSession: () => Promise<void>;
}

export const useInventoryCheckStore = create<InventoryCheckState>((set, get) => ({
    activeSession: null,
    items: [],
    loading: false,
    activeItemId: null,

    fetchSessionDetails: async (checkId) => {
        set({ loading: true });
        try {
            const { session, items } = await inventoryService.getCheckSession(checkId);
            set({ 
                activeSession: session as any, 
                items,
                // Mặc định highlight thằng đầu tiên
                activeItemId: items.length > 0 ? items[0].id : null 
            });
        } catch (error) {
            console.error(error);
            message.error("Lỗi tải phiếu kiểm kê");
        } finally {
            set({ loading: false });
        }
    },

    updateItemQuantity: (itemId, boxQty, unitQty) => {
        const { items } = get();
        
        const updatedItems = items.map(item => {
            if (item.id !== itemId) return item;

            // [FIX] Đảm bảo rate luôn >= 1 để tránh lỗi chia cho 0
            const rate = (item.retail_unit_rate && item.retail_unit_rate > 0) ? item.retail_unit_rate : 1;
            
            // Tính tổng
            const newActualTotal = (Number(boxQty || 0) * rate) + Number(unitQty || 0);

            return {
                ...item,
                actual_quantity: newActualTotal,
                // [FIX] Đảm bảo system_quantity có giá trị
                diff_quantity: newActualTotal - (item.system_quantity || 0)
            };
        });
        
        set({ items: updatedItems });

        // Debounce gọi API (Giữ nguyên)
        const currentRate = items.find(i=>i.id===itemId)?.retail_unit_rate || 1;
        saveToDbDebounced(itemId, (Number(boxQty || 0) * currentRate) + Number(unitQty || 0));
    },

    setActiveItem: (id) => set({ activeItemId: id }),

    moveToNextItem: () => {
        const { items, activeItemId } = get();
        if (!activeItemId) return;

        const currentIndex = items.findIndex(i => i.id === activeItemId);
        if (currentIndex !== -1 && currentIndex < items.length - 1) {
            const nextId = items[currentIndex + 1].id;
            set({ activeItemId: nextId });
        } else {
            message.success("Đã đi đến cuối danh sách!");
        }
    },

    completeSession: async (userId) => {
        const { activeSession } = get();
        if(!activeSession) return;
        try {
             await inventoryService.completeCheck(activeSession.id, userId);
             message.success("Đã hoàn tất kiểm kê!");
        } catch (err: any) {
             message.error("Lỗi: " + err.message);
        }
    },

    saveCheckInfo: async (note) => {
        const { activeSession } = get();
        if (!activeSession) return;
        try {
            message.loading({ content: 'Đang lưu...', key: 'save_process' });
            await inventoryService.updateCheckInfo(activeSession.id, note);
            
            // Cập nhật lại note trong state local
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            set({ activeSession: { ...activeSession, note } as any });
            
            message.success({ content: 'Đã lưu thông tin phiếu!', key: 'save_process' });
        } catch (error) {
            message.error({ content: 'Lỗi lưu phiếu', key: 'save_process' });
            console.error(error);
        }
    },

    cancelSession: async () => {
        const { activeSession } = get();
        if (!activeSession) return;
        
        await inventoryService.cancelCheck(activeSession.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        set({ activeSession: { ...activeSession, status: 'CANCELLED' } as any });
    }
}));

// Helper debounce save
const saveToDbDebounced = debounce((itemId: number, qty: number) => {
    inventoryService.updateCheckItemQty(itemId, qty).catch(err => console.error(err));
}, 500);

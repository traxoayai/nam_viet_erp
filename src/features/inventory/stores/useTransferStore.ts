// src/features/inventory/stores/useTransferStore.ts
import { create } from 'zustand';
import { transferService } from '../api/transferService';
import { TransferMaster, TransferDetail } from '../types/transfer';
import { message } from 'antd';

interface TransferState {
  transfers: TransferMaster[];
  currentTransfer: TransferDetail | null;
  loading: boolean;
  totalCount: number;

  fetchList: (params: { page?: number; pageSize?: number; status?: string; search?: string }) => Promise<void>;
  createAutoRequest: (warehouseId: number, note?: string) => Promise<boolean>;
  getDetail: (id: number) => Promise<void>;
  updateStatus: (id: number, status: string) => Promise<void>;
  approveRequest: (id: number, items: { id: number; qty_approved: number }[]) => Promise<boolean>;
  removeTransferItem: (itemId: number) => Promise<boolean>;
  cancelRequest: (id: number, reason: string) => Promise<boolean>;
  deleteRequest: (id: number) => Promise<boolean>;
  
  shippingDraft: Record<number, any[]>; // itemId -> picked batches
  availableBatchesMap: Record<number, any[]>; // productId -> all available batches
  scannedCode: string;
  isAllocationDone: boolean;

  loadAvailableBatches: (productId: number) => Promise<any[]>;
  setShippingDraft: (itemId: number, batches: any[]) => void;
  initTransferOperation: (id: number) => Promise<void>;
  handleBarcodeScan: (code: string) => void;
  updateDraftItem: (itemId: number, batchId: number, quantity: number) => void;
  submitTransferShipment: () => Promise<boolean>;
  resetDetail: () => void;
}

export const useTransferStore = create<TransferState>((set, get) => ({
  transfers: [],
  currentTransfer: null,
  shippingDraft: {},
  availableBatchesMap: {},
  scannedCode: '',
  isAllocationDone: false,
  loading: false,
  totalCount: 0,

  fetchList: async (params) => {
    set({ loading: true });
    try {
      const { data, total } = await transferService.fetchTransfers(params);
      set({ transfers: data, totalCount: total });
    } catch (error: any) {
      console.error('Error fetching transfers:', error);
      message.error(error.message || 'Lỗi tải danh sách điều chuyển');
    } finally {
      set({ loading: false });
    }
  },

  createAutoRequest: async (warehouseId, note) => {
    set({ loading: true });
    try {
      await transferService.createAutoReplenishment(warehouseId, note);
      message.success('Đã tạo phiếu yêu cầu điều chuyển thành công!');
      // Refresh list if needed (typically done by calling component)
      return true;
    } catch (error: any) {
      console.error('Error creating transfer request:', error);
      message.error(error.message || 'Lỗi tạo phiếu điều chuyển');
      return false;
    } finally {
      set({ loading: false });
    }
  },

  getDetail: async (id) => {
    set({ loading: true, currentTransfer: null });
    try {
      const data = await transferService.getTransferDetail(id);
      set({ currentTransfer: data });
    } catch (error: any) {
      console.error('Error fetching transfer detail:', error);
      message.error(error.message || 'Lỗi tải chi tiết phiếu điều chuyển');
    } finally {
      set({ loading: false });
    }
  },

  updateStatus: async (id, status) => {
    // Optimistic update or wait? Let's wait for safety logic
    set({ loading: true });
    try {
        // @ts-ignore
        await transferService.updateTransferStatus(id, status);
        message.success('Cập nhật trạng thái thành công');
        
        // Reload detail if current
        const current = get().currentTransfer;
        if (current && current.id === id) {
            await get().getDetail(id);
        }
    } catch (error: any) {
        console.error('Error updating status:', error);
        message.error(error.message || 'Lỗi cập nhật trạng thái');
    } finally {
        set({ loading: false });
    }
  },

  approveRequest: async (id, items) => {
    set({ loading: true });
    try {
        await transferService.approveTransfer(id, items);
        message.success('Đã duyệt phiếu điều chuyển thành công!');
        // Refresh detail
        await get().getDetail(id);
        return true;
    } catch (error: any) {
        console.error('Error approving transfer:', error);
        message.error(error.message || 'Lỗi duyệt phiếu');
        return false;
    } finally {
        set({ loading: false });
    }
  },

  cancelRequest: async (id, reason) => {
    set({ loading: true });
    try {
        await transferService.cancelTransfer(id, reason);
        message.success('Đã hủy phiếu điều chuyển.');
        return true;
    } catch (error: any) {
        console.error('Error cancelling transfer:', error);
        message.error(error.message || 'Lỗi hủy phiếu');
        return false;
    } finally {
        set({ loading: false });
    }
  },

  deleteRequest: async (id) => {
    set({ loading: true });
    try {
        await transferService.deleteTransfer(id);
        message.success('Đã xóa phiếu điều chuyển.');
        return true;
    } catch (error: any) {
        console.error('Error deleting transfer:', error);
        message.error(error.message || 'Lỗi xóa phiếu');
        return false;
    } finally {
        set({ loading: false });
    }
  },

  removeTransferItem: async (itemId) => {
      set({ loading: true });
      try {
          await transferService.deleteTransferItem(itemId);
          
          // Update State
          set(state => {
              if (!state.currentTransfer) return {};
              
              const newItems = state.currentTransfer.items.filter(i => i.id !== itemId);
              // Clean draft
              const newDraft = { ...state.shippingDraft };
              delete newDraft[itemId];
              
              return {
                  currentTransfer: { ...state.currentTransfer, items: newItems },
                  shippingDraft: newDraft
              };
          });

          message.success('Đã xóa sản phẩm khỏi phiếu');
          return true;
      } catch (error: any) {
          console.error('Error removing item:', error);
          message.error(error.message || 'Lỗi xóa sản phẩm');
          return false;
      } finally {
          set({ loading: false });
      }
  },

  loadAvailableBatches: async (productId) => {
      const current = get().currentTransfer;
      if (!current) return [];
      
      try {
          return await transferService.fetchSourceBatches(productId, current.source_warehouse_id);
      } catch (error) {
          console.error('Error fetching batches:', error);
          return [];
      }
  },

  setShippingDraft: (itemId, batches) => {
      set(state => ({
          shippingDraft: { ...state.shippingDraft, [itemId]: batches }
      }));
  },

  initTransferOperation: async (id) => {
      set({ loading: true, isAllocationDone: false, shippingDraft: {} });
      try {
          // 1. Fetch Transfer Detail
          const transferData = await transferService.getTransferDetail(id);
          if (!transferData) throw new Error('Transfer not found');
          
          set({ currentTransfer: transferData });

          // 2. Fetch Batches for ALL items
          const batchMap = await transferService.fetchBatchesForTransfer(
              transferData.items.map(i => ({ product_id: i.product_id })),
              transferData.source_warehouse_id
          );

          set({ availableBatchesMap: batchMap });

          // 3. Auto Allocate (FEFO)
          const newDraft: Record<number, any[]> = {};
          
          transferData.items.forEach(item => {
             const availableBatches = batchMap[item.product_id] || [];
             // Sort by expiry (already sorted by RPC usually, but ensure here if needed)
             availableBatches.sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());
             
             let remainingNeeded = item.quantity_requested;
             const pickedList: any[] = [];

             for (const batch of availableBatches) {
                 if (remainingNeeded <= 0) break;
                 
                 const take = Math.min(batch.quantity, remainingNeeded); // batch.quantity is available qty
                 if (take > 0) {
                     pickedList.push({ ...batch, quantity_picked: take });
                     remainingNeeded -= take;
                 }
             }
             newDraft[item.id] = pickedList;
          });

          set({ shippingDraft: newDraft, isAllocationDone: true });
      } catch (error: any) {
          console.error('Error init operation:', error);
          message.error('Lỗi khởi tạo dữ liệu xuất kho');
      } finally {
          set({ loading: false });
      }
  },

  handleBarcodeScan: (code) => {
      const { currentTransfer, shippingDraft } = get();
      if (!currentTransfer) return;

      // 1. Identify Item
      // Check both SKU and Barcode (trim whitespaces to be safe)
      const cleanCode = code.trim();
      const targetItem = currentTransfer.items.find(i => 
          (i.sku && i.sku.trim() === cleanCode) || 
          (i.barcode && i.barcode.trim() === cleanCode)
      );
      
      if (!targetItem) {
          message.warning(`Không tìm thấy sản phẩm với mã "${code}" trong phiếu này`);
          return;
      }

      set({ scannedCode: code }); // Just for UI highlight

      // 2. Increment Logic
      // Find the first available batch in draft (FEFO) or just increment the first one if already picked?
      // Smart Scan: If we have batches picked, increment the first one that has availability.
      // If we need to pick a new batch, that's complex without the full batch list in memory.
      // Simplified: Just increment the first picked batch for that item.
      
      const currentPicked = shippingDraft[targetItem.id] || [];
      
      // CASE 1: Already has picked batches -> Increment the first one
      if (currentPicked.length > 0) {
          // Clone to avoid mutation
          const newPicked = currentPicked.map((b, index) => {
              if (index === 0) {
                  // Increment first batch (Simplified) - Real logic needs to check max availability
                   // Check max avail of this batch
                   const max = b.quantity; // total avail of this batch
                   if (b.quantity_picked < max) {
                        message.success(`Đã quét "${targetItem.product_name}" (+1)`);
                        return { ...b, quantity_picked: b.quantity_picked + 1 };
                   } else {
                        message.warning(`Lô ${b.batch_code} đã hết tồn kho khả dụng!`);
                   }
              }
              return b;
          });
          
          set(state => ({
              shippingDraft: { ...state.shippingDraft, [targetItem.id]: newPicked }
          }));
      } 
      // CASE 2: No batches picked yet -> Auto pick first available batch (FEFO)
      else {
          const available = get().availableBatchesMap[targetItem.product_id] || [];
          
          if (available.length === 0) {
             message.error(`Sản phẩm "${targetItem.product_name}" hiện đã hết hàng tồn kho!`);
             return;
          }

          // Pick first available (Available list is usually sorted by expiry ASC from backend/init)
          const firstBatch = available[0];
          
          message.success(`Đã quét "${targetItem.product_name}" (+1) - Tự động chọn lô ${firstBatch.batch_code}`);
          
          set(state => ({
              shippingDraft: { 
                  ...state.shippingDraft, 
                  [targetItem.id]: [{ ...firstBatch, quantity_picked: 1 }] 
              }
          }));
      }
  },

  // [FIX] Smart Update: Tự động phân bổ số lượng nhập tay vào các lô (FEFO)
  updateDraftItem: (itemId, _batchId, totalQty) => {
      set(state => {
          // 1. Tìm thông tin sản phẩm từ Item ID
          const item = state.currentTransfer?.items.find(i => i.id === itemId);
          if (!item) return {};

          // 2. Lấy danh sách lô khả dụng (Đã load từ initTransferOperation)
          let available = state.availableBatchesMap[item.product_id] || [];
          
          if (available.length === 0) {
              message.warning("Sản phẩm này không có lô tồn kho khả dụng!");
              return {}; // Giữ nguyên state cũ
          }

          // 3. Sắp xếp lô theo hạn sử dụng (Cũ nhất dùng trước - FEFO)
          // Clone mảng để không mutate state gốc
          const sortedBatches = [...available].sort((a, b) => 
              new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
          );

          // 4. Phân bổ số lượng (Allocation Logic)
          let remainingNeeded = totalQty;
          const newDraftList: any[] = [];

          for (const batch of sortedBatches) {
              if (remainingNeeded <= 0) break; // Đã lấy đủ

              // Lấy tối đa có thể của lô này
              const take = Math.min(batch.quantity, remainingNeeded);
              
              newDraftList.push({
                  ...batch,
                  quantity_picked: take
              });

              remainingNeeded -= take;
          }

          // 5. Cảnh báo nếu không đủ hàng
          if (remainingNeeded > 0) {
              message.warning(`Kho chỉ còn đủ ${totalQty - remainingNeeded} sản phẩm (Thiếu ${remainingNeeded})`);
          }

          // 6. Cập nhật State
          return {
              shippingDraft: { 
                  ...state.shippingDraft, 
                  [itemId]: newDraftList 
              }
          };
      });
  },

  submitTransferShipment: async () => {
      const { currentTransfer, shippingDraft } = get();
      if (!currentTransfer) return false;

      set({ loading: true });
      try {
          // Transform draft to RPC format
          const itemsPayload: { transfer_item_id: number; batch_id: number; quantity: number }[] = [];
          
          Object.entries(shippingDraft).forEach(([itemId, batches]) => {
              batches.forEach(batch => {
                  itemsPayload.push({
                      transfer_item_id: Number(itemId),
                      batch_id: batch.id,
                      quantity: batch.quantity_picked // Assuming local batch object has this field
                  });
              });
          });

          if (itemsPayload.length === 0) {
              message.warning('Chưa có sản phẩm nào được chọn để xuất kho');
              return false;
          }

          await transferService.submitShipping(currentTransfer.id, itemsPayload);
          message.success('Đã xuất kho thành công!');
          return true;
      } catch (error: any) {
          console.error('Error submitting shipment:', error);
          message.error(error.message || 'Lỗi xuất kho');
          return false;
      } finally {
          set({ loading: false });
      }
  },

  resetDetail: () => set({ currentTransfer: null, shippingDraft: {}, isAllocationDone: false, scannedCode: '' }),
}));

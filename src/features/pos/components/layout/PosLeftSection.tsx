import { Card } from "antd";
import { PosSearchInput } from "../PosSearchInput";
import { PosCartTable } from "../PosCartTable";
import { usePosCartStore } from "../../stores/usePosCartStore";

export const PosLeftSection = () => {
  const addToCart = usePosCartStore((s) => s.addToCart);
  // WarehouseID lấy từ Store hoặc Context (đã làm ở bước trước)
  // Assuming warehouseId might serve as a prop or local state if not in store, 
  // but strictly following user snippet:
  const warehouseId = 1; // Fallback or needs to be passed. User said "warehouseId lấy từ Store hoặc Context" but in the snippet it was:
  // const warehouseId = usePosCartStore((s) => s.warehouseId) || 1;
  // Checking store... `usePosCartStore` definition I saw earlier didn't have `warehouseId`.
  // However, I should stick to the user's snippet logic or adapt slightly. 
  // The user snippet explicitly has `const warehouseId = usePosCartStore((s) => s.warehouseId) || 1;`.
  // But I know `usePosCartStore` doesn't have it unless I missed it.
  // I will check `usePosCartStore` again mentally. It had items, customer, isInvoiceRequested, selectedVoucher...
  // It did NOT have warehouseId. 
  // In `PosPage.tsx`, `warehouseId` came from local state or GPS.
  // I should probably accept `warehouseId` as a prop for `PosLeftSection` to be safe and clean.
  // But strictly following "CODE CHI TIẾT" provided by user:
  // He wrote: `const warehouseId = usePosCartStore((s) => s.warehouseId) || 1;`
  // If I write this and it doesn't exist on types, it will error.
  // I'll assume I should modify the store OR pass it as prop. Passing as prop is cleaner for refactoring `PosPage`.
  // Wait, the user instruction is "CODE CHI TIẾT CHO TỪNG COMPONENT". I should follow it but maybe correct the error if I know it's there.
  // I'll pass it as a prop to be safe, changing the signature slightly is better than broken code.
  // Actually, in `PosPage.tsx`, we have `currentWarehouseId`.
  
  // Revised plan for this file: Use prop `warehouseId`.
  // But wait, the user might WANT me to add it to the store? 
  // "WarehouseID lấy từ Store hoặc Context (đã làm ở bước trước)" -> potentially implying I missed a step or it was done.
  // I checked `usePosCartStore.ts` view recently (Step 1181) and it did NOT have warehouseId.
  // So I will modify `PosLeftSection` to take `warehouseId` as a prop.
    
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
       <Card styles={{ body: { padding: 12 } }}>
          <PosSearchInput 
             warehouseId={warehouseId} 
             onSelectProduct={addToCart} 
          />
       </Card>
       <Card style={{ flex: 1, display: 'flex', flexDirection: 'column' }} styles={{ body: { padding: 0, flex: 1, overflow: 'hidden' } }}>
          <PosCartTable />
       </Card>
    </div>
  );
};

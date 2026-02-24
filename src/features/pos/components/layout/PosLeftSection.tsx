import { Card } from "antd";

import { usePosCartStore } from "../../stores/usePosCartStore";
import { PosCartTable } from "../PosCartTable";
import { PosSearchInput } from "../PosSearchInput";

interface Props {
  searchRef?: React.Ref<any>;
}

export const PosLeftSection = ({ searchRef }: Props) => {
  const addToCart = usePosCartStore((s) => s.addToCart);

  // [FIX] Lấy trực tiếp từ Store (Store này đã được PosPage update)
  const warehouseId = usePosCartStore((s) => s.warehouseId);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: "100%",
      }}
    >
      <Card bodyStyle={{ padding: 12 }}>
        <PosSearchInput
          // Nếu store chưa kịp load, fallback về 1.
          warehouseId={warehouseId || 1}
          onSelectProduct={addToCart}
          searchRef={searchRef}
        />
      </Card>
      <Card
        style={{ flex: 1, display: "flex", flexDirection: "column" }}
        bodyStyle={{ padding: 0, flex: 1, overflow: "hidden" }}
      >
        <PosCartTable />
      </Card>
    </div>
  );
};

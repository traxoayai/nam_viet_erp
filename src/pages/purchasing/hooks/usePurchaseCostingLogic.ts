// src/pages/purchasing/hooks/usePurchaseCostingLogic.ts
import { App } from "antd";
import { useState, useEffect, useCallback } from "react";

import { purchaseOrderService } from "@/features/purchasing/api/purchaseOrderService";
import { formatCurrency } from "@/shared/utils/format";

// --- TYPES ---
export interface CostingItem {
  id: number;
  product_id: number;
  sku: string;
  product_name: string;
  unit: string;
  quantity_ordered: number;
  unit_price: number;
  vat_rate: number;
  rebate_rate: number;
  bonus_quantity: number;
  allocated_shipping: number;
  final_unit_cost: number;
  conversion_factor: number;
}

export interface GiftItem {
  key: string;
  name: string;
  code: string;
  quantity: number;
  estimated_value: number;
  unit_name: string;
  image_url?: string;
}

interface UsePurchaseCostingLogicParams {
  poId: number | string;
  poItems: any[];
  shippingFee: number;
  supplierId?: number;
  onComplete?: () => void;
}

export const usePurchaseCostingLogic = ({
  poId,
  poItems,
  shippingFee,
  supplierId,
  onComplete,
}: UsePurchaseCostingLogicParams) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [preUpdateCosts, setPreUpdateCosts] = useState<any[]>([]);

  const [costingItems, setCostingItems] = useState<CostingItem[]>([]);
  const [giftItems, setGiftItems] = useState<GiftItem[]>([]);

  const [totalShippingFee, setTotalShippingFee] = useState<number>(0);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [programOptions, setProgramOptions] = useState<any[]>([]);

  // --- INIT: từ parent PO data ---
  useEffect(() => {
    if (!poItems || poItems.length === 0) return;

    const items: CostingItem[] = poItems.map((i: any) => ({
      id: i.id,
      product_id: i.product_id,
      sku: i.sku,
      product_name: i.product_name || i.name,
      unit: i.unit || i.uom_ordered,
      quantity_ordered: i.quantity_ordered || i.quantity,
      unit_price: Number(i.unit_price) || Number(i.price) || 0,
      vat_rate: 0,
      rebate_rate: 0,
      bonus_quantity: 0,
      allocated_shipping: 0,
      final_unit_cost: Number(i.unit_price) || 0,
      conversion_factor: i.conversion_factor || 1,
    }));
    setCostingItems(items);
    setTotalShippingFee(shippingFee || 0);
  }, [poItems, shippingFee]);

  // Load supplier programs
  useEffect(() => {
    if (!supplierId) return;
    const loadPrograms = async () => {
      try {
        const programs =
          await purchaseOrderService.getActiveProgramsBySupplier(supplierId);
        setProgramOptions(
          programs.map((p: any) => ({
            label: p.name,
            value: p.id,
          }))
        );
      } catch (err) {
        console.error("Error loading programs:", err);
      }
    };
    loadPrograms();
  }, [supplierId]);

  // --- CALCULATION ---
  const calculateRow = useCallback((item: CostingItem) => {
    const totalBase = item.unit_price * item.quantity_ordered;
    const afterRebate = totalBase * (1 - item.rebate_rate / 100);
    const afterVat = afterRebate * (1 + item.vat_rate / 100);
    const totalCost = afterVat + item.allocated_shipping;
    const totalQty = item.quantity_ordered + item.bonus_quantity;
    return totalQty > 0 ? totalCost / totalQty : 0;
  }, []);

  // Auto recalc
  useEffect(() => {
    setCostingItems((prev) =>
      prev.map((item) => ({
        ...item,
        final_unit_cost: calculateRow(item),
      }))
    );
  }, [
    JSON.stringify(
      costingItems.map((i) => [
        i.vat_rate,
        i.rebate_rate,
        i.bonus_quantity,
        i.allocated_shipping,
      ])
    ),
  ]);

  // --- SHIPPING ALLOCATION ---
  const handleAllocateShipping = useCallback(() => {
    const validItems = costingItems.filter(
      (i) => i.quantity_ordered * i.unit_price > 0
    );
    const totalValue = validItems.reduce(
      (sum, i) => sum + i.quantity_ordered * i.unit_price,
      0
    );
    if (totalValue === 0) return;

    const newItems = costingItems.map((item) => {
      const itemValue = item.quantity_ordered * item.unit_price;
      const ratio = itemValue / totalValue;
      const ship = Math.round(totalShippingFee * ratio);
      return {
        ...item,
        allocated_shipping: ship,
        final_unit_cost: calculateRow({ ...item, allocated_shipping: ship }),
      };
    });

    setCostingItems(newItems);
    message.success(
      `Đã phân bổ ${formatCurrency(totalShippingFee)} phí vận chuyển!`
    );
  }, [costingItems, totalShippingFee, calculateRow]);

  // --- ITEM CHANGE ---
  const handleItemChange = useCallback(
    (id: number, field: keyof CostingItem, value: number) => {
      setCostingItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          return { ...item, [field]: value };
        })
      );
    },
    []
  );

  // --- GIFTS ---
  const addGiftRow = useCallback(() => {
    const newGift: GiftItem = {
      key: Date.now().toString(),
      name: "",
      code: "",
      quantity: 1,
      estimated_value: 0,
      unit_name: "Cái",
    };
    setGiftItems((prev) => [...prev, newGift]);
  }, []);

  const removeGift = useCallback((key: string) => {
    setGiftItems((prev) => prev.filter((g) => g.key !== key));
  }, []);

  const updateGift = useCallback(
    (key: string, field: keyof GiftItem, value: any) => {
      setGiftItems((prev) =>
        prev.map((g) => (g.key === key ? { ...g, [field]: value } : g))
      );
    },
    []
  );

  // --- PROGRAM CHANGE ---
  const handleProgramChange = useCallback(
    async (programId: string) => {
      setSelectedProgram(programId);
      if (!programId) return;

      setLoading(true);
      try {
        const details = await purchaseOrderService.getProgramDetail(programId);
        if (!details || !details.groups) {
          message.warning("Không thể tải thông tin chương trình.");
          return;
        }

        const { groups, items: programItems } = details;

        let updatedItems = costingItems.map((i) => ({
          ...i,
          rebate_rate: 0,
          bonus_quantity: 0,
        }));
        const newGifts: GiftItem[] = [];
        let rebateCount = 0;
        let bonusCount = 0;
        let giftCount = 0;

        groups.forEach((group: any) => {
          const rules = group.rules || {};
          const ruleType = group.type || "rebate_revenue";

          const groupProductIds = programItems
            .filter((pi: any) => pi.group_id === group.id)
            .map((pi: any) => pi.product_id);

          if (groupProductIds.length === 0) return;

          const matchedItems = updatedItems.filter((item) =>
            groupProductIds.includes(item.product_id)
          );
          if (matchedItems.length === 0) return;

          if (ruleType === "rebate_revenue") {
            const groupRevenue = matchedItems.reduce(
              (sum, item) => sum + item.quantity_ordered * item.unit_price,
              0
            );
            const minTurnover = Number(rules.min_turnover || 0);
            if (groupRevenue >= minTurnover) {
              const rate = Number(rules.rate || 0);
              updatedItems = updatedItems.map((item) => {
                if (groupProductIds.includes(item.product_id)) {
                  return { ...item, rebate_rate: rate };
                }
                return item;
              });
              rebateCount += matchedItems.length;
            }
          } else if (ruleType === "buy_x_get_y") {
            const buyQty = Number(rules.buy_qty || 0);
            const getQty = Number(rules.get_qty || 0);
            if (buyQty > 0 && getQty > 0) {
              updatedItems = updatedItems.map((item) => {
                if (groupProductIds.includes(item.product_id)) {
                  const bonus =
                    Math.floor(item.quantity_ordered / buyQty) * getQty;
                  if (bonus > 0) bonusCount += bonus;
                  return {
                    ...item,
                    bonus_quantity: bonus > 0 ? bonus : item.bonus_quantity,
                  };
                }
                return item;
              });
            }
          } else if (ruleType === "buy_amt_get_gift") {
            const groupRevenue = matchedItems.reduce(
              (sum, item) => sum + item.quantity_ordered * item.unit_price,
              0
            );
            const minOrderVal = Number(rules.min_order_value || 0);
            if (groupRevenue >= minOrderVal) {
              const giftName = rules.gift_name || "Quà tặng khuyến mãi";
              newGifts.push({
                key: `AUTO_${Date.now()}_${Math.random()}`,
                name: giftName,
                code: "GIFT_AUTO",
                quantity: 1,
                estimated_value: 0,
                unit_name: "Cái",
              });
              giftCount++;
            }
          }
        });

        setCostingItems(updatedItems);
        if (newGifts.length > 0) {
          setGiftItems((prev) => [...prev, ...newGifts]);
        }

        const msgParts = [];
        if (rebateCount > 0)
          msgParts.push(`Giảm giá cho ${rebateCount} sản phẩm`);
        if (bonusCount > 0) msgParts.push(`Tặng ${bonusCount} hàng KM`);
        if (giftCount > 0) msgParts.push(`Thêm ${giftCount} quà tặng ngoài`);

        if (msgParts.length > 0) {
          message.success(`Đã áp dụng: ${msgParts.join(", ")}`);
        } else {
          message.info("Chưa đạt điều kiện của chương trình.");
        }
      } catch (err) {
        console.error(err);
        message.error("Lỗi áp dụng chương trình");
      } finally {
        setLoading(false);
      }
    },
    [costingItems]
  );

  // --- SUBMIT ---
  const handleSubmit = useCallback(async () => {
    if (!poId) return;
    setLoading(true);
    try {
      const productIds = [...new Set(costingItems.map((i) => i.product_id))];
      const oldData =
        await purchaseOrderService.getProductCostsSnapshot(productIds);
      setPreUpdateCosts(oldData || []);

      const payload = {
        p_po_id: Number(poId),
        p_total_shipping_fee: totalShippingFee,
        p_items_data: costingItems.map((item) => ({
          id: item.id,
          product_id: item.product_id,
          final_unit_cost: item.final_unit_cost, // RPC tự lookup conversion_rate từ DB
          rebate_rate: item.rebate_rate,
          vat_rate: item.vat_rate,
          quantity_received: item.quantity_ordered + item.bonus_quantity,
          bonus_quantity: item.bonus_quantity,
        })),
        p_gifts_data: giftItems.map((g) => ({
          name: g.name,
          code: g.code,
          quantity: g.quantity,
          estimated_value: g.estimated_value,
          image_url: g.image_url,
          unit_name: g.unit_name,
        })),
      };

      await purchaseOrderService.confirmCosting(payload);
      message.success("Xác nhận giá vốn thành công!");
      setShowPriceModal(true);
    } catch (err: any) {
      console.error(err);
      message.error("Lỗi: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [poId, costingItems, giftItems, totalShippingFee]);

  const handlePriceModalClose = useCallback(() => {
    setShowPriceModal(false);
    onComplete?.();
  }, [onComplete]);

  return {
    loading,
    costingItems,
    giftItems,
    totalShippingFee,
    setTotalShippingFee,
    selectedProgram,
    programOptions,
    showPriceModal,
    preUpdateCosts,
    calculateRow,
    handleAllocateShipping,
    handleItemChange,
    addGiftRow,
    removeGift,
    updateGift,
    handleProgramChange,
    handleSubmit,
    handlePriceModalClose,
  };
};

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { financeService } from '../api/financeService';

export interface PendingOrder {
  id: string;
  code: string;
  final_amount: number;
  paid_amount: number;
  created_at: string;
  need_to_collect: number;
}

export interface AllocatedOrder extends PendingOrder {
  allocated_amount: number;
  status_after: 'paid' | 'partial' | 'unpaid';
}

export const useBulkPaymentAllocation = (customerId?: number) => {
  const [loading, setLoading] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [totalReceived, setTotalReceived] = useState<number>(0);

  // Fetch pending orders
  useEffect(() => {
    if (!customerId) {
        setPendingOrders([]);
        setSelectedRowKeys([]);
        return;
    }
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const data = await financeService.getB2BPendingOrders(customerId);
        const orders = data.map((o: any) => ({
            ...o,
            need_to_collect: Number(o.final_amount) - Number(o.paid_amount || 0)
        }));
        setPendingOrders(orders);
        // Default: không tick gì cả cho đến khi nhập tiền
        setSelectedRowKeys([]);
      } catch (e) {
        console.error("Lỗi lấy danh sách nợ B2B:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [customerId]);

  // Waterfall Allocation (UseMemo for Performance)
  const allocatedOrders = useMemo(() => {
    let remainingAmount = totalReceived || 0;
    
    // Dùng Map để lookup nhanh gọn
    const orderMap = new Map<string, AllocatedOrder>(
        pendingOrders.map(o => [
            o.id, 
            { ...o, allocated_amount: 0, status_after: 'unpaid' }
        ])
    );

    // Lặp qua các đơn ĐƯỢC CHỌN (theo thứ tự cũ -> mới)
    for (const order of pendingOrders) {
      if (!selectedRowKeys.includes(order.id)) continue;
      
      const item = orderMap.get(order.id)!;
      if (remainingAmount <= 0) break; 

      if (remainingAmount >= item.need_to_collect) {
        item.allocated_amount = item.need_to_collect;
        item.status_after = 'paid';
        remainingAmount -= item.need_to_collect;
      } else {
        item.allocated_amount = remainingAmount;
        item.status_after = 'partial';
        remainingAmount = 0;
      }
    }

    // Trả về mảng để Table render
    return Array.from(orderMap.values());
  }, [pendingOrders, selectedRowKeys, totalReceived]);

  const totalAllocated = useMemo(() => {
    return allocatedOrders.reduce((sum, o) => sum + o.allocated_amount, 0);
  }, [allocatedOrders]);

  const remainingToAdvance = totalReceived > totalAllocated ? totalReceived - totalAllocated : 0;

  // Hàm tự động check theo số tiền (Auto-tick)
  const handleTotalReceivedChange = useCallback((amount: number) => {
      setTotalReceived(amount);
      
      let remain = amount || 0;
      const newKeys: React.Key[] = [];
      
      for (const order of pendingOrders) {
          if (remain <= 0) break;
          newKeys.push(order.id);
          // Cứ gán trọn vẹn need_to_collect để trừ, đến khi remain cạn thì thôi
          remain -= order.need_to_collect;
      }
      setSelectedRowKeys(newKeys);
  }, [pendingOrders]);

  const handleRowSelectionChange = useCallback((keys: React.Key[]) => {
      setSelectedRowKeys(keys);
  }, []);

  return {
    loading,
    pendingOrders,
    allocatedOrders,
    selectedRowKeys,
    handleRowSelectionChange,
    totalReceived,
    handleTotalReceivedChange,
    totalAllocated,
    remainingToAdvance
  };
};

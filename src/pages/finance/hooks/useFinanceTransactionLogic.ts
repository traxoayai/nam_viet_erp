// src/pages/finance/hooks/useFinanceTransactionLogic.ts
import { useState, useEffect } from "react";

import { useFinanceStore } from "@/stores/useFinanceStore";

export const useFinanceTransactionLogic = () => {
  const {
    transactions,
    funds,
    loading,
    totalCount,
    page,
    pageSize,
    fetchTransactions,
    fetchFunds,
    setFilters,
    setPage,
  } = useFinanceStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFlow, setModalFlow] = useState<"in" | "out">("in");

  useEffect(() => {
    fetchTransactions();
    fetchFunds();
  }, []);

  const openCreateModal = (flow: "in" | "out") => {
    setModalFlow(flow);
    setIsModalOpen(true);
  };

  // --- SỬA LỖI 2: Dùng 'balance' thay vì 'initial_balance' ---
  // Nếu balance null thì fallback về 0
  const totalBalance = funds.reduce(
    (sum, f) => sum + (Number(f.balance) || 0),
    0
  );

  return {
    transactions,
    funds,
    loading,
    totalCount,
    page,
    pageSize,
    setFilters,
    setPage,
    fetchTransactions,
    isModalOpen,
    setIsModalOpen,
    modalFlow,
    openCreateModal,
    totalBalance,
  };
};

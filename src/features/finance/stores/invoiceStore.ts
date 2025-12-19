// src/stores/invoiceStore.ts
import { create } from "zustand";

import { ScannedInvoiceResult } from "@/features/finance/types/invoiceTypes";

interface InvoiceState {
  isScanning: boolean;
  currentScanResult: ScannedInvoiceResult | null;

  // Actions
  setScanning: (loading: boolean) => void;
  setScanResult: (result: ScannedInvoiceResult | null) => void;
  clearScanResult: () => void;
}

export const useInvoiceStore = create<InvoiceState>((set) => ({
  isScanning: false,
  currentScanResult: null,

  setScanning: (loading) => set({ isScanning: loading }),
  setScanResult: (result) => set({ currentScanResult: result }),
  clearScanResult: () => set({ currentScanResult: null }),
}));

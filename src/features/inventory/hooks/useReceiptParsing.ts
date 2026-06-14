// src/features/inventory/hooks/useReceiptParsing.ts
import { useCallback, useState } from "react";
import {
  receiptParsingService,
  ParsedReceiptData,
} from "../api/receiptParsingService";

/**
 * Hook for managing receipt/invoice image upload and parsing
 * Handles file upload, base64 conversion, RPC call, and state management
 */
export interface UseReceiptParsingState {
  isLoading: boolean;
  isError: boolean;
  error?: string;
  parsedData?: ParsedReceiptData;
  fileName?: string;
}

export interface UseReceiptParsingActions {
  handleFileUpload: (file: File) => Promise<void>;
  reset: () => void;
  getParsedItems: () => ParsedReceiptData | undefined;
}

export type UseReceiptParsingReturn = UseReceiptParsingState &
  UseReceiptParsingActions;

/**
 * Convert File to base64 string
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:image/...;base64, prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Validate image file type
 */
const isValidImageFile = (file: File): boolean => {
  const validTypes = ["image/png", "image/jpeg", "image/jpg"];
  return validTypes.includes(file.type);
};

/**
 * Hook: useReceiptParsing
 * Usage:
 *   const {
 *     isLoading,
 *     isError,
 *     error,
 *     parsedData,
 *     handleFileUpload,
 *     reset,
 *   } = useReceiptParsing();
 *
 *   const handleUpload = async (file: File) => {
 *     await handleFileUpload(file);
 *     if (parsedData) {
 *       // Auto-fill form with parsedData
 *     }
 *   };
 */
export const useReceiptParsing = (): UseReceiptParsingReturn => {
  const [state, setState] = useState<UseReceiptParsingState>({
    isLoading: false,
    isError: false,
  });

  const handleFileUpload = useCallback(async (file: File) => {
    // Reset previous state
    setState({
      isLoading: true,
      isError: false,
    });

    try {
      // Validate file type
      if (!isValidImageFile(file)) {
        throw new Error(
          "Chỉ chấp nhận file ảnh PNG hoặc JPEG (max 10MB)"
        );
      }

      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error("File quá lớn. Vui lòng chọn file nhỏ hơn 10MB");
      }

      // Convert to base64
      const base64Data = await fileToBase64(file);

      // Call RPC to analyze receipt
      const response = await receiptParsingService.analyzeReceiptInvoice(
        base64Data,
        file.type
      );

      if (!response.success || !response.data) {
        throw new Error(
          response.error || "Không thể phân tích hóa đơn. Vui lòng thử lại."
        );
      }

      // Update state with parsed data
      setState({
        isLoading: false,
        isError: false,
        parsedData: response.data,
        fileName: file.name,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Lỗi không xác định khi phân tích hóa đơn";

      setState({
        isLoading: false,
        isError: true,
        error: errorMessage,
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      isError: false,
    });
  }, []);

  const getParsedItems = useCallback(() => {
    return state.parsedData;
  }, [state.parsedData]);

  return {
    ...state,
    handleFileUpload,
    reset,
    getParsedItems,
  };
};

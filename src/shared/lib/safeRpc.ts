import { message } from "antd";

import { supabase } from "@/shared/lib/supabaseClient";

interface SafeRpcOptions {
  /** Show toast on error. Default: false (opt-in to prevent double-toast) */
  toast?: boolean;
  /** Suppress ALL side effects (no toast, no redirect). For background queries. */
  silent?: boolean;
}

interface SafeRpcResult<T> {
  data: T | null;
  error: unknown;
}

/**
 * Centralized RPC wrapper with:
 * - Console logging on every error
 * - JWT expired → redirect to login
 * - Toast opt-in (NOT default) to prevent double-toast
 * - Vietnamese error translation
 * - Always throws on error for caller control flow
 */
export async function safeRpc<
  FunctionName extends string,
  Args = unknown,
  Returns = unknown,
>(
  fnName: FunctionName,
  params?: Args,
  options?: SafeRpcOptions
): Promise<SafeRpcResult<Returns>> {
  const { data, error } = await (supabase.rpc as any)(
    fnName,
    params as unknown
  );

  if (error) {
    console.error(`[RPC] ${fnName}:`, error);

    // Silent mode — no side effects at all
    if (options?.silent) {
      throw error;
    }

    // JWT expired → redirect to login
    if (error.code === "PGRST301" || error.message?.includes("JWT")) {
      message.error("Phiên hết hạn. Vui lòng đăng nhập lại.");
      window.location.href = "/auth/login";
      throw error;
    }

    // Toast ONLY when explicitly requested (opt-in)
    if (options?.toast) {
      message.error(translatePgError(error));
    }

    throw error;
  }

  return { data: data as unknown as Returns, error: null };
}

function translatePgError(error: unknown): string {
  const err = error as Record<string, unknown>;
  if (err.code === "P0001") return String(err.message); // DB message already Vietnamese
  if (err.code === "23505") return "Dữ liệu bị trùng lặp";
  if (err.code === "23503") return "Dữ liệu đang được sử dụng, không thể xóa";
  if (err.code === "42501") return "Không có quyền thực hiện thao tác này";
  return "Lỗi hệ thống: " + (String(err.message) || "Không xác định");
}

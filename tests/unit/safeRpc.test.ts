import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks (vitest hoists vi.mock to top)
const mockRpc = vi.fn();
const mockMessageError = vi.fn();

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

vi.mock("antd", () => ({
  message: { error: (...args: any[]) => mockMessageError(...args) },
}));

import { safeRpc } from "@/shared/lib/safeRpc";

describe("safeRpc", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockMessageError.mockReset();
    // Reset location
    delete (window as any).location;
    (window as any).location = { href: "http://localhost:5173" };
  });

  // --- HAPPY PATH ---
  it("returns data on success", async () => {
    mockRpc.mockResolvedValue({ data: [{ id: 1, name: "Kho A" }], error: null });
    const result = await safeRpc("get_active_warehouses");
    expect(result.data).toEqual([{ id: 1, name: "Kho A" }]);
    expect(result.error).toBeNull();
    expect(mockMessageError).not.toHaveBeenCalled();
  });

  it("passes params to supabase.rpc", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await safeRpc("get_purchase_orders_master", { p_page: 1, p_page_size: 12 });
    expect(mockRpc).toHaveBeenCalledWith("get_purchase_orders_master", {
      p_page: 1,
      p_page_size: 12,
    });
  });

  // --- ERROR: DOES NOT TOAST BY DEFAULT ---
  it("does NOT toast by default (backward compatible)", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "err" },
    });
    await expect(safeRpc("fn", {})).rejects.toThrow();
    expect(mockMessageError).not.toHaveBeenCalled();
  });

  // --- ERROR: TOASTS WHEN toast=true ---
  it("toasts Vietnamese message on P0001 when toast=true", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "Khong du ton kho" },
    });
    await expect(safeRpc("fn", {}, { toast: true })).rejects.toThrow();
    expect(mockMessageError).toHaveBeenCalledWith("Khong du ton kho");
  });

  it("toasts 'trung lap' on 23505", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "dup" },
    });
    await expect(safeRpc("fn", {}, { toast: true })).rejects.toThrow();
    expect(mockMessageError).toHaveBeenCalledWith("Dữ liệu bị trùng lặp");
  });

  it("toasts 'khong the xoa' on 23503", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "23503", message: "fk" },
    });
    await expect(safeRpc("fn", {}, { toast: true })).rejects.toThrow();
    expect(mockMessageError).toHaveBeenCalledWith(
      "Dữ liệu đang được sử dụng, không thể xóa"
    );
  });

  it("toasts 'khong co quyen' on 42501", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "denied" },
    });
    await expect(safeRpc("fn", {}, { toast: true })).rejects.toThrow();
    expect(mockMessageError).toHaveBeenCalledWith(
      "Không có quyền thực hiện thao tác này"
    );
  });

  it("toasts generic error for unknown codes", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "99999", message: "boom" },
    });
    await expect(safeRpc("fn", {}, { toast: true })).rejects.toThrow();
    expect(mockMessageError).toHaveBeenCalledWith("Lỗi hệ thống: boom");
  });

  // --- SILENT MODE ---
  it("does not toast when silent=true", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "err" },
    });
    await expect(safeRpc("fn", {}, { silent: true, toast: true })).rejects.toThrow();
    expect(mockMessageError).not.toHaveBeenCalled();
  });

  // --- JWT EXPIRED ---
  it("redirects to login on PGRST301", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST301", message: "JWT expired" },
    });
    await expect(safeRpc("fn")).rejects.toThrow();
    expect(mockMessageError).toHaveBeenCalledWith(
      "Phiên hết hạn. Vui lòng đăng nhập lại."
    );
    expect(window.location.href).toContain("/auth/login");
  });

  it("redirects on JWT keyword in message", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "other", message: "JWT token is not valid" },
    });
    await expect(safeRpc("fn")).rejects.toThrow();
    expect(window.location.href).toContain("/auth/login");
  });

  // --- ALWAYS THROWS ---
  it("always throws on error", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "err" },
    });
    let caught = false;
    try {
      await safeRpc("fn");
    } catch {
      caught = true;
    }
    expect(caught).toBe(true);
  });

  // --- CONSOLE LOG ---
  it("logs error to console", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "test" },
    });
    await expect(safeRpc("my_rpc")).rejects.toThrow();
    expect(spy).toHaveBeenCalledWith(
      "[RPC] my_rpc:",
      expect.objectContaining({ code: "P0001" })
    );
    spy.mockRestore();
  });
});

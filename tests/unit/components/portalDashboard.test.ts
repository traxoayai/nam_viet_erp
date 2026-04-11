import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSafeRpc = vi.fn();

vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));

describe("Portal Dashboard RPC", () => {
  beforeEach(() => {
    mockSafeRpc.mockReset();
  });

  it("calls get_portal_dashboard_stats with no params", async () => {
    mockSafeRpc.mockResolvedValue({
      data: {
        pending_registrations: 3,
        orders_today: 5,
        orders_this_week: 12,
        revenue_this_month: 25000000,
        daily_orders: [],
      },
    });

    const { safeRpc } = await import("@/shared/lib/safeRpc");
    const { data } = await safeRpc("get_portal_dashboard_stats");

    expect(mockSafeRpc).toHaveBeenCalledWith("get_portal_dashboard_stats");
    expect(data).toMatchObject({
      pending_registrations: 3,
      orders_today: 5,
      orders_this_week: 12,
      revenue_this_month: 25000000,
    });
  });

  it("returns daily_orders as array of {date, count}", async () => {
    const dailyOrders = [
      { date: "2026-04-10", count: 2 },
      { date: "2026-04-11", count: 5 },
    ];
    mockSafeRpc.mockResolvedValue({
      data: {
        pending_registrations: 0,
        orders_today: 0,
        orders_this_week: 0,
        revenue_this_month: 0,
        daily_orders: dailyOrders,
      },
    });

    const { safeRpc } = await import("@/shared/lib/safeRpc");
    const { data } = await safeRpc("get_portal_dashboard_stats");
    const stats = data as any;

    expect(stats.daily_orders).toHaveLength(2);
    expect(stats.daily_orders[0]).toHaveProperty("date");
    expect(stats.daily_orders[0]).toHaveProperty("count");
  });
});

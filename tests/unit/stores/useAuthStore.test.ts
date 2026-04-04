import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks (available inside vi.mock factories) ---
const { mockSafeRpc, mockGetUser, mockOnAuthStateChange, mockGetSelfProfile } =
  vi.hoisted(() => ({
    mockSafeRpc: vi.fn(),
    mockGetUser: vi.fn(),
    mockOnAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
    mockGetSelfProfile: vi.fn(),
  }));

vi.mock("@/shared/lib/safeRpc", () => ({
  safeRpc: (...args: any[]) => mockSafeRpc(...args),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
      onAuthStateChange: (...args: any[]) => mockOnAuthStateChange(...args),
    },
  },
}));

vi.mock("@/features/auth/api/authService", () => ({
  getSelfProfile: () => mockGetSelfProfile(),
  checkUserSession: vi.fn().mockResolvedValue(null),
  login: vi.fn().mockResolvedValue({ user: null }),
  logout: vi.fn().mockResolvedValue(null),
  updateSelfPassword: vi.fn().mockResolvedValue(null),
  updateSelfProfile: vi.fn().mockResolvedValue(null),
}));

// --- Import store AFTER mocks ---
import { useAuthStore } from "@/features/auth/stores/useAuthStore";

describe("useAuthStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      profile: null,
      permissions: [],
      loading: true,
      isLoadingProfile: true,
    });
  });

  describe("fetchProfile - permissions loading", () => {
    it("calls safeRpc with 'get_my_permissions' when user exists", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
      mockGetSelfProfile.mockResolvedValue({ id: "u1", name: "Test User" });
      mockSafeRpc.mockResolvedValue({ data: [{ permission: "orders.read" }] });

      await useAuthStore.getState().fetchProfile();

      expect(mockSafeRpc).toHaveBeenCalledWith(
        "get_my_permissions",
        undefined,
        { silent: true }
      );
    });

    it("stores permissions returned from safeRpc", async () => {
      const permsData = [
        { permission: "orders.read" },
        { permission: "orders.write" },
        { permission: "finance.view" },
      ];
      mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
      mockGetSelfProfile.mockResolvedValue({ id: "u1", name: "Test" });
      mockSafeRpc.mockResolvedValue({ data: permsData });

      await useAuthStore.getState().fetchProfile();

      const state = useAuthStore.getState();
      expect(state.permissions).toEqual(permsData);
    });

    it("defaults to empty permissions when safeRpc returns null data", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
      mockGetSelfProfile.mockResolvedValue({ id: "u1", name: "Test" });
      mockSafeRpc.mockResolvedValue({ data: null });

      await useAuthStore.getState().fetchProfile();

      const state = useAuthStore.getState();
      expect(state.permissions).toEqual([]);
    });

    it("defaults to empty permissions when safeRpc throws", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
      mockGetSelfProfile.mockResolvedValue({ id: "u1", name: "Test" });
      mockSafeRpc.mockRejectedValue(new Error("RPC error"));

      await useAuthStore.getState().fetchProfile();

      const state = useAuthStore.getState();
      expect(state.permissions).toEqual([]);
    });

    it("does not call safeRpc when no user session exists", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      await useAuthStore.getState().fetchProfile();

      expect(mockSafeRpc).not.toHaveBeenCalled();
      const state = useAuthStore.getState();
      expect(state.permissions).toEqual([]);
      expect(state.profile).toBeNull();
    });

    it("sets isLoadingProfile to false after completion", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
      mockGetSelfProfile.mockResolvedValue({ id: "u1", name: "Test" });
      mockSafeRpc.mockResolvedValue({ data: [] });

      await useAuthStore.getState().fetchProfile();

      expect(useAuthStore.getState().isLoadingProfile).toBe(false);
    });

    it("sets profile from authService.getSelfProfile", async () => {
      const profile = { id: "u1", name: "Nguyen Van A", role: "admin" };
      mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
      mockGetSelfProfile.mockResolvedValue(profile);
      mockSafeRpc.mockResolvedValue({ data: [] });

      await useAuthStore.getState().fetchProfile();

      expect(useAuthStore.getState().profile).toEqual(profile);
    });
  });
});

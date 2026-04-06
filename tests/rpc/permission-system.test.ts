import { describe, it, expect, beforeAll } from "vitest";
import { adminClient } from "../helpers/supabase";
import { seedRpcAccessRules } from "../helpers/seedRpcAccessRules";

describe("Permission & Rate Limit System", () => {
  beforeAll(() => seedRpcAccessRules());

  // === rpc_access_rules table ===
  describe("rpc_access_rules", () => {
    it("has rules for critical write RPCs", async () => {
      const criticalFunctions = [
        "approve_user",
        "create_sales_order",
        "delete_purchase_order",
        "delete_invoice_atomic",
        "create_finance_transaction",
        "deduct_vat_for_pos_export",
        "batch_deduct_vat_for_pos",
        "process_vat_export_entry",
      ];

      const { data, error } = await adminClient
        .from("rpc_access_rules")
        .select("function_name, is_write")
        .in("function_name", criticalFunctions);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(7);

      // All should be marked as write operations
      for (const rule of data!) {
        expect(rule.is_write).toBe(true);
      }
    });

    it("approve_user requires settings.permissions", async () => {
      const { data } = await adminClient
        .from("rpc_access_rules")
        .select("required_permission")
        .eq("function_name", "approve_user")
        .single();

      expect(data?.required_permission).toBe("settings.permissions");
    });

    it("create_sales_order has no specific permission (any authenticated)", async () => {
      const { data } = await adminClient
        .from("rpc_access_rules")
        .select("required_permission, max_calls_per_minute")
        .eq("function_name", "create_sales_order")
        .single();

      expect(data?.required_permission).toBeNull();
      expect(data?.max_calls_per_minute).toBe(60);
    });
  });

  // === user_has_permission helper ===
  describe("user_has_permission", () => {
    it("returns false when called without auth context", async () => {
      const { data } = await adminClient.rpc("user_has_permission", {
        p_permission: "admin-all",
      });
      // service_role has no auth.uid(), so returns false
      expect(data).toBe(false);
    });
  });

  // === _log_rpc_call audit logging ===
  describe("_log_rpc_call", () => {
    it("inserts audit log entry", async () => {
      await adminClient.rpc("_log_rpc_call", {
        p_module: "test",
        p_action: "vitest_audit_check",
        p_data: { ref_id: "test-123" },
      });

      const { data } = await adminClient
        .from("system_logs")
        .select("module, action, record_id")
        .eq("action", "vitest_audit_check")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      expect(data?.module).toBe("test");
      expect(data?.record_id).toBe("test-123");
    });
  });
});

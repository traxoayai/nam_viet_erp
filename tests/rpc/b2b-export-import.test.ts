/**
 * Integration tests cho B2B Export/Import Excel
 *
 * Fix 1: export_customers_b2b_list — ambiguous overload (PGRST203)
 * Fix 2: bulk_upsert_customers_b2b — vat_address/shipping_address luôn NULL
 */
import { describe, it, expect } from "vitest";
import { adminClient } from "../helpers/supabase";

// ─── 1. export_customers_b2b_list — Không còn ambiguous overload ────────────

describe("export_customers_b2b_list", () => {
  it("không lỗi ambiguous overload (PGRST203) với null filters", async () => {
    const { error } = await adminClient.rpc("export_customers_b2b_list", {
      search_query: null,
      sales_staff_filter: null,
      status_filter: null,
    });
    // PGRST203 = ambiguous function — root cause của bug
    if (error) {
      expect(error.code).not.toBe("PGRST203");
    }
  });

  it("không lỗi ambiguous overload với empty string search", async () => {
    const { error } = await adminClient.rpc("export_customers_b2b_list", {
      search_query: "",
      sales_staff_filter: null,
      status_filter: null,
    });
    if (error) {
      expect(error.code).not.toBe("PGRST203");
    }
  });

  it("không lỗi ambiguous overload với status_filter empty string", async () => {
    const { error } = await adminClient.rpc("export_customers_b2b_list", {
      search_query: null,
      sales_staff_filter: null,
      status_filter: "",
    });
    if (error) {
      expect(error.code).not.toBe("PGRST203");
    }
  });

  it("trả về data khi bảng có dữ liệu", async () => {
    const { count } = await adminClient
      .from("customers_b2b")
      .select("*", { count: "exact", head: true });

    if (!count || count === 0) return; // skip nếu bảng trống

    const { data, error } = await adminClient.rpc(
      "export_customers_b2b_list",
      {
        search_query: null,
        sales_staff_filter: null,
        status_filter: null,
      }
    );
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect((data as unknown[]).length).toBeGreaterThan(0);
  });

  it("trả về đúng cấu trúc cột cho Excel export", async () => {
    const { data, error } = await adminClient.rpc(
      "export_customers_b2b_list",
      {
        search_query: null,
        sales_staff_filter: null,
        status_filter: null,
      }
    );

    if (error || !data || (data as unknown[]).length === 0) return;

    const row = (data as Record<string, unknown>[])[0];
    const expectedColumns = [
      "id",
      "customer_code",
      "name",
      "phone",
      "email",
      "tax_code",
      "vat_address",
      "shipping_address",
      "sales_staff_name",
      "debt_limit",
      "payment_term",
      "status",
    ];
    for (const col of expectedColumns) {
      expect(row).toHaveProperty(col);
    }
  });

  it("lọc theo status_filter hoạt động", async () => {
    const { data, error } = await adminClient.rpc(
      "export_customers_b2b_list",
      {
        search_query: null,
        sales_staff_filter: null,
        status_filter: "active",
      }
    );
    expect(error).toBeNull();
    if (data && (data as unknown[]).length > 0) {
      for (const row of data as Record<string, unknown>[]) {
        expect(row.status).toBe("active");
      }
    }
  });
});

// ─── 2. bulk_upsert_customers_b2b — Import address fields ──────────────────

describe("bulk_upsert_customers_b2b", () => {
  const TEST_CODE = "TEST-INT-ADDR-001";

  // Cleanup sau mỗi test
  async function cleanupTestCustomer() {
    // Xóa orders liên quan trước (FK constraint)
    await adminClient
      .from("orders")
      .delete()
      .eq("code", `DEBT-INIT-${TEST_CODE}`);
    // Xóa contacts
    const { data: customer } = await adminClient
      .from("customers_b2b")
      .select("id")
      .eq("customer_code", TEST_CODE)
      .maybeSingle();
    if (customer) {
      await adminClient
        .from("customer_b2b_contacts")
        .delete()
        .eq("customer_b2b_id", customer.id);
    }
    // Xóa customer
    await adminClient
      .from("customers_b2b")
      .delete()
      .eq("customer_code", TEST_CODE);
  }

  it("lưu đúng vat_address và shipping_address từ import", async () => {
    await cleanupTestCustomer();

    const testCustomer = {
      customer_code: TEST_CODE,
      name: "Test Import Address Corp",
      phone: "0999888777",
      vat_address: "123 Nguyễn Huệ, Q1, HCM",
      shipping_address: "456 Lê Lợi, Q3, HCM",
    };

    const { error } = await adminClient.rpc("bulk_upsert_customers_b2b", {
      p_customers_array: [testCustomer],
    });
    expect(error).toBeNull();

    // Verify dữ liệu đã lưu đúng
    const { data: saved } = await adminClient
      .from("customers_b2b")
      .select("vat_address, shipping_address")
      .eq("customer_code", TEST_CODE)
      .single();

    expect(saved).not.toBeNull();
    expect(saved!.vat_address).toBe("123 Nguyễn Huệ, Q1, HCM");
    expect(saved!.shipping_address).toBe("456 Lê Lợi, Q3, HCM");

    await cleanupTestCustomer();
  });

  it("lưu đúng bank info từ import", async () => {
    await cleanupTestCustomer();

    const testCustomer = {
      customer_code: TEST_CODE,
      name: "Test Import Bank Corp",
      phone: "0999888666",
      bank_name: "Vietcombank",
      bank_account_number: "1234567890",
      bank_account_name: "CONG TY TEST",
    };

    const { error } = await adminClient.rpc("bulk_upsert_customers_b2b", {
      p_customers_array: [testCustomer],
    });
    expect(error).toBeNull();

    const { data: saved } = await adminClient
      .from("customers_b2b")
      .select("bank_name, bank_account_number, bank_account_name")
      .eq("customer_code", TEST_CODE)
      .single();

    expect(saved).not.toBeNull();
    expect(saved!.bank_name).toBe("Vietcombank");
    expect(saved!.bank_account_number).toBe("1234567890");
    expect(saved!.bank_account_name).toBe("CONG TY TEST");

    await cleanupTestCustomer();
  });

  it("upsert cập nhật address khi import lại", async () => {
    await cleanupTestCustomer();

    // Insert lần 1
    await adminClient.rpc("bulk_upsert_customers_b2b", {
      p_customers_array: [
        {
          customer_code: TEST_CODE,
          name: "Test Upsert Corp",
          phone: "0999888555",
          vat_address: "Địa chỉ cũ",
          shipping_address: "Kho cũ",
        },
      ],
    });

    // Import lại với address mới
    const { error } = await adminClient.rpc("bulk_upsert_customers_b2b", {
      p_customers_array: [
        {
          customer_code: TEST_CODE,
          name: "Test Upsert Corp Updated",
          phone: "0999888555",
          vat_address: "Địa chỉ mới 2026",
          shipping_address: "Kho mới 2026",
        },
      ],
    });
    expect(error).toBeNull();

    const { data: saved } = await adminClient
      .from("customers_b2b")
      .select("name, vat_address, shipping_address")
      .eq("customer_code", TEST_CODE)
      .single();

    expect(saved!.name).toBe("Test Upsert Corp Updated");
    expect(saved!.vat_address).toBe("Địa chỉ mới 2026");
    expect(saved!.shipping_address).toBe("Kho mới 2026");

    await cleanupTestCustomer();
  });

  it("xử lý nợ đầu kỳ khi import", async () => {
    await cleanupTestCustomer();

    const { error } = await adminClient.rpc("bulk_upsert_customers_b2b", {
      p_customers_array: [
        {
          customer_code: TEST_CODE,
          name: "Test Debt Corp",
          phone: "0999888444",
          initial_debt: 5000000,
        },
      ],
    });
    expect(error).toBeNull();

    // Verify order nợ đầu kỳ được tạo
    const { data: order } = await adminClient
      .from("orders")
      .select("total_amount, final_amount, payment_status, note")
      .eq("code", `DEBT-INIT-${TEST_CODE}`)
      .maybeSingle();

    expect(order).not.toBeNull();
    expect(Number(order!.total_amount)).toBe(5000000);
    expect(order!.payment_status).toBe("unpaid");

    await cleanupTestCustomer();
  });
});

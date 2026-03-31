import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Verify that component files use safeRpc (centralized RPC wrapper)
 * and do NOT call supabase.rpc() directly.
 *
 * This is a static analysis test - it reads file contents and checks
 * for the correct import pattern without needing to render components.
 */

const COMPONENT_FILES = [
  {
    name: "DoctorPrescriptionSearch",
    path: "src/features/medical/components/DoctorPrescriptionSearch.tsx",
  },
  {
    name: "PosSearchInput",
    path: "src/features/pos/components/PosSearchInput.tsx",
  },
  {
    name: "VatInvoiceModal",
    path: "src/features/pos/components/modals/VatInvoiceModal.tsx",
  },
  {
    name: "BarcodeAssignModal",
    path: "src/features/product/components/BarcodeAssignModal.tsx",
  },
  {
    name: "NotificationBell",
    path: "src/features/notifications/components/NotificationBell.tsx",
  },
  {
    name: "CreateTaskModal",
    path: "src/features/tasks/components/CreateTaskModal.tsx",
  },
  {
    name: "SellPackageDrawer",
    path: "src/features/medical/components/reception/SellPackageDrawer.tsx",
  },
];

describe("Component files use safeRpc (not supabase.rpc)", () => {
  for (const file of COMPONENT_FILES) {
    describe(file.name, () => {
      const filePath = path.resolve(file.path);
      let content: string;

      try {
        content = fs.readFileSync(filePath, "utf-8");
      } catch {
        content = "";
      }

      it(`${file.name} file exists and is readable`, () => {
        expect(content.length).toBeGreaterThan(0);
      });

      it(`${file.name} imports safeRpc`, () => {
        expect(content).toContain("safeRpc");
      });

      it(`${file.name} does NOT use supabase.rpc() directly`, () => {
        // Check that there are no direct supabase.rpc( calls
        expect(content).not.toMatch(/supabase\.rpc\(/);
      });
    });
  }
});

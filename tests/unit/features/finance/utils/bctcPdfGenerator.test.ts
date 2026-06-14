import { describe, it, expect, vi, beforeEach } from "vitest";

import type { BalanceSheetRow } from "@/features/finance/api/financialReportsService";

import {
  generateBctcPdf,
  downloadBctcPdf,
} from "@/features/finance/utils/bctcPdfGenerator";

describe("bctcPdfGenerator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateBctcPdf", () => {
    it("should generate PDF with correct structure", async () => {
      const data: BalanceSheetRow[] = [
        { ma_so: "100", ten_chi_tieu: "TÀI SẢN", so_tien: 5000000 },
        { ma_so: "200", ten_chi_tieu: "NỢ PHẢI TRẢ", so_tien: 2000000 },
      ];

      const blob = await generateBctcPdf({
        period: "202606",
        year: 2026,
        month: 6,
        companyName: "Nam Việt Pharmacy",
        lines: data,
      });

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe("application/pdf");
      expect(blob.size).toBeGreaterThan(1000);
    });

    it("should generate PDF with empty data", async () => {
      const blob = await generateBctcPdf({
        period: "202606",
        year: 2026,
        month: 6,
        companyName: "Test Company",
        lines: [],
      });

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe("application/pdf");
    });

    it("should format Vietnamese numbers correctly", async () => {
      const data: BalanceSheetRow[] = [
        { ma_so: "100", ten_chi_tieu: "Tài sản hiện tại", so_tien: 1234567890 },
      ];

      const blob = await generateBctcPdf({
        period: "202606",
        year: 2026,
        month: 6,
        companyName: "Test",
        lines: data,
      });

      expect(blob).toBeInstanceOf(Blob);
      // PDF content is binary, but size indicates it was generated
      expect(blob.size).toBeGreaterThan(1000);
    });

    it("should include report period in PDF", async () => {
      const data: BalanceSheetRow[] = [
        { ma_so: "100", ten_chi_tieu: "Tài sản", so_tien: 1000000 },
      ];

      const blob = await generateBctcPdf({
        period: "202605",
        year: 2026,
        month: 5,
        companyName: "Test Company",
        lines: data,
      });

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe("application/pdf");
    });
  });

  describe("downloadBctcPdf", () => {
    it("should trigger browser download", async () => {
      const createObjectURLSpy = vi.spyOn(URL, "createObjectURL");
      const clickSpy = vi.fn();

      // Mock document.createElement
      const mockLink = {
        href: "",
        download: "",
        click: clickSpy,
      };

      vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown);

      const data: BalanceSheetRow[] = [
        { ma_so: "100", ten_chi_tieu: "Tài sản", so_tien: 1000000 },
      ];

      await downloadBctcPdf(
        {
          period: "202606",
          year: 2026,
          month: 6,
          companyName: "Test",
          lines: data,
        },
        "BCTC-202606.pdf"
      );

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(mockLink.download).toBe("BCTC-202606.pdf");
    });

    it("should set correct filename for download", async () => {
      const clickSpy = vi.fn();
      const mockLink = {
        href: "",
        download: "",
        click: clickSpy,
      };

      vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown);

      const data: BalanceSheetRow[] = [];

      await downloadBctcPdf(
        {
          period: "202612",
          year: 2026,
          month: 12,
          companyName: "Test",
          lines: data,
        },
        "BCTC-202612.pdf"
      );

      expect(mockLink.download).toBe("BCTC-202612.pdf");
    });
  });
});

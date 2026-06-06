// src/features/finance/hooks/useInvoiceVerifyLogic.ts
import { App, Form } from "antd";
import dayjs from "dayjs";
import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";

import { invoiceService } from "../api/invoiceService";

import type {
  ParsedInvoiceHeader,
  ParsedInvoiceItem,
} from "../utils/xmlParser";
import type { Json } from "@/shared/types/database.types";

import { useProductStore } from "@/features/product/stores/productStore";
import { supabase } from "@/shared/lib/supabaseClient";
import { calcInvoiceTotals } from "@/shared/utils/money";

/**
 * Dòng hàng thô đọc từ XML (ParsedInvoiceItem) + các trường gợi ý mapping
 * (match_type, internal_product_id, internal_unit) gắn thêm khi đối chiếu.
 */
type XmlRawItem = Partial<ParsedInvoiceItem> & {
  match_type?: "exact" | "prediction" | string;
  internal_product_id?: number;
  internal_unit?: string;
};

/** Dòng hàng trong form đối chiếu hóa đơn VAT (có thêm trường chiết khấu chuẩn VAS). */
interface InvoiceFormItem {
  key?: number;
  name?: string;
  product_name?: string;
  quantity?: number;
  unit_price?: number;
  vat_rate?: number;
  internal_unit?: string | null;
  unit?: string;
  product_id?: number | string | null;
  expiry_date?: dayjs.Dayjs | string | null;
  xml_unit?: string;
  xml_quantity?: number;
  xml_unit_price?: number;
  discount_rate?: number;
  discount_amount?: number;
  amount_before_tax?: number;
  [extra: string]: unknown;
}

/** Dòng XML đã parse + gợi ý mapping nội bộ (đính khi tạo router state). */
type RouterXmlItem = ParsedInvoiceItem & {
  internal_product_id?: number;
  internal_unit?: string;
  match_type?: "exact" | "prediction" | string;
};

/** Dữ liệu XML đã parse, kèm fileUrl (đính khi điều hướng tới trang đối chiếu). */
interface RouterXmlData {
  header: ParsedInvoiceHeader;
  items: RouterXmlItem[];
  fileUrl?: string;
  [extra: string]: unknown;
}

/** location.state truyền vào trang đối chiếu hóa đơn (react-router). */
interface RouterState {
  source?: string;
  direction?: string;
  returnTo?: string;
  xmlData?: RouterXmlData;
  data?: unknown;
  [extra: string]: unknown;
}

/** Toàn bộ giá trị của Form đối chiếu hóa đơn (AntD getFieldsValue). */
interface InvoiceFormValues {
  supplier_id?: number | string | null;
  invoice_number?: string;
  invoice_symbol?: string;
  invoice_date?: dayjs.Dayjs | string | null;
  buyer_tax_code?: string;
  items?: InvoiceFormItem[];
  total_fee_amount?: number;
  [extra: string]: unknown;
}

export const useInvoiceVerifyLogic = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const [form] = Form.useForm();

  const routerState = (location.state ?? null) as RouterState | null;

  // Get returnTo and poId from URL search params as fallback
  const searchParams = new URLSearchParams(location.search);
  const returnTo =
    routerState?.returnTo || searchParams.get("returnTo") || null;
  const linkedPoId = searchParams.get("poId") || null;

  const { suppliers, products, fetchCommonData } = useProductStore();

  const [loading, setLoading] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isXmlSource, setIsXmlSource] = useState(false);
  const [xmlRawItems, setXmlRawItems] = useState<XmlRawItem[]>([]);

  // Tính totals chuẩn VAS: items có discount_amount/discount_rate/amount_before_tax,
  // cộng phí (total_fee_amount nhập tay) — phí tách riêng, không vào total thanh toán.
  const computeTotals = (items: unknown[] = []) => {
    const totalFee = Number(form.getFieldValue("total_fee_amount")) || 0;
    return calcInvoiceTotals(items as Parameters<typeof calcInvoiceTotals>[0], {
      totalFee,
    });
  };

  // --- ACTIONS ---
  const handleRecalculate = () => {
    const items = form.getFieldValue("items") || [];
    const totals = computeTotals(items);
    form.setFieldsValue({
      total_goods_amount: totals.totalGoods,
      total_discount_amount: totals.totalDiscount,
      total_amount_pre_tax: totals.totalPreTax,
      tax_amount: totals.totalTax,
      total_amount_post_tax: totals.final,
    });
  };

  const loadInvoiceFromDB = async (invoiceId: number) => {
    try {
      setLoading(true);
      const record = await invoiceService.getInvoiceById(invoiceId);
      if (record) {
        if (record.status !== "draft") setIsReadOnly(true);

        form.setFieldsValue({
          invoice_number: record.invoice_number,
          invoice_symbol: record.invoice_symbol,
          invoice_date: record.invoice_date ? dayjs(record.invoice_date) : null,
          supplier_id: record.supplier_id,
          total_fee_amount:
            (record as { total_fee_amount?: number | null }).total_fee_amount ||
            0,
          total_amount_post_tax: record.total_amount_post_tax,
          items: ((record.items_json as InvoiceFormItem[] | null) || []).map(
            (item: InvoiceFormItem, idx: number) => ({
              ...item,
              key: idx,
              expiry_date: item.expiry_date ? dayjs(item.expiry_date) : null,
              // [FIX] Restore base price & qty for unit conversion logic
              xml_unit_price: item.xml_unit_price || item.unit_price,
              xml_quantity: item.xml_quantity || item.quantity,
            })
          ),
        });
        handleRecalculate();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values: InvoiceFormValues) => {
    if (isReadOnly) return;
    setLoading(true);

    try {
      // 1. VỆ SINH DỮ LIỆU (DATA SANITIZATION)
      let safeSupplierId = values.supplier_id
        ? Number(values.supplier_id)
        : null;
      if (typeof safeSupplierId === "number" && isNaN(safeSupplierId)) {
        safeSupplierId = null;
      }

      if (!safeSupplierId) {
        message.error("Lỗi: Chưa chọn Nhà Cung Cấp hợp lệ.");
        setLoading(false);
        return;
      }

      // 2. AUTO LEARN MAPPING
      if (isXmlSource) {
        const supplierTax = (
          suppliers.find((s) => s.id === safeSupplierId) as
            | { tax_code?: string }
            | undefined
        )?.tax_code;
        if (supplierTax) {
          // Gom UNIQUE theo (tên NCC + ĐVT NCC) TRƯỚC khi gọi. Một hóa đơn XML
          // có thể có nhiều dòng cùng tên + cùng đơn vị (vd tách dòng do khác
          // lô/HSD). Nếu bắn UPSERT song song cùng key vào vendor_product_mappings
          // sẽ gây race-condition (trùng key, có thể lỗi). Dedup → mỗi key 1 lần,
          // last-wins nếu cùng key nhưng map khác sản phẩm.
          interface PendingMapping {
            originalName: string;
            originalUnit: string | null;
            selectedId: number;
            selectedUnit: string;
          }
          const uniqueMappings = new Map<string, PendingMapping>();

          values.items!.forEach((item: InvoiceFormItem, index: number) => {
            const originalName = xmlRawItems[index]?.name;
            const originalUnit = xmlRawItems[index]?.unit;

            // Ép kiểu ID sản phẩm, nếu lỗi -> 0
            let selectedId = item.product_id ? Number(item.product_id) : 0;
            if (isNaN(selectedId)) selectedId = 0;

            const selectedUnit = item.internal_unit;

            if (originalName && selectedId > 0 && selectedUnit) {
              const key = `${originalName}|||${originalUnit || ""}`;
              uniqueMappings.set(key, {
                originalName,
                originalUnit: originalUnit || null,
                selectedId,
                selectedUnit,
              });
            }
          });

          await Promise.all(
            Array.from(uniqueMappings.values()).map((m) =>
              invoiceService.saveProductMapping(
                supplierTax,
                m.originalName,
                m.originalUnit || "",
                m.selectedId,
                m.selectedUnit
              )
            )
          );
        }
      }

      // 3. CHUẨN BỊ PAYLOAD (CẬP NHẬT MỚI)
      const totals = computeTotals(values.items ?? []);
      const xmlFileUrl = isXmlSource ? routerState?.xmlData?.fileUrl : null;

      // [FIX] Lấy thông tin Raw từ XML Header
      const xmlHeader = (
        isXmlSource ? routerState?.xmlData?.header : {}
      ) as Partial<ParsedInvoiceHeader>;

      const payload = {
        invoice_number: values.invoice_number || "Unknown",
        invoice_symbol: values.invoice_symbol || "",
        invoice_date: values.invoice_date
          ? dayjs(values.invoice_date).format("YYYY-MM-DD")
          : dayjs().format("YYYY-MM-DD"),
        supplier_id: safeSupplierId,

        file_url: isXmlSource
          ? xmlFileUrl || "no_file_uploaded_error"
          : undefined,

        // [NEW] Bổ sung các trường Raw để hiển thị ngoài danh sách
        supplier_name_raw: (xmlHeader.supplier_name || null) as
          | string
          | undefined,
        supplier_tax_code: (xmlHeader.supplier_tax_code || null) as
          | string
          | undefined,
        supplier_address_raw: xmlHeader.supplier_address || null,
        parsed_data: (isXmlSource ? routerState?.xmlData : null) as
          | Json
          | undefined, // Lưu lại toàn bộ cục JSON XML để sau này debug

        // [VAS] tổng theo chuẩn kế toán VN
        total_goods_amount: totals.totalGoods,
        total_discount_amount: totals.totalDiscount,
        total_fee_amount: totals.totalFee,
        total_amount_pre_tax: totals.totalPreTax,
        tax_amount: totals.totalTax,
        total_amount_post_tax: totals.final,

        items_json: values.items!.map((item: InvoiceFormItem) => {
          let pId = item.product_id ? Number(item.product_id) : null;
          if (typeof pId === "number" && isNaN(pId)) pId = null;

          return {
            ...item,
            product_id: pId,
            internal_unit: item.internal_unit || null,
            expiry_date: item.expiry_date
              ? dayjs(item.expiry_date).format("YYYY-MM-DD")
              : null,
          };
        }),
      };

      // 4. PHÂN LUỒNG: OUTBOUND vs INBOUND
      const direction = routerState?.direction;

      if (direction === "outbound") {
        // --- OUTBOUND: Tạo hóa đơn xuất kho (trừ VAT) ---
        const outboundPayload = {
          invoice_number: payload.invoice_number,
          invoice_symbol: payload.invoice_symbol,
          invoice_date: payload.invoice_date,
          supplier_name_raw: payload.supplier_name_raw,
          buyer_tax_code: values.buyer_tax_code || "",
          total_amount_pre_tax: totals.totalPreTax,
          total_tax: totals.totalTax,
          total_amount_post_tax: totals.final,
          items: (values.items || []).map((item: InvoiceFormItem) => ({
            product_id: item.product_id ? Number(item.product_id) : null,
            product_name: item.product_name || item.name,
            unit: item.internal_unit || item.unit,
            quantity: Number(item.quantity) || 0,
            unit_price: Number(item.unit_price) || 0,
            vat_rate: Number(item.vat_rate) || 0,
          })),
        };
        await invoiceService.createOutboundInvoice(outboundPayload);
        message.success("Da xuat kho VAT thanh cong!");
      } else {
        // --- INBOUND: Flow cũ (tạo mới / cập nhật) ---
        if (!id || id === "new-xml") {
          // Tạo mới (từ XML hoặc manual) → create draft rồi verify luôn
          const result = await invoiceService.createInvoice(payload);
          const newInvoiceId = (result as { id?: number } | null)?.id;

          // Auto-link to PO if poId provided
          if (linkedPoId && newInvoiceId) {
            await supabase.from("finance_invoice_allocations").insert({
              invoice_id: newInvoiceId,
              po_id: Number(linkedPoId),
              allocated_amount: totals.final,
            });
          }

          // Verify ngay (trigger processVatEntry để nhập kho VAT)
          if (newInvoiceId) {
            await invoiceService.verifyInvoice(newInvoiceId, payload);
          }

          message.success("Đã tạo và nhập kho VAT thành công!");
        } else {
          // Update existing invoice
          await invoiceService.verifyInvoice(Number(id), payload);
          message.success("Đã cập nhật hóa đơn!");
        }
      }

      navigate(returnTo || "/finance/invoices");
    } catch (error) {
      console.error(error);
      message.error("Lỗi: " + (error as { message?: string })?.message);
    } finally {
      setLoading(false);
    }
  };

  const onSaveDraft = async (values: InvoiceFormValues) => {
    if (isReadOnly) {
      message.warning("Hóa đơn đã được xác nhận, không thể lưu nháp.");
      return;
    }
    setLoading(true);
    try {
      const totals = computeTotals(values.items ?? []);
      let safeSupplierId = values.supplier_id
        ? Number(values.supplier_id)
        : null;
      if (typeof safeSupplierId === "number" && isNaN(safeSupplierId))
        safeSupplierId = null;

      const xmlFileUrl = isXmlSource ? routerState?.xmlData?.fileUrl : null;
      const xmlHeader = (
        isXmlSource ? routerState?.xmlData?.header : {}
      ) as Partial<ParsedInvoiceHeader>;

      const payload = {
        invoice_number: values.invoice_number || "Draft",
        invoice_symbol: values.invoice_symbol || "",
        invoice_date: values.invoice_date
          ? dayjs(values.invoice_date).format("YYYY-MM-DD")
          : dayjs().format("YYYY-MM-DD"),
        supplier_id: safeSupplierId,
        file_url: isXmlSource ? xmlFileUrl || "" : undefined,

        supplier_name_raw: (xmlHeader.supplier_name || null) as
          | string
          | undefined,
        supplier_tax_code: (xmlHeader.supplier_tax_code || null) as
          | string
          | undefined,
        supplier_address_raw: xmlHeader.supplier_address || null,
        parsed_data: (isXmlSource ? routerState?.xmlData : null) as
          | Json
          | undefined,

        // [VAS] tổng theo chuẩn kế toán VN
        total_goods_amount: totals.totalGoods,
        total_discount_amount: totals.totalDiscount,
        total_fee_amount: totals.totalFee,
        total_amount_pre_tax: totals.totalPreTax,
        tax_amount: totals.totalTax,
        total_amount_post_tax: totals.final,

        items_json: values.items!.map((item: InvoiceFormItem) => ({
          ...item,
          product_id: item.product_id ? Number(item.product_id) : null,
          expiry_date: item.expiry_date
            ? dayjs(item.expiry_date).format("YYYY-MM-DD")
            : null,
          // Explicitly save these 3 fields for Reload Logic
          xml_quantity: item.xml_quantity,
          xml_unit_price: item.xml_unit_price,
          internal_unit: item.internal_unit || null,
        })),

        status: "draft", // FORCE STATUS
      };

      const draftResult = await invoiceService.saveDraft(
        id ? Number(id) : null,
        payload
      );

      // Auto-link to PO if poId provided
      if (linkedPoId && draftResult?.id) {
        await supabase
          .from("finance_invoice_allocations")
          .upsert(
            {
              invoice_id: draftResult.id,
              po_id: Number(linkedPoId),
              allocated_amount: totals.final || 0,
            },
            { onConflict: "invoice_id,po_id" }
          )
          .then(() => {});
      }

      message.success("Đã lưu nháp hóa đơn!");
      navigate(returnTo || "/finance/invoices");
    } catch (error) {
      console.error(error);
      message.error(
        "Lỗi lưu nháp: " + (error as { message?: string })?.message
      );
    } finally {
      setLoading(false);
    }
  };

  // --- INIT EFFECT ---
  useEffect(() => {
    const init = async () => {
      if (suppliers.length === 0 || products.length === 0) {
        await fetchCommonData();
      }

      if (routerState?.source === "xml" && routerState.xmlData) {
        const { header, items } = routerState.xmlData;
        setIsXmlSource(true);
        setXmlRawItems(items);

        const matchedSupplier = suppliers.find(
          (s) =>
            (s as { tax_code?: string }).tax_code?.replace(/\D/g, "") ===
            header.supplier_tax_code?.replace(/\D/g, "")
        );

        form.setFieldsValue({
          invoice_number: header.invoice_number,
          invoice_symbol: header.invoice_symbol,
          invoice_date: header.invoice_date
            ? dayjs(header.invoice_date, ["YYYY-MM-DD", "DD/MM/YYYY"])
            : dayjs(),
          supplier_id: matchedSupplier ? matchedSupplier.id : undefined,
          total_fee_amount: header.total_fee_amount || 0,
          items: items.map(
            (
              item: ParsedInvoiceItem & {
                internal_product_id?: number;
                internal_unit?: string;
              },
              idx: number
            ) => ({
              key: idx,
              name: item.name,
              xml_unit: item.unit,
              quantity: item.quantity,
              xml_quantity: item.quantity, // [NEW] Base quantity for conversion calc
              unit_price: item.unit_price,
              xml_unit_price: item.unit_price, // [NEW] Base price for scaling
              vat_rate: item.vat_rate,
              // [VAS] chiết khấu thương mại từ XML
              discount_rate: item.discount_rate || 0,
              discount_amount: item.discount_amount || 0,
              amount_before_tax: item.amount_before_tax ?? null,
              // [FIX MAPPING] Ép kiểu Number để Select box nhận diện ID
              product_id: item.internal_product_id
                ? Number(item.internal_product_id)
                : undefined,
              internal_unit: item.internal_unit || undefined,
              expiry_date: null,
            })
          ),
        });

        handleRecalculate();
      } else if (id || routerState?.data) {
        const dataToLoad = routerState?.data;
        if (dataToLoad) {
          // Logic fillForm cũ (nếu từ AI Scan) - có thể bổ sung sau
        } else await loadInvoiceFromDB(Number(id));
      }
    };
    init();
    // Deps cố ý chỉ phụ thuộc id/routerState + độ dài data: thêm form/
    // handleRecalculate/loadInvoiceFromDB/suppliers sẽ tạo lại effect mỗi render
    // → reset form & gọi setFieldsValue lặp (mất dữ liệu user đang nhập).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, routerState, suppliers.length, products.length]);

  return {
    form,
    loading,
    isReadOnly,
    isXmlSource,
    xmlRawItems,
    suppliers,
    products,
    navigate,
    onFinish,
    handleRecalculate,
    onSaveDraft, // [NEW] Expose draft handler
    routerState, // [FIX] Expose routerState
  };
};

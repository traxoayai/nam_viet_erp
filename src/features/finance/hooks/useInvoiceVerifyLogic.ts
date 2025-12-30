// src/features/finance/hooks/useInvoiceVerifyLogic.ts
import { useState, useEffect } from "react";
import { App, Form } from "antd";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import dayjs from "dayjs";
import { invoiceService } from "../api/invoiceService";
import { useProductStore } from "@/features/product/stores/productStore";

export const useInvoiceVerifyLogic = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const [form] = Form.useForm();
  
  const routerState = location.state;
  const { suppliers, products, fetchCommonData } = useProductStore();

  const [loading, setLoading] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isXmlSource, setIsXmlSource] = useState(false);
  const [xmlRawItems, setXmlRawItems] = useState<any[]>([]);

//   // --- UTILS ---
//   const parseFlexibleDate = (dateStr: string | null) => {
//     if (!dateStr) return null;
//     const normalizedStr = dateStr.replace(/[.-]/g, "/");
//     const formats = ["DD/MM/YYYY", "D/M/YYYY", "YYYY/MM/DD", "DD/MM/YY"];
//     for (const fmt of formats) {
//       const d = dayjs(normalizedStr, fmt, true);
//       if (d.isValid()) return d;
//     }
//     const loose = dayjs(dateStr);
//     return loose.isValid() ? loose : null;
//   };

  const calculateTotal = (items: any[] = []) => {
    let totalPreTax = 0;
    let totalTax = 0;
    items.forEach((item: any) => {
      const qty = Number(item?.quantity) || 0;
      const price = Number(item?.unit_price) || 0;
      const vat = Number(item?.vat_rate) || 0;
      const lineTotal = qty * price;
      totalPreTax += lineTotal;
      totalTax += lineTotal * (vat / 100);
    });
    return { totalPreTax, totalTax, final: totalPreTax + totalTax };
  };

  // --- ACTIONS ---
  const handleRecalculate = () => {
    const items = form.getFieldValue("items");
    const totals = calculateTotal(items);
    form.setFieldsValue({ total_amount_post_tax: totals.final });
    
  };

  const loadInvoiceFromDB = async (invoiceId: number) => {
    try {
      setLoading(true);
      const { data } = await invoiceService.getInvoices(1, 1, { id: invoiceId });
      if (data && data.length > 0) {
        const record = data[0];
        if (record.status !== "draft") setIsReadOnly(true);
        
        form.setFieldsValue({
             invoice_number: record.invoice_number,
             invoice_symbol: record.invoice_symbol,
             invoice_date: record.invoice_date ? dayjs(record.invoice_date) : null,
             supplier_id: record.supplier_id,
             total_amount_post_tax: record.total_amount_post_tax,
             items: (record.items_json || []).map((item: any, idx: number) => ({
                ...item,
                key: idx,
                expiry_date: item.expiry_date ? dayjs(item.expiry_date) : null,
                // [FIX] Restore base price & qty for unit conversion logic
                xml_unit_price: item.xml_unit_price || item.unit_price, 
                xml_quantity: item.xml_quantity || item.quantity
             }))
        });
      }
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  const onFinish = async (values: any) => {
    if (isReadOnly) return;
    setLoading(true);

    try {
      // 1. VỆ SINH DỮ LIỆU (DATA SANITIZATION)
      let safeSupplierId = values.supplier_id ? Number(values.supplier_id) : null;
      if (typeof safeSupplierId === 'number' && isNaN(safeSupplierId)) {
          safeSupplierId = null;
      }

      if (!safeSupplierId) {
          message.error("Lỗi: Chưa chọn Nhà Cung Cấp hợp lệ.");
          setLoading(false);
          return;
      }

      // 2. AUTO LEARN MAPPING
      if (isXmlSource) {
          const supplierTax = (suppliers.find(s => s.id === safeSupplierId) as any)?.tax_code;
          if (supplierTax) {
              const mappingPromises = values.items.map(async (item: any, index: number) => {
                  const originalName = xmlRawItems[index]?.name;
                  const originalUnit = xmlRawItems[index]?.unit;
                  
                  // Ép kiểu ID sản phẩm, nếu lỗi -> 0
                  let selectedId = item.product_id ? Number(item.product_id) : 0;
                  if (isNaN(selectedId)) selectedId = 0;

                  const selectedUnit = item.internal_unit;

                  if (originalName && selectedId > 0 && selectedUnit) {
                      await invoiceService.saveProductMapping(
                          supplierTax, originalName, originalUnit || null, selectedId, selectedUnit
                      );
                  }
              });
              await Promise.all(mappingPromises);
          }
      }

      // 3. CHUẨN BỊ PAYLOAD (CẬP NHẬT MỚI)
      const totals = calculateTotal(values.items);
      const xmlFileUrl = isXmlSource ? routerState?.xmlData?.fileUrl : null;
      
      // [FIX] Lấy thông tin Raw từ XML Header
      const xmlHeader = isXmlSource ? routerState?.xmlData?.header : {};

      const payload = {
        invoice_number: values.invoice_number || "Unknown",
        invoice_symbol: values.invoice_symbol || "",
        invoice_date: values.invoice_date ? dayjs(values.invoice_date).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
        supplier_id: safeSupplierId,
        
        file_url: isXmlSource ? (xmlFileUrl || "no_file_uploaded_error") : undefined,
        
        // [NEW] Bổ sung các trường Raw để hiển thị ngoài danh sách
        supplier_name_raw: xmlHeader.supplier_name || null,
        supplier_tax_code: xmlHeader.supplier_tax_code || null,
        supplier_address_raw: xmlHeader.supplier_address || null,
        parsed_data: isXmlSource ? routerState?.xmlData : null, // Lưu lại toàn bộ cục JSON XML để sau này debug
        
        total_amount_pre_tax: totals.totalPreTax,
        tax_amount: totals.totalTax,
        total_amount_post_tax: totals.final,
        
        items_json: values.items.map((item: any) => {
             let pId = item.product_id ? Number(item.product_id) : null;
             if (typeof pId === 'number' && isNaN(pId)) pId = null;
             
             return {
                ...item,
                product_id: pId,
                internal_unit: item.internal_unit || null,
                expiry_date: item.expiry_date ? dayjs(item.expiry_date).format("YYYY-MM-DD") : null,
            };
        }),
      };

      // 4. PHÂN LUỒNG TẠO MỚI / CẬP NHẬT
      // Nếu là XML Source (Mới) HOẶC không có ID trên URL -> Gọi Create
      if (isXmlSource || !id) {
          console.log("Creating NEW invoice...", payload);
          await invoiceService.createInvoice(payload);
          message.success("Đã tạo mới và nhập kho VAT thành công!");
      } else {
          // Nếu đang sửa hóa đơn cũ -> Gọi Update
          console.log("Updating EXISTING invoice...", id);
          await invoiceService.verifyInvoice(Number(id), payload);
          message.success("Đã cập nhật hóa đơn!");
      }

      navigate("/finance/invoices");

    } catch (error: any) {
      console.error(error);
      message.error("Lỗi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const onSaveDraft = async (values: any) => {
    setLoading(true);
    try {
      const totals = calculateTotal(values.items);
      let safeSupplierId = values.supplier_id ? Number(values.supplier_id) : null;
      if (typeof safeSupplierId === 'number' && isNaN(safeSupplierId)) safeSupplierId = null;

      const xmlFileUrl = isXmlSource ? routerState?.xmlData?.fileUrl : null;
      const xmlHeader = isXmlSource ? routerState?.xmlData?.header : {};

      const payload = {
        invoice_number: values.invoice_number || "Draft",
        invoice_symbol: values.invoice_symbol || "",
        invoice_date: values.invoice_date ? dayjs(values.invoice_date).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
        supplier_id: safeSupplierId,
        file_url: isXmlSource ? (xmlFileUrl || "") : undefined,
        
        supplier_name_raw: xmlHeader.supplier_name || null,
        supplier_tax_code: xmlHeader.supplier_tax_code || null,
        supplier_address_raw: xmlHeader.supplier_address || null,
        parsed_data: isXmlSource ? routerState?.xmlData : null,
        
        total_amount_pre_tax: totals.totalPreTax,
        tax_amount: totals.totalTax,
        total_amount_post_tax: totals.final,
        
        items_json: values.items.map((item: any) => ({
             ...item,
             product_id: item.product_id ? Number(item.product_id) : null,
             expiry_date: item.expiry_date ? dayjs(item.expiry_date).format("YYYY-MM-DD") : null,
             // Explicitly save these 3 fields for Reload Logic
             xml_quantity: item.xml_quantity,
             xml_unit_price: item.xml_unit_price, 
             internal_unit: item.internal_unit || null
        })),
        
        status: 'draft' // FORCE STATUS
      };

      await invoiceService.saveDraft(id ? Number(id) : null, payload);
      message.success("Đã lưu nháp hóa đơn!");
      navigate("/finance/invoices");
      
    } catch (error: any) {
        console.error(error);
        message.error("Lỗi lưu nháp: " + error.message);
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
        
        const matchedSupplier = suppliers.find((s: any) => 
            s.tax_code?.replace(/\D/g,'') === header.supplier_tax_code?.replace(/\D/g,'')
        );

        form.setFieldsValue({
            invoice_number: header.invoice_number,
            invoice_symbol: header.invoice_symbol,
            invoice_date: header.invoice_date ? dayjs(header.invoice_date, ["YYYY-MM-DD", "DD/MM/YYYY"]) : dayjs(),
            supplier_id: matchedSupplier ? matchedSupplier.id : undefined,
            items: items.map((item: any, idx: number) => ({
                key: idx,
                name: item.name,
                xml_unit: item.unit,
                quantity: item.quantity,
                xml_quantity: item.quantity, // [NEW] Base quantity for conversion calc
                unit_price: item.unit_price,
                xml_unit_price: item.unit_price, // [NEW] Base price for scaling
                vat_rate: item.vat_rate,
                // [FIX MAPPING] Ép kiểu Number để Select box nhận diện ID
                product_id: item.internal_product_id ? Number(item.internal_product_id) : undefined, 
                internal_unit: item.internal_unit || undefined, 
                expiry_date: null 
            }))
        });
        
        handleRecalculate();
      } else if (id || routerState?.data) {
          const dataToLoad = routerState?.data;
          if(dataToLoad) {
             // Logic fillForm cũ (nếu từ AI Scan) - có thể bổ sung sau
          }
          else await loadInvoiceFromDB(Number(id));
      }
    };
    init();
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
      routerState // [FIX] Expose routerState
  };
};
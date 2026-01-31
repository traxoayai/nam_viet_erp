// src/pages/inventory/hooks/useProductFormLogic.ts
import { useState, useEffect, useCallback } from "react";
import { Form, App as AntApp } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import type { UploadFile, UploadProps } from "antd/es/upload/interface";
import { useProductStore } from "@/features/product/stores/productStore";
import {
  addProduct,
  updateProduct,
  uploadProductImage,
} from "@/features/product/api/productService";

export const useProductFormLogic = () => {
  const [form] = Form.useForm();
  // WATCH UNITS for Reactive Anchor Label
  const watchedUnits = Form.useWatch('units', form);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const {
    fetchCommonData,
    currentProduct,
    getProductDetails,
    loadingDetails,
    suppliers,
    warehouses,
  } = useProductStore();
  const { message: antMessage } = AntApp.useApp();

  const [loading, setLoading] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [selectedSupplierName, setSelectedSupplierName] = useState("");

  // --- ANCHOR UNIT LOGIC ---
  const findAnchorUnit = useCallback((units: any[]) => {
    if (!units || units.length === 0) return { conversion_rate: 1 };
    
    // Priority 1: Wholesale
    const wholesale = units.find((u) => u.unit_type === "wholesale");
    if (wholesale) return wholesale;

    // Priority 2: Logistics
    const logistics = units.find((u) => u.unit_type === "logistics");
    if (logistics) return logistics;

    // Priority 3: Largest Rate
    // Clone to sort safely
    const sorted = [...units].sort((a, b) => (b.conversion_rate || 1) - (a.conversion_rate || 1));
    return sorted[0];
  }, []);

  // --- PRICING RE-CALCULATION ---
  const recalcPrices = useCallback(() => {
    const allValues = form.getFieldsValue();
    const inputCost = parseFloat(allValues.actualCost) || 0; // This is WHOLESALE COST (Input)
    const units = allValues.units || [];

    const wholesaleMarginValue = parseFloat(allValues.wholesaleMarginValue) || 0;
    const wholesaleMarginType = allValues.wholesaleMarginType || "amount";

    const retailMarginValue = parseFloat(allValues.retailMarginValue) || 0;
    const retailMarginType = allValues.retailMarginType || "amount";

    // 1. Find Anchor
    const anchorUnit = findAnchorUnit(units);
    const anchorRate = parseFloat(anchorUnit.conversion_rate) || 1;

    // 2. Base Metrics
    const baseCost = inputCost / anchorRate;

    // Profit per BASE UNIT
    let profitBaseWs = 0;
    if (wholesaleMarginType === "amount") {
      // Margin Amount is entered PER ANCHOR UNIT
      // So profit per base = Margin / AnchorRate
      profitBaseWs = wholesaleMarginValue / anchorRate;
    } else {
      // Percent: Applied to cost
      profitBaseWs = baseCost * (wholesaleMarginValue / 100);
    }

    let profitBaseRt = 0;
    if (retailMarginType === "amount") {
      profitBaseRt = retailMarginValue / anchorRate;
    } else {
      profitBaseRt = baseCost * (retailMarginValue / 100);
    }

    // 3. Update Units
    const updatedUnits = units.map((u: any) => {
      const uRate = parseFloat(u.conversion_rate) || 1;
      const uType = u.unit_type || "base";

      let selectedProfitBase = profitBaseRt;
      if (uType === "wholesale" || uType === "logistics") {
        selectedProfitBase = profitBaseWs;
      }

      // Final Price = (BaseCost + ProfitBase) * UnitRate
      const finalPrice = (baseCost + selectedProfitBase) * uRate;
      
      return {
        ...u,
        price: Math.round(finalPrice), // Round to integer (Unit Price < 100 is possible)
      };
    });

    // Update form carefully to avoid loops if needed, but here we just set 'units'
    // form.setFieldValue('units', updatedUnits) triggers re-render
    // We must ensure this doesn't cause infinite loop if called from useEffect.
    // Ideally called only on blur or specific changes.
    // For now, valid to setFieldsValue.
    form.setFieldsValue({ units: updatedUnits });
  }, [form, findAnchorUnit]);

  // --- INITIALIZATION ---
  useEffect(() => {
    fetchCommonData();
  }, [fetchCommonData]);

  useEffect(() => {
    if (isEditing) {
      getProductDetails(Number(id));
    }
  }, [isEditing, id, getProductDetails]);

  // --- INITIALIZATION (FIXED FINAL) ---
  useEffect(() => {
    if (isEditing && currentProduct) {
      // 1. Clone object
      const initData: any = { ...currentProduct };

      // [CRITICAL FIX]: Hỗ trợ cả 2 định dạng API (REST vs RPC)
      // REST API trả về: actual_cost, retail_margin_value...
      // RPC trả về: actualCost, retailMarginValue...
      
      const rawCost = currentProduct.actualCost ?? currentProduct.actual_cost;
      const dbBaseCost = Number(rawCost) || 0;
      
      const units = currentProduct.units || [];
      const anchor = findAnchorUnit(units);
      const anchorRate = Number(anchor.conversion_rate) || 1;
      
      // Quy đổi
      const displayCost = dbBaseCost * anchorRate;
      initData.actualCost = Math.round(displayCost);

      // Map Margin (Hỗ trợ cả 2 case)
      initData.retailMarginValue = currentProduct.retailMarginValue ?? currentProduct.retail_margin_value;
      initData.retailMarginType = currentProduct.retailMarginType ?? currentProduct.retail_margin_type;
      initData.wholesaleMarginValue = currentProduct.wholesaleMarginValue ?? currentProduct.wholesale_margin_value;
      initData.wholesaleMarginType = currentProduct.wholesaleMarginType ?? currentProduct.wholesale_margin_type;

      // 4. Xử lý Inventory
      if (currentProduct.inventorySettings) {
        const newSettings: any = {};
        Object.keys(currentProduct.inventorySettings).forEach(whKey => {
           const setting = currentProduct.inventorySettings[whKey]; // whKey là 'b2b', 'pkdh'...
           if (setting) {
               newSettings[whKey] = {
                   min: setting.min ? Math.floor(Number(setting.min) / anchorRate) : 0,
                   max: setting.max ? Math.floor(Number(setting.max) / anchorRate) : 0
               };
           }
        });
        initData.inventorySettings = newSettings;
      } else if (currentProduct.inventory) { 
         // [Fallback] Nếu REST API trả về mảng 'inventory' thay vì object 'inventorySettings'
         // Dev cần check xem productStore map inventory như thế nào.
         // Tạm thời giữ nguyên logic cũ của Sếp.
      }

      // 5. Reset & Set Form
      form.resetFields(); 
      form.setFieldsValue(initData);

      // 6. Update Local UI State
      // Distributor ID
      const distId = currentProduct.distributor ?? currentProduct.distributor_id;
      if (distId) { 
        form.setFieldValue('distributor', distId);
        const supplier = suppliers.find((s) => s.id === distId);
        if (supplier) setSelectedSupplierName(supplier.name);
      }
      
      // Image URL
      const img = currentProduct.imageUrl ?? currentProduct.image_url;
      if (img) {
        setImageUrl(img);
        setFileList([{ uid: "-1", name: "image.png", status: "done", url: img }]);
      }
      
      // Tags
      const tags = currentProduct.tags ?? currentProduct.active_ingredient;
      if (tags && !form.getFieldValue("tags")) {
        form.setFieldsValue({ tags: tags });
      }
    }
  }, [isEditing, currentProduct, form, suppliers, findAnchorUnit]);

  // --- HANDLERS ---
  const handleModifyCostOrMargin = () => {
      recalcPrices();
  };

  const handleUpload: UploadProps["customRequest"] = async ({ onSuccess }) => {
    if (onSuccess) onSuccess("ok");
  };

  const onUploadChange: UploadProps["onChange"] = ({ fileList: newFileList }) => {
    setFileList(newFileList);
    if (newFileList.length === 0) setImageUrl("");
  };

  const handleImageSearch = () => {
    const productName = form.getFieldValue("productName");
    if (!productName) {
      antMessage.warning("Vui lòng nhập Tên sản phẩm trước khi tìm ảnh.");
      return;
    }
    const query = encodeURIComponent(`${productName} product image`);
    window.open(`https://www.google.com/search?tbm=isch&q=${query}`, "_blank");
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // Image Upload
      let finalImageUrl = imageUrl;
      if (fileList.length > 0 && fileList[0].originFileObj) {
        antMessage.loading({ content: "Đang tải ảnh lên...", key: "upload" });
        finalImageUrl = await uploadProductImage(fileList[0].originFileObj);
        antMessage.success({ content: "Tải ảnh thành công!", key: "upload" });
      }

      // PREPARE PAYLOAD
      // Convert Display Cost (Wholesale) -> Base Cost
      const inputCost = parseFloat(values.actualCost) || 0;
      const units = values.units || [];
      const anchor = findAnchorUnit(units);
      const anchorRate = anchor.conversion_rate || 1;
      const baseCost = inputCost / anchorRate;

      // [FIX] Map units to set price = 0 (Signal for Backend Auto-Pricing)
      const fixedUnits = units.map((u: any) => ({
          ...u,
          price: 0, // Backend will recalculate based on Margin
      }));

      const finalValues = {
        ...values,
        actualCost: baseCost, // Override with Base Cost for API
        imageUrl: finalImageUrl,
        units: fixedUnits, // Use fixed units
      };

      const inventoryPayload = warehouses.map((wh) => {
        const settings = values.inventorySettings?.[wh.key] || {};
        return {
          warehouse_id: wh.id,
          min_stock: (settings.min || 0) * anchorRate, // Wholesale -> Base
          max_stock: (settings.max || 0) * anchorRate, // Wholesale -> Base
        };
      });

      let savedId = Number(id);

      if (isEditing) {
        await updateProduct(savedId, finalValues, inventoryPayload);
        antMessage.success(`Cập nhật sản phẩm thành công!`);
      } else {
        const res: any = await addProduct(finalValues, inventoryPayload);
        if (res?.product_id) {
             savedId = Number(res.product_id);
             // Optional: Update URL to edit mode without reload if needed, 
             // but for now just fetching details is enough to update form
        }
        antMessage.success(`Tạo sản phẩm thành công!`);
      }

      // [FIX] Reload data to update UI with Backend-calculated prices
      if (savedId) {
          await getProductDetails(savedId);
      }

      // navigate("/inventory"); // [DISABLE] Stay on page to see updated prices
    } catch (error: any) {
      console.error(error);
      const msg = error.message || error.details || "Không thể lưu sản phẩm";
      antMessage.error(`Lỗi: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Derive Anchor Name for UI
  const currentAnchor = findAnchorUnit(watchedUnits || []);
  const anchorUnitName = currentAnchor?.unit_name || "Base Unit";

  return {
    form,
    loading,
    loadingDetails,
    isEditing,
    currentProduct,
    imageUrl,
    setImageUrl,
    fileList,
    handleUpload,
    onUploadChange,
    handleImageSearch,
    isSupplierModalOpen,
    setIsSupplierModalOpen,
    selectedSupplierName,
    setSelectedSupplierName,
    warehouses,
    onFinish,
    handleModifyCostOrMargin,
    navigate,
    anchorUnitName,
  };
};

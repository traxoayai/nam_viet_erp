// src/pages/inventory/hooks/useProductFormLogic.ts
import { Form, App as AntApp } from "antd";
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";

import type { UploadFile, UploadProps } from "antd/es/upload/interface";

import {
  addProduct,
  updateProduct,
  uploadProductImage,
} from "@/features/product/api/productService";
import { useProductStore } from "@/features/product/stores/productStore";

export const useProductFormLogic = () => {
  const [form] = Form.useForm();
  const watchedUnits = Form.useWatch("units", form);
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
    const wholesale = units.find((u) => u.unit_type === "wholesale");
    if (wholesale) return wholesale;
    const logistics = units.find((u) => u.unit_type === "logistics");
    if (logistics) return logistics;
    const sorted = [...units].sort((a, b) => (b.conversion_rate || 1) - (a.conversion_rate || 1));
    return sorted[0];
  }, []);

  // --- PRICING RE-CALCULATION ---
  const recalcPrices = useCallback(() => {
    const allValues = form.getFieldsValue();

    // Form field names use camelCase (actualCost, wholesaleMarginValue, etc.)
    const inputCost = parseFloat(allValues.actualCost) || 0;
    const units = allValues.units || [];

    const wholesaleMarginValue = parseFloat(allValues.wholesaleMarginValue) || 0;
    const wholesaleMarginType = (allValues.wholesaleMarginType === 'percent' || allValues.wholesaleMarginType === '%') ? 'percent' : 'amount';

    const retailMarginValue = parseFloat(allValues.retailMarginValue) || 0;
    const retailMarginType = (allValues.retailMarginType === 'percent' || allValues.retailMarginType === '%') ? 'percent' : 'amount';

    const anchorUnit = findAnchorUnit(units);
    const anchorRate = parseFloat(anchorUnit.conversion_rate) || 1;
    
    // Vốn cơ bản (1 Viên)
    const baseCost = inputCost / anchorRate;

    const updatedUnits = units.map((u: any) => {
      const uRate = parseFloat(u.conversion_rate) || 1;
      const uType = u.unit_type || "base";
      let finalPrice = 0;
      const unitCost = baseCost * uRate;

      if (uType === "wholesale" || uType === "logistics") {
        if (wholesaleMarginType === "amount") {
           // Lãi tiền chia nhỏ ra cho từng viên, rồi nhân với số viên của đơn vị
           const profitPerUnit = (wholesaleMarginValue / anchorRate) * uRate;
           finalPrice = unitCost + profitPerUnit;
        } else {
           finalPrice = unitCost * (1 + wholesaleMarginValue / 100);
        }
      } else {
        if (retailMarginType === "amount") {
           const profitPerUnit = (retailMarginValue / anchorRate) * uRate;
           finalPrice = unitCost + profitPerUnit;
        } else {
           finalPrice = unitCost * (1 + retailMarginValue / 100);
        }
      }

      return {
        ...u,
        price: Math.round(finalPrice), 
      };
    });

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

  // --- BIND DATA VÀO FORM (CHUẨN HÓA SNAKE_CASE) ---
  useEffect(() => {
    if (isEditing && currentProduct) {
      const initData: any = { ...currentProduct };
      
      const units = currentProduct.units || currentProduct.product_units || [];
      const anchor = findAnchorUnit(units);
      const anchorRate = Number(anchor.conversion_rate) || 1;

      // Quy đổi Giá vốn DB (Base) -> Giao diện (Anchor)
      const rawCost = currentProduct.actual_cost ?? 0;
      const displayCost = Math.round(Number(rawCost) * anchorRate);

      // Ép Type % hay Tiền để UI select đúng (camelCase cho form fields)
      const retailTypeDB = currentProduct.retail_margin_type;
      initData.retailMarginType = (retailTypeDB === '%' || retailTypeDB === 'percent') ? 'percent' : 'amount';
      initData.retailMarginValue = currentProduct.retail_margin_value ?? 0;

      const wholesaleTypeDB = currentProduct.wholesale_margin_type;
      initData.wholesaleMarginType = (wholesaleTypeDB === '%' || wholesaleTypeDB === 'percent') ? 'percent' : 'amount';
      initData.wholesaleMarginValue = currentProduct.wholesale_margin_value ?? 0;

      // Xử lý Inventory
      if (currentProduct.inventorySettings) {
        const newSettings: any = {};
        Object.keys(currentProduct.inventorySettings).forEach((whKey) => {
          const setting = currentProduct.inventorySettings[whKey];
          if (setting) {
            newSettings[whKey] = {
              min: setting.min ? Math.floor(Number(setting.min) / anchorRate) : 0,
              max: setting.max ? Math.floor(Number(setting.max) / anchorRate) : 0,
            };
          }
        });
        initData.inventorySettings = newSettings;
      }

      if (currentProduct.product_units) {
          initData.units = currentProduct.product_units;
      }

      form.resetFields();
      
      setTimeout(() => {
          form.setFieldsValue({
              ...initData,
              actualCost: displayCost,
              name: currentProduct.name,
              barcode: currentProduct.barcode,
              sku: currentProduct.sku,
              registration_number: currentProduct.registration_number,
              packing_spec: currentProduct.packing_spec,
          });
      }, 100);

      const distId = currentProduct.distributor ?? currentProduct.distributor_id;
      if (distId) {
        form.setFieldValue("distributor_id", distId);
        const supplier = suppliers.find((s) => s.id === distId);
        if (supplier) setSelectedSupplierName(supplier.name);
      }

      const img = currentProduct.image_url;
      if (img) {
        setImageUrl(img);
        setFileList([{ uid: "-1", name: "image.png", status: "done", url: img }]);
      }

      const tags = currentProduct.active_ingredient;
      if (tags && !form.getFieldValue("active_ingredient")) {
        form.setFieldsValue({ active_ingredient: tags });
      }
    }
  }, [isEditing, currentProduct, form, suppliers, findAnchorUnit]);

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
    const productName = form.getFieldValue("name");
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
      let finalImageUrl = imageUrl;
      if (fileList.length > 0 && fileList[0].originFileObj) {
        antMessage.loading({ content: "Đang tải ảnh lên...", key: "upload" });
        finalImageUrl = await uploadProductImage(fileList[0].originFileObj);
        antMessage.success({ content: "Tải ảnh thành công!", key: "upload" });
      }

      // Đưa Giá Hộp về lại Giá Viên trước khi lưu DB
      const inputCost = parseFloat(values.actualCost) || 0;
      const units = values.units || [];
      const anchor = findAnchorUnit(units);
      const anchorRate = anchor.conversion_rate || 1;
      const baseCost = inputCost / anchorRate;

      const fixedUnits = units.map((u: any) => ({
        ...u,
        price: u.price || 0,
      }));

      const finalValues = {
        ...values,
        actual_cost: baseCost,
        image_url: finalImageUrl,
        units: fixedUnits,
        // Convert camelCase form fields → snake_case DB fields
        retail_margin_type: values.retailMarginType === 'percent' ? '%' : 'amount',
        retail_margin_value: values.retailMarginValue,
        wholesale_margin_type: values.wholesaleMarginType === 'percent' ? '%' : 'amount',
        wholesale_margin_value: values.wholesaleMarginValue,
      };

      const inventoryPayload = warehouses.map((wh) => {
        const settings = values.inventorySettings?.[wh.key] || {};
        return {
          warehouse_id: wh.id,
          min_stock: (settings.min || 0) * anchorRate, 
          max_stock: (settings.max || 0) * anchorRate, 
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
        }
        antMessage.success(`Tạo sản phẩm thành công!`);
      }

      if (savedId) {
        await getProductDetails(savedId);
      }
    } catch (error: any) {
      console.error(error);
      const msg = error.message || error.details || "Không thể lưu sản phẩm";
      antMessage.error(`Lỗi: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

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
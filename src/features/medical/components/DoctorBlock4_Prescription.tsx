// src/features/medical/components/DoctorBlock4_Prescription.tsx
import { CheckCircleOutlined, WarningOutlined } from "@ant-design/icons";
import { Card, Button, Drawer, List, Space, Input, message, Modal, Select } from "antd";
import { Pill, FileText } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";

import { ClinicalPrescriptionItem } from "../types/medical.types";

import { DoctorPrescriptionSearch } from "./DoctorPrescriptionSearch";
import { DoctorPrescriptionTable } from "./DoctorPrescriptionTable";

import { PosProductSearchResult } from "@/features/pos/types/pos.types";
import { safeRpc } from "@/shared/lib/safeRpc";
import { supabase } from "@/shared/lib/supabaseClient";

interface Props {
  items: ClinicalPrescriptionItem[];
  setItems: (items: ClinicalPrescriptionItem[]) => void;
  patientAllergies?: string;
  readOnly?: boolean;
  onSendPharmacy?: (warehouseId: number) => void;
  sending?: boolean;
  isPrescriptionSent?: boolean;
  pharmacyWarehouses?: {id: number, name: string}[];
  selectedPharmacy?: number;
  onPharmacyChange?: (value: number) => void;
}

export const DoctorBlock4_Prescription: React.FC<Props> = ({
  items,
  setItems,
  patientAllergies,
  readOnly,
  onSendPharmacy,
  sending,
  isPrescriptionSent,
  pharmacyWarehouses,
  selectedPharmacy,
  onPharmacyChange,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [templateResults, setTemplateResults] = useState<any[]>([]);
  const [searchingTemplates, setSearchingTemplates] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const searchTemplates = async (keyword: string) => {
    setSearchingTemplates(true);
    try {
      const { data } = await safeRpc(
        "search_prescription_templates",
        {
          p_keyword: keyword || "",
        }
      );
      setTemplateResults((data || []) as unknown as Record<string, unknown>[]);
    } catch (err: any) {
      message.error("Lỗi tìm kiếm đơn mẫu: " + err.message);
    } finally {
      setSearchingTemplates(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const keyword = e.target.value;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      searchTemplates(keyword);
    }, 500);
  };

  useEffect(() => {
    if (isDrawerOpen && templateResults.length === 0) {
      searchTemplates(""); // Fetch on first open
    }
  }, [isDrawerOpen]);
  // Đã trích phần MOCK TYPE ra dùng Props

  const applyTemplate = async (tpl: any) => {
    const newItems = [...items];
    const newProducts = tpl.items.filter(
      (tItem: any) => !newItems.find((i) => i.product_id === tItem.product_id)
    );

    // Batch lookup product_unit_id cho tất cả sản phẩm mới
    const productIds = newProducts.map((t: any) => t.product_id).filter(Boolean);
    const unitMap = new Map<number, number>();
    if (productIds.length > 0) {
      const { data: units } = await supabase
        .from("product_units")
        .select("id, product_id, unit_type, is_base")
        .in("product_id", productIds);
      for (const pid of productIds) {
        const pUnits = (units || []).filter((u) => u.product_id === pid);
        const best = pUnits.find((u) => u.unit_type === "retail")
          || pUnits.find((u) => u.is_base)
          || pUnits[0];
        if (best) unitMap.set(pid, best.id);
      }
    }

    newProducts.forEach((tItem: any) => {
      newItems.push({
        ...tItem,
        product_unit_id: unitMap.get(tItem.product_id) || 1,
        unit_name: tItem.unit || "",
        usage_note: tItem.usage_instruction || "",
      });
    });

    setItems(newItems);
    setIsDrawerOpen(false);
  };

  const addProductToTable = async (product: PosProductSearchResult) => {
    // Check duplicate
    const exist = items.find((i) => i.product_id === product.id);
    if (exist) {
      // Increase Qty
      setItems(
        items.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      // Lookup retail unit ID
      const { data: units } = await supabase
        .from("product_units")
        .select("id, unit_type, is_base")
        .eq("product_id", product.id);
      const best = (units || []).find((u) => u.unit_type === "retail")
        || (units || []).find((u) => u.is_base)
        || (units || [])[0];

      const newItem: ClinicalPrescriptionItem = {
        product_id: product.id,
        product_name: product.name,
        product_unit_id: best?.id || 1,
        unit_name: product.unit,
        quantity: 1,
        usage_note: "",
        stock_quantity: product.stock_quantity,
      };
      setItems([...items, newItem]);
    }
  };

  const handleSelectProduct = (product: PosProductSearchResult) => {
    // --- START: SAFETY CHECK ---
    if (patientAllergies) {
      const allergies = patientAllergies.toLowerCase();
      const drugName = product.name.toLowerCase();

      // Logic check đơn giản (Thực tế cần check theo hoạt chất)
      const isAllergic =
        (allergies.includes("penicillin") &&
          (drugName.includes("amoxicillin") ||
            drugName.includes("augmentin"))) ||
        (allergies.includes("paracetamol") && drugName.includes("para"));

      if (isAllergic) {
        Modal.confirm({
          title: "CẢNH BÁO DỊ ỨNG THUỐC",
          icon: <WarningOutlined className="text-red-600" />,
          content: (
            <div>
              <p>
                Bệnh nhân có tiền sử dị ứng:{" "}
                <span className="font-bold text-red-600">
                  {patientAllergies}
                </span>
              </p>
              <p>
                Thuốc bạn chọn:{" "}
                <span className="font-bold">{product.name}</span>
              </p>
              <p>Bạn có chắc chắn muốn kê thuốc này không?</p>
            </div>
          ),
          okText: "Vẫn kê (Tôi chịu trách nhiệm)",
          okType: "danger",
          cancelText: "Hủy bỏ",
          onOk: () => addProductToTable(product),
        });
        return;
      }
    }
    // --- END: SAFETY CHECK ---

    addProductToTable(product);
  };

  return (
    <Card
      size="small"
      title={
        <span className="flex items-center gap-2">
          <Pill size={16} /> Chẩn đoán & Kê đơn
        </span>
      }
      className="shadow-sm h-full flex flex-col"
      styles={{ body: { flex: 1, display: "flex", flexDirection: "column" } }}
    >
      {/* Helper Toolbar */}
      <div className="flex gap-2 mb-3">
        <div
          className="flex-1 pointer-events-none"
          style={readOnly ? { opacity: 0.6 } : { pointerEvents: "auto" }}
        >
          <DoctorPrescriptionSearch
            onSelectProduct={handleSelectProduct}
            warehouseId={selectedPharmacy ?? 1}
          />
        </div>

        <Space>
          <Button
            icon={<FileText size={14} />}
            onClick={() => setIsDrawerOpen(true)}
            disabled={readOnly}
          >
            Đơn mẫu
          </Button>

          {pharmacyWarehouses && pharmacyWarehouses.length > 0 && (
            <Select
              value={selectedPharmacy}
              onChange={onPharmacyChange}
              style={{ width: 180 }}
              options={pharmacyWarehouses.map((w: any) => ({ label: w.name, value: w.id }))}
              placeholder="Chọn quầy thuốc"
              size="small"
            />
          )}

          <Button
            type={isPrescriptionSent ? "default" : "primary"}
            className={
              isPrescriptionSent
                ? "text-green-600 font-semibold border-green-500"
                : ""
            }
            icon={<CheckCircleOutlined />}
            disabled={readOnly || isPrescriptionSent || items.length === 0}
            loading={sending}
            onClick={() => onSendPharmacy && onSendPharmacy(selectedPharmacy ?? 1)}
          >
            {isPrescriptionSent ? "Đã Chuyển Nhà Thuốc" : "Chuyển Quầy Thuốc"}
          </Button>
        </Space>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto border border-gray-100 rounded">
        <DoctorPrescriptionTable
          items={items}
          setItems={setItems}
          readOnly={readOnly || isPrescriptionSent}
        />
      </div>

      {/* Drawer Template */}
      <Drawer
        title="Thư viện Đơn Thuốc Mẫu"
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        width={450}
        placement="right"
      >
        <div className="flex flex-col h-full">
          <Input.Search
            placeholder="Tìm đơn mẫu (vd: Viêm họng)..."
            onChange={handleSearchChange}
            onSearch={searchTemplates}
            loading={searchingTemplates}
            allowClear
            className="mb-4"
          />
          <List
            className="flex-1 overflow-auto"
            dataSource={templateResults}
            loading={searchingTemplates}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => applyTemplate(item)}
                  >
                    Áp dụng
                  </Button>,
                ]}
                className="bg-gray-50 rounded mb-2 px-3 border border-gray-100"
              >
                <List.Item.Meta
                  avatar={
                    <CheckCircleOutlined className="text-green-500 mt-2" />
                  }
                  title={
                    <span className="font-bold text-blue-700">{item.name}</span>
                  }
                  description={
                    <div className="flex flex-col text-xs">
                      {item.diagnosis ? (
                        <span>
                          <span className="font-semibold text-gray-500">
                            Chẩn đoán:
                          </span>{" "}
                          {item.diagnosis}
                        </span>
                      ) : null}
                      <span>
                        <span className="font-semibold text-gray-500">
                          Gồm:
                        </span>{" "}
                        {item.items?.length || 0} loại thuốc
                      </span>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      </Drawer>
    </Card>
  );
};

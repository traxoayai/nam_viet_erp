import { message } from "antd";
import { useState, useEffect } from "react";

import { supabase } from "@/shared/lib/supabaseClient";

export const usePatientHistory = (customerId: number | undefined) => {
  const [history, setHistory] = useState<any[]>([]);

  // State chứa dữ liệu lịch sử sinh hiệu (để vẽ biểu đồ)
  const [vitalsHistory, setVitalsHistory] = useState<{
    pulse: any[];
    temperature: any[];
    sp02: any[];
    bp_systolic: any[];
    bp_diastolic: any[];
    weight: any[];
    height: any[];
  }>({
    pulse: [],
    temperature: [],
    sp02: [],
    bp_systolic: [],
    bp_diastolic: [],
    weight: [],
    height: [],
  });

  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!customerId) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        // [FIX]: Query đã được đơn giản hóa phần join doctor
        const { data, error } = await supabase
          .from("medical_visits")
          .select(
            `
            id, created_at, diagnosis, symptoms, examination_summary, doctor_notes, status,
            pulse, temperature, sp02, bp_systolic, bp_diastolic, weight, height,
            
            doctor:users (full_name),
            
            prescriptions:clinical_prescriptions (
                id,
                items:clinical_prescription_items (
                    quantity, usage_note,
                    product:products (id, name, sku),
                    unit:product_units (unit_name)
                )
            )
          `
          )
          .eq("customer_id", customerId)
          .eq("status", "finished")
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) throw error;

        // 1. Xử lý dữ liệu cho Drawer (Danh sách khám)
        const formattedHistory = data?.map((visit) => {
          const flatMedicines =
            visit.prescriptions?.flatMap((p: any) =>
              p.items.map((i: any) => ({
                product_id: i.product?.id,
                product_name: i.product?.name,
                quantity: i.quantity,
                unit_name: i.unit?.unit_name,
                usage_note: i.usage_note,
                product_unit_id: 1,
              }))
            ) || [];
          return { ...visit, flatMedicines };
        });
        setHistory(formattedHistory || []);

        // 2. Xử lý dữ liệu cho Biểu đồ (Trend)
        // Lấy dữ liệu từ quá khứ đến hiện tại (reverse) và lọc bỏ giá trị null
        const processMetric = (key: string) =>
          data
            ?.map((v: any) => ({ date: v.created_at, value: v[key] }))
            .filter((item) => item.value !== null && item.value > 0)
            .reverse() || [];

        setVitalsHistory({
          pulse: processMetric("pulse"),
          temperature: processMetric("temperature"),
          sp02: processMetric("sp02"),
          bp_systolic: processMetric("bp_systolic"),
          bp_diastolic: processMetric("bp_diastolic"),
          weight: processMetric("weight"),
          height: processMetric("height"),
        });
      } catch (err) {
        console.error("Err fetch history:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [customerId]);

  // Logic Copy đơn thuốc
  const onCopyPrescription = (
    oldPrescription: any[],
    currentItems: any[],
    setItems: (items: any[]) => void
  ) => {
    const newItems = oldPrescription.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      product_unit_id: item.product_unit_id || 1,
      unit_name: item.unit_name,
      quantity: item.quantity,
      usage_note: item.usage_note || "",
      stock_quantity: 999,
    }));
    setItems([...currentItems, ...newItems]);
    message.success(`Đã thêm ${newItems.length} thuốc vào đơn hiện tại.`);
  };

  return {
    history,
    vitalsHistory,
    loading,
    onCopyPrescription,
    drawerOpen,
    setDrawerOpen,
  };
};

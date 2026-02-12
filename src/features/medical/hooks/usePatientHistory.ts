import { useState, useEffect } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';

export const usePatientHistory = (customerId: number | undefined) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customerId) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        // [CORE UPDATE]: Deep Nested Query
        const { data, error } = await supabase
          .from('medical_visits')
          .select(`
            id, created_at, diagnosis, symptoms, examination_summary, doctor_notes,
            doctor:users!medical_visits_doctor_id_fkey (full_name),
            prescriptions:clinical_prescriptions (
                id,
                items:clinical_prescription_items (
                    quantity, usage_note,
                    product:products (id, name, sku),
                    unit:product_units (unit_name)
                )
            )
          `)
          .eq('customer_id', customerId)
          .eq('status', 'finished') 
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) throw error;
        
        // [FLATTEN DATA]: Làm phẳng cấu trúc thuốc để UI dễ render
        const formattedData = data?.map(visit => {
            const flatMedicines = visit.prescriptions?.flatMap((p: any) => 
                p.items.map((i: any) => ({
                    product_id: i.product?.id,
                    product_name: i.product?.name,
                    quantity: i.quantity,
                    unit_name: i.unit?.unit_name,
                    usage_note: i.usage_note,
                    product_unit_id: 1 // Fallback or need select
                }))
            ) || [];
            return { ...visit, flatMedicines };
        });

        setHistory(formattedData || []);
      } catch (err) {
        console.error("Err fetch history:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [customerId]);

  return { history, loading };
};
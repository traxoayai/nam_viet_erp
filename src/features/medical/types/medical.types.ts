// src/features/medical/types/medical.types.ts 
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface MedicalVisitRow {
  id: string;
  appointment_id: string | null;
  customer_id: number;
  doctor_id: string;
  created_by: string | null;
  updated_by: string | null;

  // === Vitals (Chỉ số sinh tồn) ===
  pulse: number | null;
  temperature: number | null;
  sp02: number | null;
  respiratory_rate: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  weight: number | null;
  height: number | null;
  bmi: number | null;
  head_circumference: number | null;
  birth_weight: number | null;
  birth_height: number | null;
  // === Specialized Exam Fields ===
  // 1. NHÓM 0-2 TUỔI
  fontanelle: string | null;
  reflexes: string | null;
  jaundice: string | null;
  feeding_status: string | null;

  // 2. NHÓM 2-6 TUỔI
  dental_status: string | null;
  motor_development: string | null;
  language_development: string | null;

  // 3. NHÓM 6-18 TUỔI
  puberty_stage: string | null;
  scoliosis_status: string | null;
  visual_acuity_left: string | null;
  visual_acuity_right: string | null;
  
  // 4. LỐI SỐNG (ADULT)
  lifestyle_alcohol: boolean | null;
  lifestyle_smoking: boolean | null;

  // === Clinical (Lâm sàng) ===
  symptoms: string | null;
  examination_summary: string | null;
  diagnosis: string | null;
  icd_code: string | null;
  doctor_notes: string | null;

  status: 'in_progress' | 'finished';
  created_at: string;
}

export interface ClinicalPrescriptionItem {
  id?: string; // Optional nếu chưa lưu
  product_id: number;
  product_name: string; // Để hiển thị UI
  product_unit_id: number; // [CRITICAL] Link kho POS
  unit_name: string;
  quantity: number;
  usage_note: string;
  stock_quantity?: number; // Để validate tồn kho
}
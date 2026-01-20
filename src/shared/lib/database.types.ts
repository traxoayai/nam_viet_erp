export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_time: string
          created_at: string | null
          customer_id: number
          doctor_id: string | null
          id: string
          note: string | null
          service_type:
            | Database["public"]["Enums"]["appointment_service_type"]
            | null
          status: Database["public"]["Enums"]["appointment_status"] | null
          symptoms: Json | null
          updated_at: string | null
        }
        Insert: {
          appointment_time: string
          created_at?: string | null
          customer_id: number
          doctor_id?: string | null
          id?: string
          note?: string | null
          service_type?:
            | Database["public"]["Enums"]["appointment_service_type"]
            | null
          status?: Database["public"]["Enums"]["appointment_status"] | null
          symptoms?: Json | null
          updated_at?: string | null
        }
        Update: {
          appointment_time?: string
          created_at?: string | null
          customer_id?: number
          doctor_id?: string | null
          id?: string
          note?: string | null
          service_type?:
            | Database["public"]["Enums"]["appointment_service_type"]
            | null
          status?: Database["public"]["Enums"]["appointment_status"] | null
          symptoms?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_maintenance_history: {
        Row: {
          asset_id: number
          content: string
          cost: number | null
          created_at: string | null
          id: number
          maintenance_date: string
        }
        Insert: {
          asset_id: number
          content: string
          cost?: number | null
          created_at?: string | null
          id?: number
          maintenance_date: string
        }
        Update: {
          asset_id?: number
          content?: string
          cost?: number | null
          created_at?: string | null
          id?: number
          maintenance_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_maintenance_plans: {
        Row: {
          asset_id: number
          assigned_user_id: string | null
          content: string
          created_at: string | null
          exec_type: Database["public"]["Enums"]["maintenance_exec_type"]
          frequency_months: number
          id: number
          provider_name: string | null
          provider_note: string | null
          provider_phone: string | null
        }
        Insert: {
          asset_id: number
          assigned_user_id?: string | null
          content: string
          created_at?: string | null
          exec_type: Database["public"]["Enums"]["maintenance_exec_type"]
          frequency_months: number
          id?: number
          provider_name?: string | null
          provider_note?: string | null
          provider_phone?: string | null
        }
        Update: {
          asset_id?: number
          assigned_user_id?: string | null
          content?: string
          created_at?: string | null
          exec_type?: Database["public"]["Enums"]["maintenance_exec_type"]
          frequency_months?: number
          id?: number
          provider_name?: string | null
          provider_note?: string | null
          provider_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_plans_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          asset_code: string | null
          asset_type_id: number | null
          branch_id: number | null
          cost: number | null
          created_at: string | null
          depreciation_months: number | null
          description: string | null
          handed_over_date: string | null
          id: number
          image_url: string | null
          name: string
          purchase_date: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["asset_status"]
          supplier_id: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          asset_code?: string | null
          asset_type_id?: number | null
          branch_id?: number | null
          cost?: number | null
          created_at?: string | null
          depreciation_months?: number | null
          description?: string | null
          handed_over_date?: string | null
          id?: number
          image_url?: string | null
          name: string
          purchase_date?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          supplier_id?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          asset_code?: string | null
          asset_type_id?: number | null
          branch_id?: number | null
          cost?: number | null
          created_at?: string | null
          depreciation_months?: number | null
          description?: string | null
          handed_over_date?: string | null
          id?: number
          image_url?: string | null
          name?: string
          purchase_date?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          supplier_id?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      banks: {
        Row: {
          bin: string
          code: string
          created_at: string | null
          id: number
          logo: string | null
          lookup_supported: boolean | null
          name: string
          short_name: string
          status: string
          transfer_supported: boolean | null
          updated_at: string | null
        }
        Insert: {
          bin: string
          code: string
          created_at?: string | null
          id?: number
          logo?: string | null
          lookup_supported?: boolean | null
          name: string
          short_name: string
          status?: string
          transfer_supported?: boolean | null
          updated_at?: string | null
        }
        Update: {
          bin?: string
          code?: string
          created_at?: string | null
          id?: number
          logo?: string | null
          lookup_supported?: boolean | null
          name?: string
          short_name?: string
          status?: string
          transfer_supported?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      batches: {
        Row: {
          batch_code: string
          created_at: string | null
          expiry_date: string
          id: number
          inbound_price: number | null
          manufacturing_date: string | null
          product_id: number | null
        }
        Insert: {
          batch_code: string
          created_at?: string | null
          expiry_date: string
          id?: number
          inbound_price?: number | null
          manufacturing_date?: string | null
          product_id?: number | null
        }
        Update: {
          batch_code?: string
          created_at?: string | null
          expiry_date?: string
          id?: number
          inbound_price?: number | null
          manufacturing_date?: string | null
          product_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_code: string
          allow_posting: boolean
          balance_type: Database["public"]["Enums"]["account_balance_type"]
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          status: Database["public"]["Enums"]["account_status"]
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string | null
        }
        Insert: {
          account_code: string
          allow_posting?: boolean
          balance_type: Database["public"]["Enums"]["account_balance_type"]
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string | null
        }
        Update: {
          account_code?: string
          allow_posting?: boolean
          balance_type?: Database["public"]["Enums"]["account_balance_type"]
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_queues: {
        Row: {
          appointment_id: string | null
          checked_in_at: string | null
          created_at: string | null
          customer_id: number
          doctor_id: string | null
          id: number
          priority_level: Database["public"]["Enums"]["queue_priority"] | null
          queue_number: number
          status: Database["public"]["Enums"]["queue_status"] | null
          updated_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          checked_in_at?: string | null
          created_at?: string | null
          customer_id: number
          doctor_id?: string | null
          id?: number
          priority_level?: Database["public"]["Enums"]["queue_priority"] | null
          queue_number: number
          status?: Database["public"]["Enums"]["queue_status"] | null
          updated_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          checked_in_at?: string | null
          created_at?: string | null
          customer_id?: number
          doctor_id?: string | null
          id?: number
          priority_level?: Database["public"]["Enums"]["queue_priority"] | null
          queue_number?: number
          status?: Database["public"]["Enums"]["queue_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_queues_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_queues_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_b2b_contacts: {
        Row: {
          created_at: string | null
          customer_b2b_id: number
          email: string | null
          id: number
          is_primary: boolean | null
          name: string
          phone: string | null
          position: string | null
        }
        Insert: {
          created_at?: string | null
          customer_b2b_id: number
          email?: string | null
          id?: number
          is_primary?: boolean | null
          name: string
          phone?: string | null
          position?: string | null
        }
        Update: {
          created_at?: string | null
          customer_b2b_id?: number
          email?: string | null
          id?: number
          is_primary?: boolean | null
          name?: string
          phone?: string | null
          position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_b2b_contacts_customer_b2b_id_fkey"
            columns: ["customer_b2b_id"]
            isOneToOne: false
            referencedRelation: "customers_b2b"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_guardians: {
        Row: {
          customer_id: number
          guardian_id: number
          id: number
          relationship: string | null
        }
        Insert: {
          customer_id: number
          guardian_id: number
          id?: number
          relationship?: string | null
        }
        Update: {
          customer_id?: number
          guardian_id?: number
          id?: number
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_guardians_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_guardians_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_segment_members: {
        Row: {
          added_at: string | null
          customer_id: number
          id: number
          segment_id: number
        }
        Insert: {
          added_at?: string | null
          customer_id: number
          id?: number
          segment_id: number
        }
        Update: {
          added_at?: string | null
          customer_id?: number
          id?: number
          segment_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_segment_members_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_segment_members_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "customer_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_segments: {
        Row: {
          created_at: string | null
          criteria: Json | null
          description: string | null
          id: number
          is_active: boolean | null
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          criteria?: Json | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          criteria?: Json | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_vouchers: {
        Row: {
          code: string
          created_at: string | null
          customer_id: number
          id: number
          promotion_id: string
          status: string
          usage_remaining: number | null
          used_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          customer_id: number
          id?: number
          promotion_id: string
          status?: string
          usage_remaining?: number | null
          used_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          customer_id?: number
          id?: number
          promotion_id?: string
          status?: string
          usage_remaining?: number | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_vouchers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_vouchers_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          allergies: string | null
          avatar_url: string | null
          cccd: string | null
          cccd_back_url: string | null
          cccd_front_url: string | null
          cccd_issue_date: string | null
          contact_person_name: string | null
          contact_person_phone: string | null
          created_at: string | null
          customer_code: string | null
          dob: string | null
          email: string | null
          gender: Database["public"]["Enums"]["customer_gender"] | null
          id: number
          last_purchase_at: string | null
          lifestyle_habits: string | null
          loyalty_points: number | null
          medical_history: string | null
          name: string
          occupation: string | null
          phone: string | null
          status: Database["public"]["Enums"]["account_status"]
          tax_code: string | null
          type: Database["public"]["Enums"]["customer_b2c_type"]
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          allergies?: string | null
          avatar_url?: string | null
          cccd?: string | null
          cccd_back_url?: string | null
          cccd_front_url?: string | null
          cccd_issue_date?: string | null
          contact_person_name?: string | null
          contact_person_phone?: string | null
          created_at?: string | null
          customer_code?: string | null
          dob?: string | null
          email?: string | null
          gender?: Database["public"]["Enums"]["customer_gender"] | null
          id?: number
          last_purchase_at?: string | null
          lifestyle_habits?: string | null
          loyalty_points?: number | null
          medical_history?: string | null
          name: string
          occupation?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          tax_code?: string | null
          type?: Database["public"]["Enums"]["customer_b2c_type"]
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          allergies?: string | null
          avatar_url?: string | null
          cccd?: string | null
          cccd_back_url?: string | null
          cccd_front_url?: string | null
          cccd_issue_date?: string | null
          contact_person_name?: string | null
          contact_person_phone?: string | null
          created_at?: string | null
          customer_code?: string | null
          dob?: string | null
          email?: string | null
          gender?: Database["public"]["Enums"]["customer_gender"] | null
          id?: number
          last_purchase_at?: string | null
          lifestyle_habits?: string | null
          loyalty_points?: number | null
          medical_history?: string | null
          name?: string
          occupation?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          tax_code?: string | null
          type?: Database["public"]["Enums"]["customer_b2c_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
      customers_b2b: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          business_license_number: string | null
          business_license_url: string | null
          created_at: string | null
          customer_code: string | null
          debt_limit: number | null
          email: string | null
          gps_lat: number | null
          gps_long: number | null
          id: number
          loyalty_points: number | null
          name: string
          payment_term: number | null
          phone: string | null
          ranking: string | null
          sales_staff_id: string | null
          shipping_address: string | null
          status: Database["public"]["Enums"]["account_status"]
          tax_code: string | null
          updated_at: string | null
          vat_address: string | null
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          business_license_number?: string | null
          business_license_url?: string | null
          created_at?: string | null
          customer_code?: string | null
          debt_limit?: number | null
          email?: string | null
          gps_lat?: number | null
          gps_long?: number | null
          id?: number
          loyalty_points?: number | null
          name: string
          payment_term?: number | null
          phone?: string | null
          ranking?: string | null
          sales_staff_id?: string | null
          shipping_address?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          tax_code?: string | null
          updated_at?: string | null
          vat_address?: string | null
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          business_license_number?: string | null
          business_license_url?: string | null
          created_at?: string | null
          customer_code?: string | null
          debt_limit?: number | null
          email?: string | null
          gps_lat?: number | null
          gps_long?: number | null
          id?: number
          loyalty_points?: number | null
          name?: string
          payment_term?: number | null
          phone?: string | null
          ranking?: string | null
          sales_staff_id?: string | null
          shipping_address?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          tax_code?: string | null
          updated_at?: string | null
          vat_address?: string | null
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          content: string | null
          created_at: string | null
          id: number
          module: Database["public"]["Enums"]["template_module"]
          name: string
          status: Database["public"]["Enums"]["account_status"]
          type: Database["public"]["Enums"]["template_type"]
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: number
          module: Database["public"]["Enums"]["template_module"]
          name: string
          status?: Database["public"]["Enums"]["account_status"]
          type: Database["public"]["Enums"]["template_type"]
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: number
          module?: Database["public"]["Enums"]["template_module"]
          name?: string
          status?: Database["public"]["Enums"]["account_status"]
          type?: Database["public"]["Enums"]["template_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
      finance_invoice_allocations: {
        Row: {
          allocated_amount: number | null
          created_at: string | null
          id: number
          invoice_id: number | null
          note: string | null
          po_id: number | null
        }
        Insert: {
          allocated_amount?: number | null
          created_at?: string | null
          id?: number
          invoice_id?: number | null
          note?: string | null
          po_id?: number | null
        }
        Update: {
          allocated_amount?: number | null
          created_at?: string | null
          id?: number
          invoice_id?: number | null
          note?: string | null
          po_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_invoice_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "finance_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_invoice_allocations_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_invoices: {
        Row: {
          created_at: string | null
          created_by: string | null
          file_type: string | null
          file_url: string
          id: number
          invoice_date: string | null
          invoice_number: string | null
          invoice_symbol: string | null
          items_json: Json | null
          parsed_data: Json | null
          status: string | null
          supplier_address_raw: string | null
          supplier_id: number | null
          supplier_name_raw: string | null
          supplier_tax_code: string | null
          tax_amount: number | null
          total_amount_post_tax: number | null
          total_amount_pre_tax: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          file_type?: string | null
          file_url: string
          id?: number
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_symbol?: string | null
          items_json?: Json | null
          parsed_data?: Json | null
          status?: string | null
          supplier_address_raw?: string | null
          supplier_id?: number | null
          supplier_name_raw?: string | null
          supplier_tax_code?: string | null
          tax_amount?: number | null
          total_amount_post_tax?: number | null
          total_amount_pre_tax?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          file_type?: string | null
          file_url?: string
          id?: number
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_symbol?: string | null
          items_json?: Json | null
          parsed_data?: Json | null
          status?: string | null
          supplier_address_raw?: string | null
          supplier_id?: number | null
          supplier_name_raw?: string | null
          supplier_tax_code?: string | null
          tax_amount?: number | null
          total_amount_post_tax?: number | null
          total_amount_pre_tax?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transactions: {
        Row: {
          amount: number
          business_type: Database["public"]["Enums"]["business_type"]
          cash_tally: Json | null
          category_id: number | null
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          evidence_url: string | null
          flow: Database["public"]["Enums"]["transaction_flow"]
          fund_account_id: number
          id: number
          partner_id: string | null
          partner_name_cache: string | null
          partner_type: string | null
          ref_advance_id: number | null
          ref_id: string | null
          ref_type: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          target_bank_info: Json | null
          transaction_date: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          business_type?: Database["public"]["Enums"]["business_type"]
          cash_tally?: Json | null
          category_id?: number | null
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          evidence_url?: string | null
          flow: Database["public"]["Enums"]["transaction_flow"]
          fund_account_id: number
          id?: number
          partner_id?: string | null
          partner_name_cache?: string | null
          partner_type?: string | null
          ref_advance_id?: number | null
          ref_id?: string | null
          ref_type?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          target_bank_info?: Json | null
          transaction_date?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          business_type?: Database["public"]["Enums"]["business_type"]
          cash_tally?: Json | null
          category_id?: number | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          evidence_url?: string | null
          flow?: Database["public"]["Enums"]["transaction_flow"]
          fund_account_id?: number
          id?: number
          partner_id?: string | null
          partner_name_cache?: string | null
          partner_type?: string | null
          ref_advance_id?: number | null
          ref_id?: string | null
          ref_type?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          target_bank_info?: Json | null
          transaction_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transaction_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_fund_account_id_fkey"
            columns: ["fund_account_id"]
            isOneToOne: false
            referencedRelation: "fund_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_ref_advance_id_fkey"
            columns: ["ref_advance_id"]
            isOneToOne: false
            referencedRelation: "finance_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      fund_accounts: {
        Row: {
          account_number: string | null
          balance: number
          bank_id: number | null
          bank_info: Json | null
          created_at: string | null
          currency: string | null
          description: string | null
          id: number
          initial_balance: number
          location: string | null
          name: string
          status: Database["public"]["Enums"]["fund_account_status"]
          type: Database["public"]["Enums"]["fund_account_type"]
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          balance?: number
          bank_id?: number | null
          bank_info?: Json | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: number
          initial_balance?: number
          location?: string | null
          name: string
          status?: Database["public"]["Enums"]["fund_account_status"]
          type: Database["public"]["Enums"]["fund_account_type"]
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          balance?: number
          bank_id?: number | null
          bank_info?: Json | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: number
          initial_balance?: number
          location?: string | null
          name?: string
          status?: Database["public"]["Enums"]["fund_account_status"]
          type?: Database["public"]["Enums"]["fund_account_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fund_accounts_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_batches: {
        Row: {
          batch_id: number | null
          id: number
          product_id: number | null
          quantity: number | null
          updated_at: string | null
          warehouse_id: number | null
        }
        Insert: {
          batch_id?: number | null
          id?: number
          product_id?: number | null
          quantity?: number | null
          updated_at?: string | null
          warehouse_id?: number | null
        }
        Update: {
          batch_id?: number | null
          id?: number
          product_id?: number | null
          quantity?: number | null
          updated_at?: string | null
          warehouse_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_check_items: {
        Row: {
          actual_quantity: number | null
          batch_code: string | null
          check_id: number
          cost_price: number | null
          diff_quantity: number | null
          difference_reason: string | null
          expiry_date: string | null
          id: number
          location_snapshot: string | null
          product_id: number
          system_quantity: number | null
        }
        Insert: {
          actual_quantity?: number | null
          batch_code?: string | null
          check_id: number
          cost_price?: number | null
          diff_quantity?: number | null
          difference_reason?: string | null
          expiry_date?: string | null
          id?: number
          location_snapshot?: string | null
          product_id: number
          system_quantity?: number | null
        }
        Update: {
          actual_quantity?: number | null
          batch_code?: string | null
          check_id?: number
          cost_price?: number | null
          diff_quantity?: number | null
          difference_reason?: string | null
          expiry_date?: string | null
          id?: number
          location_snapshot?: string | null
          product_id?: number
          system_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_check_items_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "inventory_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_check_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_checks: {
        Row: {
          code: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          id: number
          note: string | null
          status: string | null
          total_actual_value: number | null
          total_diff_value: number | null
          total_system_value: number | null
          updated_at: string | null
          verified_by: string | null
          warehouse_id: number
        }
        Insert: {
          code: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: number
          note?: string | null
          status?: string | null
          total_actual_value?: number | null
          total_diff_value?: number | null
          total_system_value?: number | null
          updated_at?: string | null
          verified_by?: string | null
          warehouse_id: number
        }
        Update: {
          code?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: number
          note?: string | null
          status?: string | null
          total_actual_value?: number | null
          total_diff_value?: number | null
          total_system_value?: number | null
          updated_at?: string | null
          verified_by?: string | null
          warehouse_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_checks_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_receipt_items: {
        Row: {
          created_at: string | null
          discount_amount: number | null
          expiry_date: string | null
          id: number
          lot_number: string | null
          product_id: number
          qc_status: string | null
          quantity: number
          receipt_id: number
          serial_number: string | null
          sub_total: number | null
          unit_price: number
          vat_rate: number | null
        }
        Insert: {
          created_at?: string | null
          discount_amount?: number | null
          expiry_date?: string | null
          id?: number
          lot_number?: string | null
          product_id: number
          qc_status?: string | null
          quantity: number
          receipt_id: number
          serial_number?: string | null
          sub_total?: number | null
          unit_price?: number
          vat_rate?: number | null
        }
        Update: {
          created_at?: string | null
          discount_amount?: number | null
          expiry_date?: string | null
          id?: number
          lot_number?: string | null
          product_id?: number
          qc_status?: string | null
          quantity?: number
          receipt_id?: number
          serial_number?: string | null
          sub_total?: number | null
          unit_price?: number
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "inventory_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_receipts: {
        Row: {
          code: string
          created_at: string | null
          creator_id: string | null
          discount_order: number | null
          final_amount: number | null
          id: number
          note: string | null
          other_fee: number | null
          po_id: number | null
          receipt_date: string | null
          shipping_fee: number | null
          status: string | null
          total_goods_amount: number | null
          updated_at: string | null
          warehouse_id: number
        }
        Insert: {
          code: string
          created_at?: string | null
          creator_id?: string | null
          discount_order?: number | null
          final_amount?: number | null
          id?: number
          note?: string | null
          other_fee?: number | null
          po_id?: number | null
          receipt_date?: string | null
          shipping_fee?: number | null
          status?: string | null
          total_goods_amount?: number | null
          updated_at?: string | null
          warehouse_id: number
        }
        Update: {
          code?: string
          created_at?: string | null
          creator_id?: string | null
          discount_order?: number | null
          final_amount?: number | null
          id?: number
          note?: string | null
          other_fee?: number | null
          po_id?: number | null
          receipt_date?: string | null
          shipping_fee?: number | null
          status?: string | null
          total_goods_amount?: number | null
          updated_at?: string | null
          warehouse_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_receipts_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          action_group: string | null
          batch_id: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: number
          note: string | null
          partner_id: number | null
          product_id: number
          quantity: number
          ref_id: string | null
          total_value: number | null
          type: string
          unit_price: number | null
          warehouse_id: number
        }
        Insert: {
          action_group?: string | null
          batch_id?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: number
          note?: string | null
          partner_id?: number | null
          product_id: number
          quantity: number
          ref_id?: string | null
          total_value?: number | null
          type: string
          unit_price?: number | null
          warehouse_id: number
        }
        Update: {
          action_group?: string | null
          batch_id?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: number
          note?: string | null
          partner_id?: number | null
          product_id?: number
          quantity?: number
          ref_id?: string | null
          total_value?: number | null
          type?: string
          unit_price?: number | null
          warehouse_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfer_batch_items: {
        Row: {
          batch_id: number
          created_at: string | null
          id: number
          quantity: number
          transfer_item_id: number
        }
        Insert: {
          batch_id: number
          created_at?: string | null
          id?: number
          quantity: number
          transfer_item_id: number
        }
        Update: {
          batch_id?: number
          created_at?: string | null
          id?: number
          quantity?: number
          transfer_item_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfer_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_batch_items_transfer_item_id_fkey"
            columns: ["transfer_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_transfer_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfer_items: {
        Row: {
          conversion_factor: number | null
          created_at: string | null
          id: number
          product_id: number
          qty_approved: number | null
          qty_received: number | null
          qty_requested: number | null
          qty_shipped: number | null
          transfer_id: number
          unit: string | null
        }
        Insert: {
          conversion_factor?: number | null
          created_at?: string | null
          id?: number
          product_id: number
          qty_approved?: number | null
          qty_received?: number | null
          qty_requested?: number | null
          qty_shipped?: number | null
          transfer_id: number
          unit?: string | null
        }
        Update: {
          conversion_factor?: number | null
          created_at?: string | null
          id?: number
          product_id?: number
          qty_approved?: number | null
          qty_received?: number | null
          qty_requested?: number | null
          qty_shipped?: number | null
          transfer_id?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "inventory_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfers: {
        Row: {
          carrier_contact: string | null
          carrier_name: string | null
          carrier_phone: string | null
          code: string
          created_at: string | null
          created_by: string | null
          dest_warehouse_id: number
          expected_arrival_at: string | null
          id: number
          is_urgent: boolean | null
          note: string | null
          packages_received: number | null
          packages_sent: number | null
          source_warehouse_id: number
          status: string
          updated_at: string | null
          urgency_approved: boolean | null
        }
        Insert: {
          carrier_contact?: string | null
          carrier_name?: string | null
          carrier_phone?: string | null
          code: string
          created_at?: string | null
          created_by?: string | null
          dest_warehouse_id: number
          expected_arrival_at?: string | null
          id?: number
          is_urgent?: boolean | null
          note?: string | null
          packages_received?: number | null
          packages_sent?: number | null
          source_warehouse_id: number
          status?: string
          updated_at?: string | null
          urgency_approved?: boolean | null
        }
        Update: {
          carrier_contact?: string | null
          carrier_name?: string | null
          carrier_phone?: string | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          dest_warehouse_id?: number
          expected_arrival_at?: string | null
          id?: number
          is_urgent?: boolean | null
          note?: string | null
          packages_received?: number | null
          packages_sent?: number | null
          source_warehouse_id?: number
          status?: string
          updated_at?: string | null
          urgency_approved?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfers_dest_warehouse_id_fkey"
            columns: ["dest_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_source_warehouse_id_fkey"
            columns: ["source_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          base_quantity: number | null
          batch_no: string | null
          conversion_factor: number | null
          created_at: string | null
          discount: number | null
          expiry_date: string | null
          id: string
          is_gift: boolean | null
          note: string | null
          order_id: string
          product_id: number
          quantity: number
          quantity_picked: number | null
          total_line: number | null
          unit_price: number
          uom: string
        }
        Insert: {
          base_quantity?: number | null
          batch_no?: string | null
          conversion_factor?: number | null
          created_at?: string | null
          discount?: number | null
          expiry_date?: string | null
          id?: string
          is_gift?: boolean | null
          note?: string | null
          order_id: string
          product_id: number
          quantity: number
          quantity_picked?: number | null
          total_line?: number | null
          unit_price: number
          uom: string
        }
        Update: {
          base_quantity?: number | null
          batch_no?: string | null
          conversion_factor?: number | null
          created_at?: string | null
          discount?: number | null
          expiry_date?: string | null
          id?: string
          is_gift?: boolean | null
          note?: string | null
          order_id?: string
          product_id?: number
          quantity?: number
          quantity_picked?: number | null
          total_line?: number | null
          unit_price?: number
          uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          code: string
          created_at: string | null
          creator_id: string | null
          customer_b2c_id: number | null
          customer_id: number | null
          delivery_address: string | null
          delivery_method: string | null
          delivery_time: string | null
          discount_amount: number | null
          fee_payer: string | null
          final_amount: number | null
          id: string
          invoice_request_data: Json | null
          invoice_status:
            | Database["public"]["Enums"]["invoice_request_status"]
            | null
          note: string | null
          order_type: string | null
          package_count: number | null
          paid_amount: number | null
          payment_method: string | null
          payment_status: string | null
          quote_expires_at: string | null
          remittance_status: string | null
          remittance_transaction_id: number | null
          shipping_fee: number | null
          shipping_partner_id: number | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
          warehouse_id: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          creator_id?: string | null
          customer_b2c_id?: number | null
          customer_id?: number | null
          delivery_address?: string | null
          delivery_method?: string | null
          delivery_time?: string | null
          discount_amount?: number | null
          fee_payer?: string | null
          final_amount?: number | null
          id?: string
          invoice_request_data?: Json | null
          invoice_status?:
            | Database["public"]["Enums"]["invoice_request_status"]
            | null
          note?: string | null
          order_type?: string | null
          package_count?: number | null
          paid_amount?: number | null
          payment_method?: string | null
          payment_status?: string | null
          quote_expires_at?: string | null
          remittance_status?: string | null
          remittance_transaction_id?: number | null
          shipping_fee?: number | null
          shipping_partner_id?: number | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          warehouse_id?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          creator_id?: string | null
          customer_b2c_id?: number | null
          customer_id?: number | null
          delivery_address?: string | null
          delivery_method?: string | null
          delivery_time?: string | null
          discount_amount?: number | null
          fee_payer?: string | null
          final_amount?: number | null
          id?: string
          invoice_request_data?: Json | null
          invoice_status?:
            | Database["public"]["Enums"]["invoice_request_status"]
            | null
          note?: string | null
          order_type?: string | null
          package_count?: number | null
          paid_amount?: number | null
          payment_method?: string | null
          payment_status?: string | null
          quote_expires_at?: string | null
          remittance_status?: string | null
          remittance_transaction_id?: number | null
          shipping_fee?: number | null
          shipping_partner_id?: number | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          warehouse_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_b2b_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_b2b"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_b2c_id_fkey"
            columns: ["customer_b2c_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_remittance_transaction_id_fkey"
            columns: ["remittance_transaction_id"]
            isOneToOne: false
            referencedRelation: "finance_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_partner_id_fkey"
            columns: ["shipping_partner_id"]
            isOneToOne: false
            referencedRelation: "shipping_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          key: string
          module: string
          name: string
        }
        Insert: {
          key: string
          module: string
          name: string
        }
        Update: {
          key?: string
          module?: string
          name?: string
        }
        Relationships: []
      }
      prescription_template_items: {
        Row: {
          id: number
          product_id: number
          quantity: number
          template_id: number
          usage_instruction: string
        }
        Insert: {
          id?: number
          product_id: number
          quantity: number
          template_id: number
          usage_instruction: string
        }
        Update: {
          id?: number
          product_id?: number
          quantity?: number
          template_id?: number
          usage_instruction?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_template_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "prescription_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_templates: {
        Row: {
          created_at: string
          diagnosis: string | null
          id: number
          name: string
          note: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          diagnosis?: string | null
          id?: number
          name: string
          note?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          diagnosis?: string | null
          id?: number
          name?: string
          note?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_activity_logs: {
        Row: {
          action_type: string | null
          created_at: string | null
          id: number
          new_value: string | null
          note: string | null
          old_value: string | null
          product_id: number | null
          user_id: string | null
        }
        Insert: {
          action_type?: string | null
          created_at?: string | null
          id?: number
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          product_id?: number | null
          user_id?: string | null
        }
        Update: {
          action_type?: string | null
          created_at?: string | null
          id?: number
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          product_id?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      product_contents: {
        Row: {
          channel: string
          description_html: string | null
          id: number
          images: Json | null
          is_published: boolean | null
          language_code: string | null
          product_id: number | null
          seo_description: string | null
          seo_keywords: string[] | null
          seo_title: string | null
          short_description: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          channel: string
          description_html?: string | null
          id?: number
          images?: Json | null
          is_published?: boolean | null
          language_code?: string | null
          product_id?: number | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          short_description?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          channel?: string
          description_html?: string | null
          id?: number
          images?: Json | null
          is_published?: boolean | null
          language_code?: string | null
          product_id?: number | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          short_description?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_contents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_inventory: {
        Row: {
          id: number
          location_cabinet: string | null
          location_row: string | null
          location_slot: string | null
          max_stock: number | null
          min_stock: number | null
          product_id: number
          shelf_location: string | null
          stock_quantity: number
          updated_at: string | null
          updated_by: string | null
          warehouse_id: number
        }
        Insert: {
          id?: number
          location_cabinet?: string | null
          location_row?: string | null
          location_slot?: string | null
          max_stock?: number | null
          min_stock?: number | null
          product_id: number
          shelf_location?: string | null
          stock_quantity?: number
          updated_at?: string | null
          updated_by?: string | null
          warehouse_id: number
        }
        Update: {
          id?: number
          location_cabinet?: string | null
          location_row?: string | null
          location_slot?: string | null
          max_stock?: number | null
          min_stock?: number | null
          product_id?: number
          shelf_location?: string | null
          stock_quantity?: number
          updated_at?: string | null
          updated_by?: string | null
          warehouse_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_units: {
        Row: {
          barcode: string | null
          conversion_rate: number | null
          created_at: string | null
          id: number
          is_base: boolean | null
          is_direct_sale: boolean | null
          price: number | null
          price_cost: number | null
          price_sell: number | null
          product_id: number | null
          unit_name: string
          unit_type: string | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          conversion_rate?: number | null
          created_at?: string | null
          id?: number
          is_base?: boolean | null
          is_direct_sale?: boolean | null
          price?: number | null
          price_cost?: number | null
          price_sell?: number | null
          product_id?: number | null
          unit_name: string
          unit_type?: string | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          conversion_rate?: number | null
          created_at?: string | null
          id?: number
          is_base?: boolean | null
          is_direct_sale?: boolean | null
          price?: number | null
          price_cost?: number | null
          price_sell?: number | null
          product_id?: number | null
          unit_name?: string
          unit_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active_ingredient: string | null
          actual_cost: number
          barcode: string | null
          carton_dimensions: string | null
          carton_weight: number | null
          category_name: string | null
          conversion_factor: number | null
          created_at: string | null
          description: string | null
          distributor_id: number | null
          fts: unknown
          id: number
          image_url: string | null
          invoice_price: number | null
          items_per_carton: number | null
          manufacturer_name: string | null
          name: string
          packing_spec: string | null
          purchasing_policy: string | null
          registration_number: string | null
          retail_margin_rate: number | null
          retail_margin_type: string | null
          retail_margin_value: number | null
          retail_unit: string | null
          sku: string | null
          status: string
          stock_management_type:
            | Database["public"]["Enums"]["stock_management_type"]
            | null
          updated_at: string | null
          updated_by: string | null
          usage_instructions: Json | null
          wholesale_margin_rate: number | null
          wholesale_margin_type: string | null
          wholesale_margin_value: number | null
          wholesale_unit: string | null
        }
        Insert: {
          active_ingredient?: string | null
          actual_cost?: number
          barcode?: string | null
          carton_dimensions?: string | null
          carton_weight?: number | null
          category_name?: string | null
          conversion_factor?: number | null
          created_at?: string | null
          description?: string | null
          distributor_id?: number | null
          fts?: unknown
          id?: number
          image_url?: string | null
          invoice_price?: number | null
          items_per_carton?: number | null
          manufacturer_name?: string | null
          name: string
          packing_spec?: string | null
          purchasing_policy?: string | null
          registration_number?: string | null
          retail_margin_rate?: number | null
          retail_margin_type?: string | null
          retail_margin_value?: number | null
          retail_unit?: string | null
          sku?: string | null
          status?: string
          stock_management_type?:
            | Database["public"]["Enums"]["stock_management_type"]
            | null
          updated_at?: string | null
          updated_by?: string | null
          usage_instructions?: Json | null
          wholesale_margin_rate?: number | null
          wholesale_margin_type?: string | null
          wholesale_margin_value?: number | null
          wholesale_unit?: string | null
        }
        Update: {
          active_ingredient?: string | null
          actual_cost?: number
          barcode?: string | null
          carton_dimensions?: string | null
          carton_weight?: number | null
          category_name?: string | null
          conversion_factor?: number | null
          created_at?: string | null
          description?: string | null
          distributor_id?: number | null
          fts?: unknown
          id?: number
          image_url?: string | null
          invoice_price?: number | null
          items_per_carton?: number | null
          manufacturer_name?: string | null
          name?: string
          packing_spec?: string | null
          purchasing_policy?: string | null
          registration_number?: string | null
          retail_margin_rate?: number | null
          retail_margin_type?: string | null
          retail_margin_value?: number | null
          retail_unit?: string | null
          sku?: string | null
          status?: string
          stock_management_type?:
            | Database["public"]["Enums"]["stock_management_type"]
            | null
          updated_at?: string | null
          updated_by?: string | null
          usage_instructions?: Json | null
          wholesale_margin_rate?: number | null
          wholesale_margin_type?: string | null
          wholesale_margin_value?: number | null
          wholesale_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_targets: {
        Row: {
          created_at: string | null
          id: number
          promotion_id: string
          target_id: number
          target_type: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          promotion_id: string
          target_id: number
          target_type: string
        }
        Update: {
          created_at?: string | null
          id?: number
          promotion_id?: string
          target_id?: number
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_targets_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_usages: {
        Row: {
          created_at: string | null
          customer_id: number
          id: string
          order_id: string | null
          promotion_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id: number
          id?: string
          order_id?: string | null
          promotion_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: number
          id?: string
          order_id?: string | null
          promotion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_usages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_usages_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          apply_to_ids: Json | null
          apply_to_scope: string | null
          code: string
          created_at: string | null
          customer_id: number | null
          customer_type: string | null
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          max_discount_value: number | null
          min_order_value: number | null
          name: string
          status: string | null
          total_usage_limit: number | null
          type: string
          usage_count: number | null
          usage_limit_per_user: number | null
          valid_from: string
          valid_to: string
        }
        Insert: {
          apply_to_ids?: Json | null
          apply_to_scope?: string | null
          code: string
          created_at?: string | null
          customer_id?: number | null
          customer_type?: string | null
          description?: string | null
          discount_type: string
          discount_value?: number
          id?: string
          max_discount_value?: number | null
          min_order_value?: number | null
          name: string
          status?: string | null
          total_usage_limit?: number | null
          type: string
          usage_count?: number | null
          usage_limit_per_user?: number | null
          valid_from?: string
          valid_to: string
        }
        Update: {
          apply_to_ids?: Json | null
          apply_to_scope?: string | null
          code?: string
          created_at?: string | null
          customer_id?: number | null
          customer_type?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          max_discount_value?: number | null
          min_order_value?: number | null
          name?: string
          status?: string | null
          total_usage_limit?: number | null
          type?: string
          usage_count?: number | null
          usage_limit_per_user?: number | null
          valid_from?: string
          valid_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          base_quantity: number | null
          conversion_factor: number | null
          created_at: string | null
          id: number
          po_id: number
          product_id: number
          quantity_ordered: number
          quantity_received: number | null
          unit: string | null
          unit_price: number
          uom_ordered: string | null
        }
        Insert: {
          base_quantity?: number | null
          conversion_factor?: number | null
          created_at?: string | null
          id?: number
          po_id: number
          product_id: number
          quantity_ordered: number
          quantity_received?: number | null
          unit?: string | null
          unit_price: number
          uom_ordered?: string | null
        }
        Update: {
          base_quantity?: number | null
          conversion_factor?: number | null
          created_at?: string | null
          id?: number
          po_id?: number
          product_id?: number
          quantity_ordered?: number
          quantity_received?: number | null
          unit?: string | null
          unit_price?: number
          uom_ordered?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          carrier_contact: string | null
          carrier_name: string | null
          carrier_phone: string | null
          code: string
          created_at: string
          creator_id: string | null
          delivery_method: string | null
          delivery_status: string | null
          discount_amount: number | null
          expected_delivery_date: string | null
          expected_delivery_time: string | null
          final_amount: number
          id: number
          note: string | null
          payment_status: string | null
          shipping_fee: number | null
          shipping_partner_id: number | null
          status: string | null
          supplier_id: number
          total_amount: number
          total_packages: number | null
          total_paid: number | null
          updated_at: string
        }
        Insert: {
          carrier_contact?: string | null
          carrier_name?: string | null
          carrier_phone?: string | null
          code: string
          created_at?: string
          creator_id?: string | null
          delivery_method?: string | null
          delivery_status?: string | null
          discount_amount?: number | null
          expected_delivery_date?: string | null
          expected_delivery_time?: string | null
          final_amount?: number
          id?: number
          note?: string | null
          payment_status?: string | null
          shipping_fee?: number | null
          shipping_partner_id?: number | null
          status?: string | null
          supplier_id: number
          total_amount?: number
          total_packages?: number | null
          total_paid?: number | null
          updated_at?: string
        }
        Update: {
          carrier_contact?: string | null
          carrier_name?: string | null
          carrier_phone?: string | null
          code?: string
          created_at?: string
          creator_id?: string | null
          delivery_method?: string | null
          delivery_status?: string | null
          discount_amount?: number | null
          expected_delivery_date?: string | null
          expected_delivery_time?: string | null
          final_amount?: number
          id?: number
          note?: string | null
          payment_status?: string | null
          shipping_fee?: number | null
          shipping_partner_id?: number | null
          status?: string | null
          supplier_id?: number
          total_amount?: number
          total_packages?: number | null
          total_paid?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_shipping_partner_id_fkey"
            columns: ["shipping_partner_id"]
            isOneToOne: false
            referencedRelation: "shipping_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_key: string
          role_id: string
        }
        Insert: {
          permission_key: string
          role_id: string
        }
        Update: {
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      sales_invoices: {
        Row: {
          buyer_address: string | null
          buyer_company_name: string | null
          buyer_email: string | null
          buyer_name: string | null
          buyer_tax_code: string | null
          created_at: string | null
          customer_b2c_id: number | null
          customer_id: number | null
          final_amount: number | null
          id: number
          invoice_date: string
          invoice_number: string | null
          invoice_serial: string | null
          invoice_template_code: string | null
          note: string | null
          order_id: string | null
          payment_method: string | null
          total_amount_pre_tax: number | null
          updated_at: string | null
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          buyer_address?: string | null
          buyer_company_name?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_tax_code?: string | null
          created_at?: string | null
          customer_b2c_id?: number | null
          customer_id?: number | null
          final_amount?: number | null
          id?: number
          invoice_date: string
          invoice_number?: string | null
          invoice_serial?: string | null
          invoice_template_code?: string | null
          note?: string | null
          order_id?: string | null
          payment_method?: string | null
          total_amount_pre_tax?: number | null
          updated_at?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          buyer_address?: string | null
          buyer_company_name?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_tax_code?: string | null
          created_at?: string | null
          customer_b2c_id?: number | null
          customer_id?: number | null
          final_amount?: number | null
          id?: number
          invoice_date?: string
          invoice_number?: string | null
          invoice_serial?: string | null
          invoice_template_code?: string | null
          note?: string | null
          order_id?: string | null
          payment_method?: string | null
          total_amount_pre_tax?: number | null
          updated_at?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_customer_b2c_id_fkey"
            columns: ["customer_b2c_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_b2b"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_consumables: {
        Row: {
          consumable_product_id: number | null
          created_at: string | null
          id: number
          quantity: number | null
          service_product_id: number | null
        }
        Insert: {
          consumable_product_id?: number | null
          created_at?: string | null
          id?: number
          quantity?: number | null
          service_product_id?: number | null
        }
        Update: {
          consumable_product_id?: number | null
          created_at?: string | null
          id?: number
          quantity?: number | null
          service_product_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_consumables_consumable_product_id_fkey"
            columns: ["consumable_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_consumables_service_product_id_fkey"
            columns: ["service_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      service_package_items: {
        Row: {
          id: number
          item_id: number
          item_type: string
          package_id: number
          quantity: number
          schedule_days: number | null
        }
        Insert: {
          id?: number
          item_id: number
          item_type?: string
          package_id: number
          quantity?: number
          schedule_days?: number | null
        }
        Update: {
          id?: number
          item_id?: number
          item_type?: string
          package_id?: number
          quantity?: number
          schedule_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_package_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_package_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      service_packages: {
        Row: {
          applicable_branches: number[] | null
          applicable_channels: string
          created_at: string | null
          id: number
          name: string
          price: number
          revenue_account_id: string | null
          sku: string
          status: Database["public"]["Enums"]["account_status"]
          total_cost_price: number
          type: Database["public"]["Enums"]["service_package_type"]
          unit: string
          updated_at: string | null
          valid_from: string
          valid_to: string
          validity_days: number | null
        }
        Insert: {
          applicable_branches?: number[] | null
          applicable_channels?: string
          created_at?: string | null
          id?: number
          name: string
          price?: number
          revenue_account_id?: string | null
          sku: string
          status?: Database["public"]["Enums"]["account_status"]
          total_cost_price?: number
          type?: Database["public"]["Enums"]["service_package_type"]
          unit?: string
          updated_at?: string | null
          valid_from: string
          valid_to: string
          validity_days?: number | null
        }
        Update: {
          applicable_branches?: number[] | null
          applicable_channels?: string
          created_at?: string | null
          id?: number
          name?: string
          price?: number
          revenue_account_id?: string | null
          sku?: string
          status?: Database["public"]["Enums"]["account_status"]
          total_cost_price?: number
          type?: Database["public"]["Enums"]["service_package_type"]
          unit?: string
          updated_at?: string | null
          valid_from?: string
          valid_to?: string
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_packages_revenue_account_id_fkey"
            columns: ["revenue_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["account_code"]
          },
        ]
      }
      shipping_partners: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string | null
          cut_off_time: string | null
          email: string | null
          id: number
          name: string
          notes: string | null
          phone: string | null
          status: Database["public"]["Enums"]["account_status"]
          type: Database["public"]["Enums"]["shipping_partner_type"]
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          cut_off_time?: string | null
          email?: string | null
          id?: number
          name: string
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          type?: Database["public"]["Enums"]["shipping_partner_type"]
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          cut_off_time?: string | null
          email?: string | null
          id?: number
          name?: string
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          type?: Database["public"]["Enums"]["shipping_partner_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
      shipping_rules: {
        Row: {
          fee: number | null
          id: number
          partner_id: number
          speed_hours: number | null
          zone_name: string
        }
        Insert: {
          fee?: number | null
          id?: number
          partner_id: number
          speed_hours?: number | null
          zone_name: string
        }
        Update: {
          fee?: number | null
          id?: number
          partner_id?: number
          speed_hours?: number | null
          zone_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rules_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "shipping_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          bank_account: string | null
          bank_bin: string | null
          bank_holder: string | null
          bank_name: string | null
          contact_person: string | null
          created_at: string | null
          delivery_method: string | null
          email: string | null
          id: number
          lead_time: number | null
          name: string
          notes: string | null
          payment_term: string | null
          phone: string | null
          status: string
          tax_code: string | null
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          bank_bin?: string | null
          bank_holder?: string | null
          bank_name?: string | null
          contact_person?: string | null
          created_at?: string | null
          delivery_method?: string | null
          email?: string | null
          id?: number
          lead_time?: number | null
          name: string
          notes?: string | null
          payment_term?: string | null
          phone?: string | null
          status?: string
          tax_code?: string | null
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          bank_bin?: string | null
          bank_holder?: string | null
          bank_name?: string | null
          contact_person?: string | null
          created_at?: string | null
          delivery_method?: string | null
          email?: string | null
          id?: number
          lead_time?: number | null
          name?: string
          notes?: string | null
          payment_term?: string | null
          phone?: string | null
          status?: string
          tax_code?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      transaction_categories: {
        Row: {
          account_id: string | null
          code: string
          created_at: string | null
          description: string | null
          id: number
          name: string
          status: Database["public"]["Enums"]["account_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          id?: number
          name: string
          status?: Database["public"]["Enums"]["account_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
          status?: Database["public"]["Enums"]["account_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_categories_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["account_code"]
          },
        ]
      }
      user_roles: {
        Row: {
          branch_id: number
          created_at: string | null
          id: number
          role_id: string
          user_id: string
        }
        Insert: {
          branch_id: number
          created_at?: string | null
          id?: number
          role_id: string
          user_id: string
        }
        Update: {
          branch_id?: number
          created_at?: string | null
          id?: number
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          address: string | null
          avatar_url: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          cccd: string | null
          cccd_back_url: string | null
          cccd_front_url: string | null
          cccd_issue_date: string | null
          created_at: string | null
          dob: string | null
          education_level: string | null
          email: string | null
          employee_code: string | null
          full_name: string | null
          gender: string | null
          hobbies: string | null
          id: string
          limitations: string | null
          marital_status: string | null
          needs: string | null
          phone: string | null
          position: string | null
          profile_updated_at: string | null
          specialization: string | null
          status: Database["public"]["Enums"]["employee_status"]
          strengths: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          cccd?: string | null
          cccd_back_url?: string | null
          cccd_front_url?: string | null
          cccd_issue_date?: string | null
          created_at?: string | null
          dob?: string | null
          education_level?: string | null
          email?: string | null
          employee_code?: string | null
          full_name?: string | null
          gender?: string | null
          hobbies?: string | null
          id: string
          limitations?: string | null
          marital_status?: string | null
          needs?: string | null
          phone?: string | null
          position?: string | null
          profile_updated_at?: string | null
          specialization?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          strengths?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          cccd?: string | null
          cccd_back_url?: string | null
          cccd_front_url?: string | null
          cccd_issue_date?: string | null
          created_at?: string | null
          dob?: string | null
          education_level?: string | null
          email?: string | null
          employee_code?: string | null
          full_name?: string | null
          gender?: string | null
          hobbies?: string | null
          id?: string
          limitations?: string | null
          marital_status?: string | null
          needs?: string | null
          phone?: string | null
          position?: string | null
          profile_updated_at?: string | null
          specialization?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          strengths?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vaccination_template_items: {
        Row: {
          days_after_start: number | null
          id: number
          note: string | null
          product_id: number
          shot_name: string
          template_id: number
        }
        Insert: {
          days_after_start?: number | null
          id?: number
          note?: string | null
          product_id: number
          shot_name: string
          template_id: number
        }
        Update: {
          days_after_start?: number | null
          id?: number
          note?: string | null
          product_id?: number
          shot_name?: string
          template_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "vaccination_template_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "vaccination_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccination_templates: {
        Row: {
          created_at: string
          description: string | null
          id: number
          max_age_months: number | null
          min_age_months: number | null
          name: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          max_age_months?: number | null
          min_age_months?: number | null
          name: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          max_age_months?: number | null
          min_age_months?: number | null
          name?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vat_inventory_ledger: {
        Row: {
          id: number
          product_id: number
          quantity_balance: number
          total_value_balance: number
          updated_at: string | null
          vat_rate: number
        }
        Insert: {
          id?: number
          product_id: number
          quantity_balance?: number
          total_value_balance?: number
          updated_at?: string | null
          vat_rate?: number
        }
        Update: {
          id?: number
          product_id?: number
          quantity_balance?: number
          total_value_balance?: number
          updated_at?: string | null
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "vat_inventory_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_product_mappings: {
        Row: {
          created_at: string | null
          id: number
          internal_product_id: number
          internal_unit: string | null
          last_used_at: string | null
          updated_by: string | null
          vendor_product_name: string
          vendor_tax_code: string
          vendor_unit: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          internal_product_id: number
          internal_unit?: string | null
          last_used_at?: string | null
          updated_by?: string | null
          vendor_product_name: string
          vendor_tax_code: string
          vendor_unit?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          internal_product_id?: number
          internal_unit?: string | null
          last_used_at?: string | null
          updated_by?: string | null
          vendor_product_name?: string
          vendor_tax_code?: string
          vendor_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_product_mappings_internal_product_id_fkey"
            columns: ["internal_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          code: string | null
          created_at: string | null
          id: number
          key: string
          latitude: number | null
          longitude: number | null
          manager: string | null
          name: string
          phone: string | null
          status: string
          type: string
          unit: string
        }
        Insert: {
          address?: string | null
          code?: string | null
          created_at?: string | null
          id?: number
          key: string
          latitude?: number | null
          longitude?: number | null
          manager?: string | null
          name: string
          phone?: string | null
          status?: string
          type?: string
          unit?: string
        }
        Update: {
          address?: string | null
          code?: string | null
          created_at?: string | null
          id?: number
          key?: string
          latitude?: number | null
          longitude?: number | null
          manager?: string | null
          name?: string
          phone?: string | null
          status?: string
          type?: string
          unit?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_user: { Args: { p_user_id: string }; Returns: undefined }
      auto_create_purchase_orders_min_max: { Args: never; Returns: number }
      bulk_update_product_strategy: {
        Args: { p_product_ids: number[]; p_strategy_type: string }
        Returns: undefined
      }
      bulk_update_product_units_for_quick_unit_page: {
        Args: { p_data: Json }
        Returns: undefined
      }
      bulk_upsert_customers_b2b: {
        Args: { p_customers_array: Json[] }
        Returns: undefined
      }
      bulk_upsert_customers_b2c: {
        Args: { p_customers_array: Json[] }
        Returns: undefined
      }
      bulk_upsert_products: {
        Args: { p_products_array: Json }
        Returns: undefined
      }
      calculate_carton_breakdown: {
        Args: { p_product_id: number; p_required_qty: number }
        Returns: Json
      }
      calculate_package_cost: { Args: { p_items: Json }; Returns: number }
      cancel_inventory_check: {
        Args: { p_check_id: number; p_user_id: string }
        Returns: undefined
      }
      cancel_outbound_task: {
        Args: { p_order_id: string; p_reason: string; p_user_id: string }
        Returns: Json
      }
      check_in_patient: {
        Args: {
          p_customer_id: number
          p_doctor_id?: string
          p_notes?: string
          p_priority?: string
          p_symptoms?: Json
        }
        Returns: Json
      }
      check_invoice_exists: {
        Args: { p_number: string; p_symbol: string; p_tax_code: string }
        Returns: boolean
      }
      check_product_dependencies: {
        Args: { p_product_ids: number[] }
        Returns: Json
      }
      check_vat_availability: {
        Args: {
          p_product_id: number
          p_qty_requested: number
          p_vat_rate: number
        }
        Returns: boolean
      }
      complete_inventory_check: {
        Args: { p_check_id: number; p_user_id: string }
        Returns: undefined
      }
      confirm_finance_transaction:
        | { Args: { p_id: number }; Returns: undefined }
        | { Args: { p_id: number; p_target_status: string }; Returns: boolean }
      confirm_order_payment: {
        Args: { p_fund_account_id: number; p_order_ids: string[] }
        Returns: Json
      }
      confirm_outbound_packing: { Args: { p_order_id: string }; Returns: Json }
      confirm_purchase_order: {
        Args: { p_po_id: number; p_status: string }
        Returns: boolean
      }
      confirm_purchase_payment: {
        Args: {
          p_amount: number
          p_fund_account_id: number
          p_note?: string
          p_order_id: number
          p_payment_method?: string
        }
        Returns: Json
      }
      confirm_transaction: { Args: { p_id: number }; Returns: boolean }
      create_appointment_booking: {
        Args: {
          p_customer_id: number
          p_doctor_id?: string
          p_note?: string
          p_status?: string
          p_symptoms?: Json
          p_time?: string
          p_type?: string
        }
        Returns: Json
      }
      create_asset: {
        Args: {
          p_asset_data: Json
          p_maintenance_history: Json
          p_maintenance_plans: Json
        }
        Returns: number
      }
      create_auto_replenishment_request: {
        Args: { p_dest_warehouse_id: number; p_note?: string }
        Returns: Json
      }
      create_customer_b2b: {
        Args: { p_contacts: Json[]; p_customer_data: Json }
        Returns: number
      }
      create_customer_b2c: {
        Args: { p_customer_data: Json; p_guardians: Json }
        Returns: number
      }
      create_draft_po:
        | {
            Args: {
              p_delivery_method?: string
              p_expected_date: string
              p_items?: Json
              p_note: string
              p_shipping_fee?: number
              p_shipping_partner_id?: number
              p_supplier_id: number
            }
            Returns: number
          }
        | {
            Args: {
              p_expected_date: string
              p_items: Json
              p_note: string
              p_supplier_id: number
            }
            Returns: number
          }
      create_finance_transaction: {
        Args: {
          p_amount: number
          p_business_type: string
          p_cash_tally?: Json
          p_category_id?: number
          p_code?: string
          p_created_by?: string
          p_description?: string
          p_evidence_url?: string
          p_flow?: string
          p_fund_id?: number
          p_partner_id?: string
          p_partner_name?: string
          p_partner_type?: string
          p_ref_advance_id?: number
          p_ref_id?: string
          p_ref_type?: string
          p_status?: string
          p_target_bank_info?: Json
          p_transaction_date?: string
        }
        Returns: number
      }
      create_inventory_check: {
        Args: {
          p_int_val?: number
          p_note?: string
          p_scope?: string
          p_text_val?: string
          p_user_id: string
          p_warehouse_id: number
        }
        Returns: number
      }
      create_inventory_receipt: {
        Args: {
          p_items: Json
          p_note: string
          p_po_id: number
          p_warehouse_id: number
        }
        Returns: number
      }
      create_new_auth_user: {
        Args: { p_email: string; p_full_name: string; p_password: string }
        Returns: string
      }
      create_prescription_template: {
        Args: { p_data: Json; p_items: Json }
        Returns: number
      }
      create_product:
        | {
            Args: {
              p_active_ingredient?: string
              p_actual_cost?: number
              p_barcode?: string
              p_carton_dimensions?: string
              p_carton_weight?: number
              p_category_name?: string
              p_conversion_factor?: number
              p_distributor_id?: number
              p_image_url?: string
              p_inventory_settings?: Json
              p_invoice_price?: number
              p_items_per_carton?: number
              p_manufacturer_name?: string
              p_name?: string
              p_purchasing_policy?: string
              p_retail_margin_type?: string
              p_retail_margin_value?: number
              p_retail_unit?: string
              p_sku?: string
              p_status?: string
              p_wholesale_margin_type?: string
              p_wholesale_margin_value?: number
              p_wholesale_unit?: string
            }
            Returns: number
          }
        | {
            Args: {
              p_active_ingredient?: string
              p_actual_cost?: number
              p_barcode?: string
              p_carton_dimensions?: string
              p_carton_weight?: number
              p_category_name?: string
              p_conversion_factor?: number
              p_description?: string
              p_distributor_id?: number
              p_image_url?: string
              p_inventory_settings?: Json
              p_invoice_price?: number
              p_items_per_carton?: number
              p_manufacturer_name?: string
              p_name?: string
              p_packing_spec?: string
              p_purchasing_policy?: string
              p_registration_number?: string
              p_retail_margin_type?: string
              p_retail_margin_value?: number
              p_retail_unit?: string
              p_sku?: string
              p_status?: string
              p_wholesale_margin_type?: string
              p_wholesale_margin_value?: number
              p_wholesale_unit?: string
            }
            Returns: number
          }
        | {
            Args: {
              p_active_ingredient: string
              p_actual_cost: number
              p_barcode: string
              p_category_name: string
              p_conversion_factor: number
              p_distributor_id: number
              p_image_url: string
              p_inventory_settings: Json
              p_invoice_price: number
              p_items_per_carton: number
              p_manufacturer_name: string
              p_name: string
              p_retail_margin_type: string
              p_retail_margin_value: number
              p_retail_unit: string
              p_sku: string
              p_status: string
              p_wholesale_margin_type: string
              p_wholesale_margin_value: number
              p_wholesale_unit: string
            }
            Returns: number
          }
      create_purchase_order: {
        Args: { p_data: Json; p_items: Json }
        Returns: number
      }
      create_sales_order:
        | {
            Args: {
              p_customer_b2b_id?: number
              p_customer_b2c_id?: number
              p_delivery_address?: string
              p_delivery_method?: string
              p_delivery_time?: string
              p_discount_amount?: number
              p_items?: Json
              p_note?: string
              p_order_type?: string
              p_payment_method?: string
              p_shipping_fee?: number
              p_shipping_partner_id?: number
              p_status?: string
              p_warehouse_id?: number
            }
            Returns: string
          }
        | {
            Args: {
              p_customer_id: number
              p_delivery_address: string
              p_delivery_method?: string
              p_delivery_time: string
              p_discount_amount?: number
              p_items: Json
              p_note: string
              p_shipping_fee?: number
              p_shipping_partner_id?: number
              p_status?: Database["public"]["Enums"]["order_status"]
              p_warehouse_id?: number
            }
            Returns: string
          }
      create_service_package: {
        Args: { p_data: Json; p_items: Json }
        Returns: number
      }
      create_shipping_partner: {
        Args: { p_partner_data: Json; p_rules: Json[] }
        Returns: number
      }
      create_supplier: {
        Args: {
          p_address: string
          p_bank_account: string
          p_bank_holder: string
          p_bank_name: string
          p_contact_person: string
          p_delivery_method: string
          p_email: string
          p_lead_time: number
          p_name: string
          p_notes: string
          p_payment_term: string
          p_phone: string
          p_status: string
          p_tax_code: string
        }
        Returns: number
      }
      create_vaccination_template: {
        Args: { p_data: Json; p_items: Json }
        Returns: number
      }
      delete_asset: { Args: { p_id: number }; Returns: undefined }
      delete_auth_user: { Args: { p_user_id: string }; Returns: undefined }
      delete_customer_b2b: { Args: { p_id: number }; Returns: undefined }
      delete_customer_b2c: { Args: { p_id: number }; Returns: undefined }
      delete_prescription_template: { Args: { p_id: number }; Returns: boolean }
      delete_products: { Args: { p_ids: number[] }; Returns: undefined }
      delete_purchase_order: { Args: { p_id: number }; Returns: boolean }
      delete_service_packages: { Args: { p_ids: number[] }; Returns: undefined }
      delete_shipping_partner: { Args: { p_id: number }; Returns: undefined }
      delete_supplier: { Args: { p_id: number }; Returns: undefined }
      delete_vaccination_template: { Args: { p_id: number }; Returns: boolean }
      distribute_voucher_to_segment: {
        Args: { p_promotion_id: string; p_segment_id: number }
        Returns: number
      }
      export_customers_b2b_list: {
        Args: {
          sales_staff_filter: string
          search_query: string
          status_filter: string
        }
        Returns: {
          contact_person_name: string
          contact_person_phone: string
          customer_code: string
          debt_limit: number
          email: string
          id: number
          loyalty_points: number
          name: string
          payment_term: number
          phone: string
          ranking: string
          sales_staff_name: string
          shipping_address: string
          status: Database["public"]["Enums"]["account_status"]
          tax_code: string
          vat_address: string
        }[]
      }
      export_customers_b2c_list: {
        Args: {
          search_query: string
          status_filter: string
          type_filter: string
        }
        Returns: {
          customer_code: string
          id: number
          key: string
          loyalty_points: number
          name: string
          phone: string
          status: Database["public"]["Enums"]["account_status"]
          total_count: number
          type: Database["public"]["Enums"]["customer_b2c_type"]
        }[]
      }
      export_products_list: {
        Args: {
          category_filter: string
          manufacturer_filter: string
          search_query: string
          status_filter: string
        }
        Returns: {
          category_name: string
          id: number
          image_url: string
          inventory_b2b: number
          inventory_ntdh1: number
          inventory_ntdh2: number
          inventory_pkdh: number
          inventory_potec: number
          key: string
          manufacturer_name: string
          name: string
          sku: string
          status: string
          total_count: number
        }[]
      }
      get_active_shipping_partners: {
        Args: never
        Returns: {
          base_fee: number
          contact_person: string
          id: number
          name: string
          phone: string
          speed_hours: number
        }[]
      }
      get_active_warehouses: {
        Args: never
        Returns: {
          id: number
          latitude: number
          longitude: number
          name: string
        }[]
      }
      get_applicable_vouchers: {
        Args: { p_customer_id: number; p_order_total: number }
        Returns: {
          code: string
          description: string
          discount_type: string
          discount_value: number
          id: string
        }[]
      }
      get_asset_details: { Args: { p_id: number }; Returns: Json }
      get_assets_list: {
        Args: {
          branch_filter: number
          search_query: string
          status_filter: string
          type_filter: number
        }
        Returns: {
          asset_code: string
          asset_type_name: string
          branch_name: string
          cost: number
          depreciation_months: number
          depreciation_per_month: number
          id: number
          image_url: string
          key: string
          name: string
          purchase_date: string
          remaining_value: number
          status: Database["public"]["Enums"]["asset_status"]
          total_count: number
          user_name: string
        }[]
      }
      get_available_vouchers: {
        Args: { p_customer_id: number; p_order_total: number }
        Returns: {
          code: string
          description: string
          discount_type: string
          discount_value: number
          id: string
          max_discount_value: number
          min_order_value: number
          name: string
          valid_to: string
        }[]
      }
      get_customer_b2b_details: { Args: { p_id: number }; Returns: Json }
      get_customer_b2c_details: { Args: { p_id: number }; Returns: Json }
      get_customer_debt_info: {
        Args: { p_customer_id: number }
        Returns: {
          available_credit: number
          current_debt: number
          customer_id: number
          customer_name: string
          debt_limit: number
          is_bad_debt: boolean
        }[]
      }
      get_customers_b2b_list: {
        Args: {
          page_num: number
          page_size: number
          sales_staff_filter: string
          search_query: string
          sort_by_debt?: string
          status_filter: string
        }
        Returns: {
          current_debt: number
          customer_code: string
          debt_limit: number
          id: number
          key: string
          name: string
          phone: string
          sales_staff_name: string
          status: Database["public"]["Enums"]["account_status"]
          total_count: number
        }[]
      }
      get_customers_b2c_list: {
        Args: {
          page_num: number
          page_size: number
          search_query: string
          sort_by_debt?: string
          status_filter: string
          type_filter: string
        }
        Returns: {
          avatar_url: string
          current_debt: number
          customer_code: string
          id: number
          key: string
          loyalty_points: number
          name: string
          phone: string
          status: Database["public"]["Enums"]["account_status"]
          total_count: number
          type: Database["public"]["Enums"]["customer_b2c_type"]
        }[]
      }
      get_distinct_categories: {
        Args: never
        Returns: {
          category_name: string
        }[]
      }
      get_distinct_manufacturers: {
        Args: never
        Returns: {
          manufacturer_name: string
        }[]
      }
      get_inbound_detail: { Args: { p_po_id: number }; Returns: Json }
      get_inventory_check_list: {
        Args: { p_warehouse_id: number }
        Returns: {
          batch_code: string
          cost_price: number
          expiry_date: string
          full_location: string
          location_cabinet: string
          location_row: string
          location_slot: string
          product_id: number
          product_name: string
          sku: string
          system_quantity: number
          unit: string
        }[]
      }
      get_inventory_checks_list: {
        Args: {
          p_end_date?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_start_date?: string
          p_status?: string
          p_warehouse_id?: number
        }
        Returns: {
          code: string
          completed_at: string
          created_at: string
          created_by_name: string
          id: number
          note: string
          status: string
          total_actual_value: number
          total_count: number
          total_diff_value: number
          total_system_value: number
          verified_by_name: string
          warehouse_name: string
        }[]
      }
      get_inventory_drift: {
        Args: { p_check_id: number }
        Returns: {
          batch_code: string
          current_live: number
          diff: number
          product_id: number
          product_name: string
          system_snapshot: number
        }[]
      }
      get_mapped_product: {
        Args: {
          p_product_name: string
          p_tax_code: string
          p_vendor_unit?: string
        }
        Returns: {
          internal_product_id: number
          internal_unit: string
        }[]
      }
      get_my_permissions: { Args: never; Returns: string[] }
      get_outbound_order_detail: { Args: { p_order_id: string }; Returns: Json }
      get_outbound_stats: { Args: { p_warehouse_id: number }; Returns: Json }
      get_partner_debt_live: {
        Args: { p_partner_id: number; p_partner_type: string }
        Returns: number
      }
      get_pending_reconciliation_orders: {
        Args: never
        Returns: {
          created_at: string
          customer_code: string
          customer_name: string
          final_amount: number
          order_code: string
          order_id: string
          paid_amount: number
          payment_method: string
          remaining_amount: number
          source: string
        }[]
      }
      get_po_logistics_stats: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_search?: string
          p_status_delivery?: string
          p_status_payment?: string
        }
        Returns: {
          method: string
          order_count: number
          total_cartons: number
        }[]
      }
      get_pos_usable_promotions: {
        Args: { p_customer_id: number; p_order_total?: number }
        Returns: Json
      }
      get_prescription_template_details: {
        Args: { p_id: number }
        Returns: Json
      }
      get_prescription_templates: {
        Args: { p_search?: string; p_status?: string }
        Returns: {
          created_at: string
          diagnosis: string | null
          id: number
          name: string
          note: string | null
          status: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "prescription_templates"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_product_details: { Args: { p_id: number }; Returns: Json }
      get_products_list: {
        Args: {
          category_filter: string
          manufacturer_filter: string
          page_num: number
          page_size: number
          search_query: string
          status_filter: string
        }
        Returns: {
          category_name: string
          id: number
          image_url: string
          inventory_b2b: number
          inventory_ntdh1: number
          inventory_ntdh2: number
          inventory_pkdh: number
          inventory_potec: number
          key: string
          manufacturer_name: string
          name: string
          sku: string
          status: string
          total_count: number
        }[]
      }
      get_purchase_order_detail: { Args: { p_po_id: number }; Returns: Json }
      get_purchase_order_details: { Args: { p_id: number }; Returns: Json }
      get_purchase_orders_master: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_status_delivery?: string
          p_status_payment?: string
        }
        Returns: {
          code: string
          created_at: string
          delivery_method: string
          delivery_progress: number
          delivery_status: string
          expected_delivery_date: string
          expected_delivery_time: string
          final_amount: number
          full_count: number
          id: number
          payment_status: string
          shipping_partner_name: string
          status: string
          supplier_id: number
          supplier_name: string
          total_cartons: number
          total_paid: number
          total_quantity: number
        }[]
      }
      get_sales_orders_view: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_order_type?: string
          p_page?: number
          p_page_size?: number
          p_remittance_status?: string
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      get_self_profile: {
        Args: never
        Returns: {
          address: string | null
          avatar_url: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          cccd: string | null
          cccd_back_url: string | null
          cccd_front_url: string | null
          cccd_issue_date: string | null
          created_at: string | null
          dob: string | null
          education_level: string | null
          email: string | null
          employee_code: string | null
          full_name: string | null
          gender: string | null
          hobbies: string | null
          id: string
          limitations: string | null
          marital_status: string | null
          needs: string | null
          phone: string | null
          position: string | null
          profile_updated_at: string | null
          specialization: string | null
          status: Database["public"]["Enums"]["employee_status"]
          strengths: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "users"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_service_package_details: { Args: { p_id: number }; Returns: Json }
      get_service_packages_list: {
        Args: {
          p_page_num: number
          p_page_size: number
          p_search_query: string
          p_status_filter: string
          p_type_filter: string
        }
        Returns: {
          id: number
          key: string
          name: string
          price: number
          sku: string
          status: Database["public"]["Enums"]["account_status"]
          total_cost_price: number
          total_count: number
          type: Database["public"]["Enums"]["service_package_type"]
          valid_from: string
          valid_to: string
        }[]
      }
      get_shipping_partner_details: { Args: { p_id: number }; Returns: Json }
      get_shipping_partners_list: {
        Args: { p_search_query: string; p_type_filter: string }
        Returns: {
          contact_person: string
          cut_off_time: string
          id: number
          key: string
          name: string
          phone: string
          status: Database["public"]["Enums"]["account_status"]
          total_count: number
          type: Database["public"]["Enums"]["shipping_partner_type"]
        }[]
      }
      get_supplier_quick_info: {
        Args: { p_supplier_id: number }
        Returns: Json
      }
      get_suppliers_list: {
        Args: {
          page_num: number
          page_size: number
          search_query: string
          status_filter: string
        }
        Returns: {
          bank_account: string
          bank_bin: string
          bank_holder: string
          bank_name: string
          code: string
          contact_person: string
          debt: number
          id: number
          key: string
          name: string
          phone: string
          status: string
          total_count: number
        }[]
      }
      get_transaction_history: {
        Args: {
          p_created_by?: string
          p_date_from?: string
          p_date_to?: string
          p_flow?: Database["public"]["Enums"]["transaction_flow"]
          p_fund_id?: number
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: Database["public"]["Enums"]["transaction_status"]
        }
        Returns: {
          amount: number
          business_type: Database["public"]["Enums"]["business_type"]
          category_name: string
          code: string
          created_by_name: string
          description: string
          flow: Database["public"]["Enums"]["transaction_flow"]
          fund_name: string
          id: number
          partner_name: string
          ref_advance_code: string
          ref_advance_id: number
          status: Database["public"]["Enums"]["transaction_status"]
          target_bank_info: Json
          total_count: number
          transaction_date: string
        }[]
      }
      get_users_with_roles: {
        Args: never
        Returns: {
          assignments: Json
          avatar: string
          email: string
          id: string
          key: string
          name: string
          status: string
        }[]
      }
      get_vaccination_template_details: {
        Args: { p_id: number }
        Returns: Json
      }
      get_vaccination_templates: {
        Args: { p_search?: string; p_status?: string }
        Returns: {
          created_at: string
          description: string
          id: number
          item_count: number
          max_age_months: number
          min_age_months: number
          name: string
          status: string
          updated_at: string
        }[]
      }
      get_valid_vouchers_for_checkout: {
        Args: { p_cart_total?: number; p_customer_id: number }
        Returns: {
          code: string
          discount_type: string
          discount_value: number
          ineligibility_reason: string
          is_eligible: boolean
          max_discount: number
          min_order_value: number
          promo_name: string
          voucher_id: number
        }[]
      }
      get_warehouse_cabinets: {
        Args: { p_warehouse_id: number }
        Returns: {
          cabinet_name: string
        }[]
      }
      get_warehouse_inbound_tasks: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_status?: string
          p_warehouse_id: number
        }
        Returns: {
          carrier_contact: string
          carrier_name: string
          carrier_phone: string
          code: string
          created_at: string
          expected_delivery_date: string
          expected_delivery_time: string
          item_count: number
          progress_percent: number
          status: string
          supplier_name: string
          task_id: number
          total_count: number
          total_packages: number
        }[]
      }
      get_warehouse_outbound_tasks: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_shipping_partner_id?: number
          p_status?: string
          p_type?: string
          p_warehouse_id: number
        }
        Returns: {
          code: string
          created_at: string
          customer_name: string
          delivery_deadline: string
          package_count: number
          priority: string
          progress_picked: number
          progress_total: number
          shipping_contact_name: string
          shipping_contact_phone: string
          shipping_partner_name: string
          status: string
          status_label: string
          task_id: string
          task_type: string
          total_count: number
        }[]
      }
      handover_to_shipping: { Args: { p_order_id: string }; Returns: Json }
      import_customers_b2b: {
        Args: { p_customers_array: Json[] }
        Returns: Json
      }
      import_opening_stock_v3_by_id: {
        Args: {
          p_stock_array: Json[]
          p_user_id: string
          p_warehouse_id: number
        }
        Returns: Json
      }
      import_product_from_ai: { Args: { p_data: Json }; Returns: number }
      invite_new_user: {
        Args: { p_email: string; p_full_name: string }
        Returns: string
      }
      mark_notification_read: {
        Args: { p_noti_id: string }
        Returns: undefined
      }
      match_products_from_excel: {
        Args: { p_data: Json }
        Returns: {
          excel_name: string
          excel_sku: string
          match_type: string
          product_id: number
          product_name: string
          product_sku: string
          similarity_score: number
        }[]
      }
      notify_group: {
        Args: {
          p_message: string
          p_permission_key: string
          p_title: string
          p_type?: string
        }
        Returns: undefined
      }
      notify_users_by_permission: {
        Args: {
          p_message: string
          p_permission_key: string
          p_title: string
          p_type?: string
        }
        Returns: undefined
      }
      process_inbound_receipt: {
        Args: { p_items: Json; p_po_id: number; p_warehouse_id: number }
        Returns: Json
      }
      process_vat_invoice_entry: {
        Args: { p_invoice_id: number }
        Returns: undefined
      }
      reactivate_customer_b2b: { Args: { p_id: number }; Returns: undefined }
      reactivate_customer_b2c: { Args: { p_id: number }; Returns: undefined }
      reactivate_shipping_partner: {
        Args: { p_id: number }
        Returns: undefined
      }
      refresh_segment_members: {
        Args: { p_segment_id: number }
        Returns: undefined
      }
      reverse_vat_invoice_entry: {
        Args: { p_invoice_id: number }
        Returns: undefined
      }
      save_outbound_progress: {
        Args: { p_items: Json; p_order_id: string }
        Returns: Json
      }
      search_customers_b2b_v2: {
        Args: { p_keyword: string }
        Returns: {
          contacts: Json
          current_debt: number
          debt_limit: number
          id: number
          loyalty_points: number
          name: string
          phone: string
          shipping_address: string
          tax_code: string
          vat_address: string
        }[]
      }
      search_customers_by_phone_b2c: {
        Args: { p_search_query: string }
        Returns: {
          customer_code: string
          id: number
          key: string
          loyalty_points: number
          name: string
          phone: string
          status: Database["public"]["Enums"]["account_status"]
          type: Database["public"]["Enums"]["customer_b2c_type"]
        }[]
      }
      search_customers_pos: {
        Args: { p_keyword: string }
        Returns: {
          code: string
          debt_amount: number
          id: number
          loyalty_points: number
          name: string
          phone: string
          sub_label: string
          type: string
        }[]
      }
      search_items_for_sales: {
        Args: { p_keyword: string; p_limit?: number; p_warehouse_id?: number }
        Returns: {
          id: number
          image_url: string
          items_per_carton: number
          name: string
          price_retail: number
          price_wholesale: number
          sku: string
          stock_quantity: number
          type: string
          uom: string
          uom_wholesale: string
        }[]
      }
      search_product_batches: {
        Args: { p_product_id: number; p_warehouse_id?: number }
        Returns: {
          days_remaining: number
          expiry_date: string
          lot_number: string
        }[]
      }
      search_products_for_b2b_order: {
        Args: { p_keyword: string; p_warehouse_id?: number }
        Returns: {
          expiry_date: string
          id: number
          image_url: string
          items_per_carton: number
          lot_number: string
          name: string
          price_wholesale: number
          shelf_location: string
          sku: string
          stock_quantity: number
          wholesale_unit: string
        }[]
      }
      search_products_for_purchase: {
        Args: { p_keyword: string }
        Returns: {
          actual_cost: number
          barcode: string
          id: number
          image_url: string
          items_per_carton: number
          latest_purchase_price: number
          name: string
          retail_unit: string
          sku: string
          wholesale_unit: string
        }[]
      }
      search_products_pos: {
        Args: { p_keyword: string; p_limit?: number; p_warehouse_id: number }
        Returns: {
          id: number
          image_url: string
          location_cabinet: string
          location_row: string
          location_slot: string
          name: string
          retail_price: number
          similarity_score: number
          sku: string
          stock_quantity: number
          unit: string
          usage_instructions: Json
        }[]
      }
      search_products_v2: {
        Args: {
          p_category?: string
          p_keyword?: string
          p_limit?: number
          p_manufacturer?: string
          p_offset?: number
          p_status?: string
        }
        Returns: Json
      }
      send_notification: {
        Args: {
          p_message: string
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_cash_remittance: {
        Args: { p_order_ids: string[]; p_user_id: string }
        Returns: Json
      }
      submit_transfer_shipping: {
        Args: { p_batch_items: Json; p_transfer_id: number }
        Returns: Json
      }
      update_asset: {
        Args: {
          p_asset_data: Json
          p_id: number
          p_maintenance_history: Json
          p_maintenance_plans: Json
        }
        Returns: undefined
      }
      update_customer_b2b: {
        Args: { p_contacts: Json[]; p_customer_data: Json; p_id: number }
        Returns: undefined
      }
      update_customer_b2c: {
        Args: { p_customer_data: Json; p_guardians: Json; p_id: number }
        Returns: undefined
      }
      update_inventory_check_info: {
        Args: { p_check_id: number; p_note: string }
        Returns: undefined
      }
      update_outbound_package_count: {
        Args: { p_count: number; p_order_id: string }
        Returns: Json
      }
      update_permissions_for_role: {
        Args: { p_permission_keys: string[]; p_role_id: string }
        Returns: undefined
      }
      update_prescription_template: {
        Args: { p_data: Json; p_id: number; p_items: Json }
        Returns: boolean
      }
      update_product: {
        Args: {
          p_active_ingredient?: string
          p_actual_cost?: number
          p_barcode?: string
          p_carton_dimensions?: string
          p_carton_weight?: number
          p_category_name?: string
          p_conversion_factor?: number
          p_description?: string
          p_distributor_id?: number
          p_id: number
          p_image_url?: string
          p_inventory_settings?: Json
          p_invoice_price?: number
          p_items_per_carton?: number
          p_manufacturer_name?: string
          p_name?: string
          p_packing_spec?: string
          p_purchasing_policy?: string
          p_registration_number?: string
          p_retail_margin_type?: string
          p_retail_margin_value?: number
          p_retail_unit?: string
          p_sku?: string
          p_status?: string
          p_updated_by?: string
          p_wholesale_margin_type?: string
          p_wholesale_margin_value?: number
          p_wholesale_unit?: string
        }
        Returns: undefined
      }
      update_product_location: {
        Args: {
          p_cabinet: string
          p_product_id: number
          p_row: string
          p_slot: string
          p_warehouse_id: number
        }
        Returns: undefined
      }
      update_product_status: {
        Args: { p_ids: number[]; p_status: string }
        Returns: undefined
      }
      update_purchase_order: {
        Args: {
          p_carrier_contact?: string
          p_carrier_name?: string
          p_carrier_phone?: string
          p_delivery_method?: string
          p_expected_date: string
          p_expected_time?: string
          p_items: Json
          p_note: string
          p_po_id: number
          p_shipping_fee?: number
          p_shipping_partner_id?: number
          p_status?: string
          p_supplier_id: number
          p_total_packages?: number
        }
        Returns: boolean
      }
      update_self_profile: {
        Args: { p_profile_data: Json }
        Returns: undefined
      }
      update_service_package: {
        Args: { p_data: Json; p_id: number; p_items: Json }
        Returns: undefined
      }
      update_shipping_partner: {
        Args: { p_id: number; p_partner_data: Json; p_rules: Json[] }
        Returns: undefined
      }
      update_supplier: {
        Args: {
          p_address: string
          p_bank_account: string
          p_bank_holder: string
          p_bank_name: string
          p_contact_person: string
          p_delivery_method: string
          p_email: string
          p_id: number
          p_lead_time: number
          p_name: string
          p_notes: string
          p_payment_term: string
          p_phone: string
          p_status: string
          p_tax_code: string
        }
        Returns: undefined
      }
      update_user_assignments: {
        Args: { p_assignments: Json[]; p_user_id: string }
        Returns: undefined
      }
      update_user_status: {
        Args: { p_status: string; p_user_id: string }
        Returns: undefined
      }
      update_vaccination_template: {
        Args: { p_data: Json; p_id: number; p_items: Json }
        Returns: boolean
      }
      upsert_product_with_units: {
        Args: {
          p_contents_json?: Json
          p_inventory_json?: Json
          p_product_json: Json
          p_units_json: Json
        }
        Returns: Json
      }
      verify_promotion_code: {
        Args: { p_code: string; p_customer_id: number; p_order_value: number }
        Returns: Json
      }
    }
    Enums: {
      account_balance_type: "No" | "Co" | "LuongTinh"
      account_status: "active" | "inactive"
      account_type:
        | "TaiSan"
        | "NoPhaiTra"
        | "VonChuSoHuu"
        | "DoanhThu"
        | "ChiPhi"
      appointment_service_type: "examination" | "vaccination"
      appointment_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "checked_in"
      asset_status: "active" | "storage" | "repair" | "disposed"
      business_type:
        | "trade"
        | "advance"
        | "reimbursement"
        | "internal"
        | "other"
      customer_b2c_type: "CaNhan" | "ToChuc"
      customer_gender: "Nam" | "Nß╗»" | "Kh├íc"
      employee_status: "pending_approval" | "active" | "inactive"
      fund_account_status: "active" | "locked"
      fund_account_type: "cash" | "bank"
      invoice_request_status: "none" | "pending" | "exported" | "issued"
      maintenance_exec_type: "internal" | "external"
      order_status:
        | "DRAFT"
        | "QUOTE"
        | "QUOTE_EXPIRED"
        | "CONFIRMED"
        | "PACKED"
        | "SHIPPING"
        | "DELIVERED"
        | "CANCELLED"
      queue_priority: "normal" | "high"
      queue_status: "waiting" | "examining" | "completed" | "skipped"
      service_package_type: "service" | "bundle"
      shipping_partner_type: "app" | "coach" | "internal"
      stock_management_type: "lot_date" | "lot_only" | "serial" | "simple"
      template_module:
        | "pos"
        | "b2b"
        | "hr"
        | "appointment"
        | "accounting"
        | "general"
      template_type: "print" | "pdf" | "email" | "sms"
      transaction_flow: "in" | "out"
      transaction_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "approved"
      transaction_type: "thu" | "chi"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_balance_type: ["No", "Co", "LuongTinh"],
      account_status: ["active", "inactive"],
      account_type: [
        "TaiSan",
        "NoPhaiTra",
        "VonChuSoHuu",
        "DoanhThu",
        "ChiPhi",
      ],
      appointment_service_type: ["examination", "vaccination"],
      appointment_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "checked_in",
      ],
      asset_status: ["active", "storage", "repair", "disposed"],
      business_type: ["trade", "advance", "reimbursement", "internal", "other"],
      customer_b2c_type: ["CaNhan", "ToChuc"],
      customer_gender: ["Nam", "Nß╗»", "Kh├íc"],
      employee_status: ["pending_approval", "active", "inactive"],
      fund_account_status: ["active", "locked"],
      fund_account_type: ["cash", "bank"],
      invoice_request_status: ["none", "pending", "exported", "issued"],
      maintenance_exec_type: ["internal", "external"],
      order_status: [
        "DRAFT",
        "QUOTE",
        "QUOTE_EXPIRED",
        "CONFIRMED",
        "PACKED",
        "SHIPPING",
        "DELIVERED",
        "CANCELLED",
      ],
      queue_priority: ["normal", "high"],
      queue_status: ["waiting", "examining", "completed", "skipped"],
      service_package_type: ["service", "bundle"],
      shipping_partner_type: ["app", "coach", "internal"],
      stock_management_type: ["lot_date", "lot_only", "serial", "simple"],
      template_module: [
        "pos",
        "b2b",
        "hr",
        "appointment",
        "accounting",
        "general",
      ],
      template_type: ["print", "pdf", "email", "sms"],
      transaction_flow: ["in", "out"],
      transaction_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "approved",
      ],
      transaction_type: ["thu", "chi"],
    },
  },
} as const

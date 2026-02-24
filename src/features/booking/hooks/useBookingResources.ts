// src/features/booking/hooks/useBookingResources.ts
import { message } from "antd";
import { useState, useCallback, useMemo } from "react";

import { supabase } from "@/shared/lib/supabaseClient";

export interface BookingCustomer {
  id: number;
  name: string;
  phone: string;
  customer_code: string;
  dob: string | null;
  gender: string | null;
  address: string | null;
}

export interface BookingDoctor {
  id: string; // UUID
  name: string;
  role: string;
}

export interface BookingVaccine {
  id: number;
  name: string;
  price: number;
  sku: string;
}

export const useBookingResources = () => {
  const [customers, setCustomers] = useState<BookingCustomer[]>([]);
  const [doctors, setDoctors] = useState<BookingDoctor[]>([]);
  const [vaccines, setVaccines] = useState<BookingVaccine[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * Search Customers B2C
   * Uses RPC: get_customers_b2c_list
   */
  const searchCustomers = useCallback(async (keyword: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_customers_b2c_list", {
        search_query: keyword,
        type_filter: null,
        status_filter: "active",
        page_num: 1,
        page_size: 20,
      });

      if (error) throw error;

      if (data) {
        // Map to simpler interface
        const mapped = data.map((c: any) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          customer_code: c.customer_code,
          dob: c.dob || null, // Map new fields
          gender: c.gender || null, // Map new fields
          address: c.address || null, // Map new fields
        }));
        setCustomers(mapped);
      }
    } catch (err: any) {
      console.error("Error searching customers:", err);
      message.error("Không thể tìm kiếm khách hàng");
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch Doctors
   * Uses RPC: get_users_with_roles (User Requested)
   */
  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    try {
      // Note: If get_users_with_roles doesn't exist, this will fail.
      // But we follow strict user instructions to use this RPC.
      const { data, error } = await supabase.rpc(
        "get_users_with_roles" as any,
        {}
      );

      if (error) throw error;

      if (data) {
        // Filter and Map
        // User requested: Remove strict filters temporarily
        const docs = data
          // .filter((u: any) => u.role === 'doctor' || u.role === 'bac_si') // Relaxed filter
          .map((u: any) => ({
            id: u.id,
            name: u.name, // Ensure 'name' is used
            role: u.role,
          }));

        setDoctors(docs);
      }
    } catch (err: any) {
      console.warn(
        "Error fetching doctors (RPC get_users_with_roles might be missing):",
        err
      );
      // Fallback to empty or mock if critical, but for this task we just log.
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch Vaccines (Service Packages)
   * Uses RPC: get_service_packages_list
   */
  const fetchVaccines = useCallback(async (keyword: string = "") => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_service_packages_list", {
        p_search_query: keyword,
        p_type_filter: "service", // or 'bundle' potentially
        p_status_filter: "active",
        p_page_num: 1,
        p_page_size: 50,
      });

      if (error) throw error;

      if (data) {
        // Map result
        const vax = data.map((v: any) => ({
          id: v.id,
          name: v.name,
          price: v.price || 0,
          sku: v.sku || "",
        }));
        setVaccines(vax);
      }
    } catch (err: any) {
      console.error("Error fetching vaccines:", err);
      message.error("Không thể tải danh sách vắc-xin");
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create Customer B2C
   */
  const createCustomer = useCallback(
    async (customerData: Partial<BookingCustomer>) => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("create_customer_b2c", {
          p_customer_data: {
            name: customerData.name,
            phone: customerData.phone,
            dob: customerData.dob,
            gender: customerData.gender,
            address: customerData.address,
          },
        });

        if (error) throw error;
        message.success("Thêm khách hàng thành công");
        // Optionally refresh or return new ID
        return data;
      } catch (err: any) {
        console.error("Error creating customer:", err);
        message.error(err.message || "Không thể tạo khách hàng");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Update Customer B2C
   */
  const updateCustomer = useCallback(
    async (id: number, customerData: Partial<BookingCustomer>) => {
      setLoading(true);
      try {
        // Assuming usage of update_customer_b2c
        const { error } = await supabase.rpc("update_customer_b2c", {
          p_customer_id: id,
          p_customer_data: {
            name: customerData.name,
            phone: customerData.phone,
            dob: customerData.dob,
            gender: customerData.gender,
            address: customerData.address,
          },
        });

        if (error) throw error;
        message.success("Cập nhật khách hàng thành công");
        return true;
      } catch (err: any) {
        console.error("Error updating customer:", err);
        message.error(err.message || "Không thể cập nhật khách hàng");
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    customers,
    doctors,
    vaccines,
    loading,
    actions: useMemo(
      () => ({
        searchCustomers,
        fetchDoctors,
        fetchVaccines,
        createCustomer,
        updateCustomer,
      }),
      [
        searchCustomers,
        fetchDoctors,
        fetchVaccines,
        createCustomer,
        updateCustomer,
      ]
    ),
  };
};

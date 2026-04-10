-- Fix: get_customers_b2c_list có 2 overloads (5-param vs 6-param)
-- gây lỗi PGRST203 (ambiguous) khi gọi với 5 params.
-- Drop bản cũ 5-param, giữ bản mới 6-param (có sort_by_debt).
DROP FUNCTION IF EXISTS public.get_customers_b2c_list(text, text, text, integer, integer);

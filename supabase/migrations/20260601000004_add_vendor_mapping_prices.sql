-- Migration: add_vendor_mapping_prices
-- Description: Adds pre_vat_price, vat_of_supplier, and internal_product_unit_id to vendor_product_mappings

BEGIN;

ALTER TABLE public.vendor_product_mappings
ADD COLUMN pre_vat_price numeric,
ADD COLUMN vat_of_supplier numeric,
ADD COLUMN internal_product_unit_id bigint REFERENCES public.product_units(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;

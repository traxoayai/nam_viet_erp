-- Migration: add_vendor_mapping_prices
-- Description: Adds pre_vat_price, vat_of_supplier, and internal_product_unit_id to vendor_product_mappings

BEGIN;

ALTER TABLE public.vendor_product_mappings
ADD COLUMN IF NOT EXISTS pre_vat_price numeric,
ADD COLUMN IF NOT EXISTS vat_of_supplier numeric,
ADD COLUMN IF NOT EXISTS internal_product_unit_id bigint REFERENCES public.product_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vpm_internal_product_unit_id
  ON public.vendor_product_mappings(internal_product_unit_id);

NOTIFY pgrst, 'reload schema';

COMMIT;

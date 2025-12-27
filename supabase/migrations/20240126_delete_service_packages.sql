-- FUNCTION: delete_service_packages (Soft Delete List)
CREATE OR REPLACE FUNCTION delete_service_packages(p_ids BIGINT[])
RETURNS VOID AS $$
BEGIN
  UPDATE service_packages
  SET status = 'deleted'
  WHERE id = ANY(p_ids);
END;
$$ LANGUAGE plpgsql;

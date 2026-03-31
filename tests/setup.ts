import { adminClient } from "./helpers/supabase";

export async function setup() {
  const { error } = await adminClient.from("users").select("id").limit(1);
  if (error) throw new Error(`DB connection failed: ${error.message}`);
}

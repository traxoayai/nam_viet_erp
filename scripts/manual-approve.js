import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://iudkexocalqdhxuyjacu.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZGtleG9jYWxxZGh4dXlqYWN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjE0MDk3MiwiZXhwIjoyMDc3NzE2OTcyfQ.zRb5ctyyTik5JtwDu9TTnXiNAcfd-3NsFnt4n9XNyNM";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function checkAndApprove() {
  const email = "test_e2e_portal@namviet.com";

  console.log("Checking for pending registration request for:", email);
  // 1. Find request
  const { data: request, error: reqErr } = await supabase
    .from("registration_requests")
    .select("*")
    .eq("email", email)
    .eq("status", "pending")
    .limit(1)
    .single();

  if (reqErr || !request) {
    console.log("No pending registration request found for:", email);
    // Check if already approved
    const { data: approved } = await supabase
      .from("registration_requests")
      .select("status")
      .eq("email", email)
      .limit(1)
      .single();
    if (approved) console.log("Current status in DB:", approved.status);
    return;
  }

  console.log("Found request for:", request.business_name);

  // 2. We need to create a customer_b2b first
  // Check if already exists
  let { data: customer } = await supabase
    .from("customers_b2b")
    .select("id")
    .eq("email", email)
    .limit(1)
    .single();

  if (!customer) {
    console.log("Creating new customer_b2b...");
    const { data: newCust, error: custErr } = await supabase
      .from("customers_b2b")
      .insert({
        name: request.business_name,
        email: email,
        phone: request.phone,
        tax_code: request.tax_code,
        vat_address: request.address,
        status: "active",
        customer_code: "B2B-TEST-" + Math.floor(Math.random() * 1000),
      })
      .select("id")
      .single();
    if (custErr) throw custErr;
    customer = newCust;
  }

  console.log("Customer ID:", customer.id);

  // 3. Create auth user
  console.log("Ensuring auth user exists in Supabase Auth...");
  const { data: authResult, error: authErr } =
    await supabase.auth.admin.createUser({
      email: email,
      password: "NamViet@123",
      email_confirm: true,
      user_metadata: { full_name: request.contact_name },
    });

  let authUserId;
  if (authErr && authErr.message.includes("already registered")) {
    console.log("Auth user already exists. Fetching ID...");
    const { data: users } = await supabase.auth.admin.listUsers();
    authUserId = users.users.find((u) => u.email === email)?.id;
  } else if (authErr) {
    console.error("Auth creation error:", authErr);
    throw authErr;
  } else {
    authUserId = authResult.user.id;
  }

  if (!authUserId) throw new Error("Could not determine auth user ID");

  console.log("Auth User ID:", authUserId);

  // 4. Create portal_user link
  console.log("Upserting portal_user record...");
  const { error: puErr } = await supabase.from("portal_users").upsert({
    auth_user_id: authUserId,
    customer_b2b_id: customer.id,
    display_name: request.contact_name,
    email: email,
    phone: request.phone,
    role: "owner",
    status: "active",
    updated_at: new Date().toISOString(),
  });

  if (puErr) throw puErr;

  // 5. Approve request
  console.log("Finalizing approval in registration_requests table...");
  const { error: appErr } = await supabase
    .from("registration_requests")
    .update({
      status: "approved",
      approved_customer_b2b_id: customer.id,
      approved_portal_user_id: authUserId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", request.id);

  if (appErr) throw appErr;

  console.log("✅ Successfully approved portal registration for:", email);
}

checkAndApprove().catch((err) => {
  console.error("❌ Process failed:", err.message);
  process.exit(1);
});

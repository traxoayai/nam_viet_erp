import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fixture builders cho integration test.
 *
 * QUY ƯỚC:
 *   Mọi record test PHẢI có prefix `TEST-INTEGRATION-` trong `code`/`name`
 *   để filter an toàn khi cleanup + tránh lẫn với data thật.
 *
 * SAFETY:
 *   - Chỉ dùng với Supabase local (không chạy trên prod).
 *   - Cleanup phải chạy trong `finally` block của test.
 */

// ---------------------------------------------------------------------------
// Warehouse
// ---------------------------------------------------------------------------
export async function createTestWarehouse(
  admin: SupabaseClient,
  opts?: { type?: string; name?: string }
): Promise<number> {
  const suffix =
    opts?.name ?? `WH-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const marker = `TEST-INTEGRATION-${suffix}`;

  const { data, error } = await admin
    .from("warehouses")
    .insert({
      key: marker,
      name: marker,
      code: marker,
      type: opts?.type ?? "retail",
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `createTestWarehouse failed: ${error?.message ?? "no data"}`
    );
  }
  return data.id as number;
}

// ---------------------------------------------------------------------------
// Product (+ base product_unit)
// ---------------------------------------------------------------------------
export async function createTestProduct(
  admin: SupabaseClient,
  opts?: { name?: string; actualCost?: number }
): Promise<{ productId: number; baseUnitName: string }> {
  const suffix =
    opts?.name ?? `P-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const marker = `TEST-INTEGRATION-${suffix}`;
  const baseUnitName = "Hộp";

  const { data: prod, error: prodErr } = await admin
    .from("products")
    .insert({
      name: marker,
      sku: marker,
      status: "active",
      actual_cost: opts?.actualCost ?? 10000,
      wholesale_unit: baseUnitName,
      retail_unit: "Vỉ",
      conversion_factor: 1,
    })
    .select("id")
    .single();

  if (prodErr || !prod) {
    throw new Error(
      `createTestProduct failed: ${prodErr?.message ?? "no data"}`
    );
  }

  // Tạo base unit — confirm_outbound_packing cần conversion_factor trên order_items,
  // nhưng product_units giúp các RPC khác (catalog, search) hoạt động bình thường.
  const { error: unitErr } = await admin.from("product_units").insert({
    product_id: prod.id,
    unit_name: baseUnitName,
    conversion_rate: 1,
    is_base: true,
    is_direct_sale: true,
    price_cost: opts?.actualCost ?? 10000,
    price_sell: opts?.actualCost ?? 10000,
    price: opts?.actualCost ?? 10000,
    unit_type: "base",
  });
  if (unitErr) {
    throw new Error(`createTestProduct unit failed: ${unitErr.message}`);
  }

  return { productId: prod.id as number, baseUnitName };
}

// ---------------------------------------------------------------------------
// Batch + InventoryBatch
// ---------------------------------------------------------------------------
export async function createTestBatch(
  admin: SupabaseClient,
  productId: number,
  warehouseId: number,
  opts: {
    quantity: number;
    inboundPrice?: number;
    batchCode?: string;
    expiryDate?: string;
  }
): Promise<{ batchId: number; inventoryBatchId: number }> {
  const batchCode =
    opts.batchCode ??
    `TEST-INTEGRATION-BATCH-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  // Default expiry 1 year from now
  const expiry =
    opts.expiryDate ??
    new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const { data: batch, error: batchErr } = await admin
    .from("batches")
    .insert({
      product_id: productId,
      batch_code: batchCode,
      expiry_date: expiry,
      inbound_price: opts.inboundPrice ?? 10000,
    })
    .select("id")
    .single();

  if (batchErr || !batch) {
    throw new Error(
      `createTestBatch (batches) failed: ${batchErr?.message ?? "no data"}`
    );
  }

  const { data: ib, error: ibErr } = await admin
    .from("inventory_batches")
    .insert({
      warehouse_id: warehouseId,
      product_id: productId,
      batch_id: batch.id,
      quantity: opts.quantity,
    })
    .select("id")
    .single();

  if (ibErr || !ib) {
    throw new Error(
      `createTestBatch (inventory_batches) failed: ${ibErr?.message ?? "no data"}`
    );
  }

  return { batchId: batch.id as number, inventoryBatchId: ib.id as number };
}

// ---------------------------------------------------------------------------
// B2B Customer
// ---------------------------------------------------------------------------
export async function createTestB2BCustomer(
  admin: SupabaseClient,
  opts?: { name?: string }
): Promise<number> {
  const suffix =
    opts?.name ?? `C-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const marker = `TEST-INTEGRATION-${suffix}`;

  const { data, error } = await admin
    .from("customers_b2b")
    .insert({
      name: marker,
      customer_code: marker,
      status: "active",
      phone: "0900000000",
      debt_limit: 1_000_000_000,
      payment_term: 30,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `createTestB2BCustomer failed: ${error?.message ?? "no data"}`
    );
  }
  return data.id as number;
}

// ---------------------------------------------------------------------------
// Order + Order Items
// ---------------------------------------------------------------------------
export async function createTestOrder(
  admin: SupabaseClient,
  opts: {
    customerB2bId?: number | null;
    customerB2cId?: number | null;
    warehouseId: number;
    status?: string;
    orderType?: string;
    code?: string;
    items: Array<{
      productId: number;
      quantity: number;
      unitPrice: number;
      conversionFactor?: number;
      uom?: string;
    }>;
  }
): Promise<{ orderId: string; orderCode: string }> {
  const code =
    opts.code ??
    `TEST-INTEGRATION-ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const totalAmount = opts.items.reduce(
    (s, i) => s + i.quantity * i.unitPrice,
    0
  );

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      code,
      customer_id: opts.customerB2bId ?? null,
      customer_b2c_id: opts.customerB2cId ?? null,
      warehouse_id: opts.warehouseId,
      order_type: opts.orderType ?? "B2B",
      status: opts.status ?? "DRAFT",
      payment_status: "unpaid",
      final_amount: totalAmount,
      total_amount: totalAmount,
      paid_amount: 0,
    })
    .select("id, code")
    .single();

  if (orderErr || !order) {
    throw new Error(
      `createTestOrder failed: ${orderErr?.message ?? "no data"}`
    );
  }

  // Insert order items
  const itemRows = opts.items.map((i) => ({
    order_id: order.id,
    product_id: i.productId,
    quantity: i.quantity,
    uom: i.uom ?? "Hộp",
    conversion_factor: i.conversionFactor ?? 1,
    unit_price: i.unitPrice,
    discount: 0,
  }));

  const { error: itemsErr } = await admin.from("order_items").insert(itemRows);
  if (itemsErr) {
    // Best-effort rollback
    await admin.from("orders").delete().eq("id", order.id);
    throw new Error(`createTestOrder items failed: ${itemsErr.message}`);
  }

  return { orderId: order.id as string, orderCode: order.code as string };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
/**
 * Cleanup theo marker. Xóa theo thứ tự FK-safe:
 *   inventory_transactions (by ref_id LIKE marker)
 *   order_items (by order.code LIKE marker)
 *   orders (by code LIKE marker)
 *   inventory_batches (by product_id/warehouse_id thông qua batches/warehouses marker)
 *   batches (by batch_code LIKE marker)
 *   product_units (by product.name LIKE marker)
 *   products (by name/sku LIKE marker)
 *   customers_b2b (by name/customer_code LIKE marker)
 *   warehouses (by name/key LIKE marker)
 *   b2b_notifications (by title LIKE marker hoặc customer_b2b_id IN đã xóa)
 *
 * @param markers — array các marker string (không kèm prefix). Hàm sẽ pattern-match
 *                  `%marker%` trong các cột code/name/key.
 */
export async function cleanupTestData(
  admin: SupabaseClient,
  markers: string[]
): Promise<void> {
  if (markers.length === 0) return;

  for (const marker of markers) {
    const pattern = `%${marker}%`;

    // 0. Lookup warehouse/customer theo marker TRƯỚC để dọn orders không có
    //    marker trong code (vd reprocess-failed-bank-memos test dùng code
    //    'SO-{yymmdd}-{seq8}' không chứa marker, nhưng warehouse + customer
    //    của order có name chứa marker).
    const { data: whRowsEarly } = await admin
      .from("warehouses")
      .select("id")
      .or(`name.like.${pattern},key.like.${pattern},code.like.${pattern}`);
    const whIdsEarly = (whRowsEarly ?? []).map((w) => w.id);

    const { data: custRowsEarly } = await admin
      .from("customers_b2b")
      .select("id")
      .or(`name.like.${pattern},customer_code.like.${pattern}`);
    const custIdsEarly = (custRowsEarly ?? []).map((c) => c.id);

    // 1. Xóa inventory_transactions ref tới order test
    //    Tìm orders qua: code marker HOẶC warehouse/customer marker.
    const { data: ordersByCode } = await admin
      .from("orders")
      .select("id, code")
      .like("code", pattern);
    const { data: ordersByWh } =
      whIdsEarly.length > 0
        ? await admin
            .from("orders")
            .select("id, code")
            .in("warehouse_id", whIdsEarly)
        : { data: [] as Array<{ id: number; code: string }> };
    const { data: ordersByCust } =
      custIdsEarly.length > 0
        ? await admin
            .from("orders")
            .select("id, code")
            .in("customer_b2b_id", custIdsEarly)
        : { data: [] as Array<{ id: number; code: string }> };

    const orderMap = new Map<number, string>();
    for (const o of [
      ...(ordersByCode ?? []),
      ...(ordersByWh ?? []),
      ...(ordersByCust ?? []),
    ]) {
      orderMap.set(o.id, o.code);
    }
    const orderIds = Array.from(orderMap.keys());
    const orderCodes = Array.from(orderMap.values());

    if (orderCodes.length > 0) {
      await admin
        .from("inventory_transactions")
        .delete()
        .in("ref_id", orderCodes);
      await admin.from("order_items").delete().in("order_id", orderIds);
      await admin.from("orders").delete().in("id", orderIds);
    }

    // 2. Xóa finance_transactions ref tới marker. Test reprocess insert tx
    //    với code 'PT-{yymmdd}-...' không chứa marker, nhưng
    //    bank_reference_id (vd 'BF-DRY-REF-{marker}') có chứa marker.
    //    Dọn cả 2 đường để tránh orphan tích lũy.
    await admin.from("finance_transactions").delete().like("code", pattern);
    await admin
      .from("finance_transactions")
      .delete()
      .like("bank_reference_id", pattern);

    // 3. Xóa inventory_batches có batch_code / warehouse / product marker
    //    (dùng 2 bước vì không có join trong Supabase JS client)
    const { data: batchRows } = await admin
      .from("batches")
      .select("id")
      .like("batch_code", pattern);
    const batchIds = (batchRows ?? []).map((b) => b.id);

    const { data: prodRows } = await admin
      .from("products")
      .select("id")
      .or(`name.like.${pattern},sku.like.${pattern}`);
    const prodIds = (prodRows ?? []).map((p) => p.id);

    const whIds = whIdsEarly;

    if (batchIds.length > 0) {
      await admin.from("inventory_batches").delete().in("batch_id", batchIds);
      await admin.from("batches").delete().in("id", batchIds);
    }

    // Inventory_transactions còn sót lại theo warehouse/product marker
    if (prodIds.length > 0) {
      await admin
        .from("inventory_transactions")
        .delete()
        .in("product_id", prodIds);
      await admin.from("product_units").delete().in("product_id", prodIds);
      await admin.from("products").delete().in("id", prodIds);
    }

    if (whIds.length > 0) {
      await admin.from("inventory_batches").delete().in("warehouse_id", whIds);
      await admin.from("warehouses").delete().in("id", whIds);
    }

    // 4. b2b_notifications chứa marker trong title hoặc data->>'order_code'
    await admin.from("b2b_notifications").delete().like("title", pattern);

    // 5. customers_b2b
    await admin
      .from("customers_b2b")
      .delete()
      .or(`name.like.${pattern},customer_code.like.${pattern}`);
  }
}

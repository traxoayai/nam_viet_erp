import { supabase } from '@/shared/lib/supabaseClient';
import { TransferMaster, TransferDetail, TransferStatus } from '../types/transfer';

export const transferService = {
    /**
     * Create Auto Replenishment Request
     * Calls RPC: create_auto_replenishment_request
     */
    createAutoReplenishment: async (destWarehouseId: number, note?: string) => {
        const { data, error } = await supabase.rpc('create_auto_replenishment_request', {
            p_dest_warehouse_id: destWarehouseId,
            p_note: note || ''
        });

        if (error) throw error;
        return data; // Returns request_id
    },

    /**
     * Fetch Transfers List
     */
    fetchTransfers: async (filters: { 
        page?: number; 
        pageSize?: number; 
        status?: string; 
        search?: string 
    }) => {
        const page = filters.page || 1;
        const pageSize = filters.pageSize || 10;
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
            .from('inventory_transfers')
            .select(`
                *,
                source:source_warehouse_id(name),
                dest:dest_warehouse_id(name)
            `, { count: 'exact' });

        if (filters.status) {
            query = query.eq('status', filters.status);
        }

        if (filters.search) {
            query = query.ilike('code', `%${filters.search}%`);
        }

        query = query
            .order('created_at', { ascending: false })
            .range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;

        // Map joined data to flat structure if needed
        const mappedData: TransferMaster[] = data.map((item: any) => ({
            ...item,
            source_warehouse_name: item.source?.name,
            dest_warehouse_name: item.dest?.name
        }));

        return { data: mappedData, total: count || 0 };
    },

    /**
     * Get Transfer Detail
     * Fetches header and joined items
     */
    getTransferDetail: async (id: number): Promise<TransferDetail | null> => {
        // Fetch Header
        const { data: header, error: headerError } = await supabase
            .from('inventory_transfers')
            .select(`
                *,
                source:source_warehouse_id(name),
                dest:dest_warehouse_id(name)
            `)
            .eq('id', id)
            .single();

        if (headerError) throw headerError;
        if (!header) return null;

        // Fetch Items
        const { data: items, error: itemsError } = await supabase
            .from('inventory_transfer_items')
            .select(`
                *,
                product:product_id(name, sku, wholesale_unit)
            `)
            .eq('transfer_id', id);

        if (itemsError) throw itemsError;

        // Map Header & Items
        const transferMaster: TransferMaster = {
            ...header,
            source_warehouse_name: header.source?.name,
            dest_warehouse_name: header.dest?.name
        };

        const transferItems = (items || []).map((item: any) => ({
            ...item,
            // Map DB columns (snake_case qty_) to TS interface (quantity_)
            quantity_requested: item.qty_requested,
            quantity_approved: item.qty_approved,
            quantity_shipped: item.qty_shipped,
            quantity_received: item.qty_received,
            conversion_factor: item.conversion_factor,
            
            // Product joins
            product_name: item.product?.name,
            sku: item.product?.sku,
            uom: item.unit // The unit saved in transfer_items IS the wholesale unit
        }));

        return {
            ...transferMaster,
            items: transferItems
        };
    },

    /**
     * Update Transfer Status
     */
    updateTransferStatus: async (id: number, status: TransferStatus) => {
        const { error } = await supabase
            .from('inventory_transfers')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
        return true;
    },

    /**
     * Approve Transfer
     * Update quantity_approved for items and status for header
     */
    approveTransfer: async (id: number, items: { id: number; qty_approved: number }[]) => {
        // 1. Update items (Loop for now as standard Supabase update doesn't support bulk update with different values easily without RPC)
        for (const item of items) {
            const { error: itemError } = await supabase
                .from('inventory_transfer_items')
                .update({ 
                    quantity_approved: item.qty_approved,
                    // If approved amount matches requested, we can auto-fill quantity_shipped in next step, 
                    // but for now just approve.
                })
                .eq('id', item.id);
            
            if (itemError) throw itemError;
        }

        // 2. Update Header Status
        const { error: headerError } = await supabase
            .from('inventory_transfers')
            .update({ 
                status: 'approved', 
                updated_at: new Date().toISOString() 
            })
            .eq('id', id);

        if (headerError) throw headerError;
        return true;
    },

    /**
     * Cancel Transfer
     */
    cancelTransfer: async (id: number, reason: string) => {
        // Get current note to append
        const { data: current } = await supabase
            .from('inventory_transfers')
            .select('note')
            .eq('id', id)
            .single();

        const newNote = (current?.note ? current.note + '\n' : '') + `[Cancelled]: ${reason}`;

        const { error } = await supabase
            .from('inventory_transfers')
            .update({ 
                status: 'cancelled', 
                note: newNote,
                updated_at: new Date().toISOString() 
            })
            .eq('id', id);

        if (error) throw error;
        return true;
    },

    /**
     * Fetch Source Batches
     * Returns batches available in source warehouse for specific product
     */
    fetchSourceBatches: async (productId: number, warehouseId: number) => {
        const { data, error } = await supabase.rpc('search_product_batches', {
            p_product_id: productId,
            p_warehouse_id: warehouseId
        });

        if (error) throw error;
        return data; // Returns array of batches with quantity
    },

    /**
     * Fetch Batches for ALL items in transfer (Optimization)
     */
    fetchBatchesForTransfer: async (items: { product_id: number }[], warehouseId: number) => {
        // Since we don't have a bulk RPC yet, we'll use Promise.all for V1
        // This is acceptable for typical transfer sizes (< 50 items)
        const promises = items.map(item => 
            supabase.rpc('search_product_batches', {
                p_product_id: item.product_id,
                p_warehouse_id: warehouseId
            }).then(res => ({ productId: item.product_id, batches: res.data || [] }))
        );
        
        const results = await Promise.all(promises);
        // Convert to map: productId -> batches[]
        const batchMap: Record<number, any[]> = {};
        results.forEach(res => {
            batchMap[res.productId] = res.batches;
        });
        
        return batchMap;
    },

    /**
     * Submit Shipping
     * Calls RPC: submit_transfer_shipping
     */
    submitShipping: async (transferId: number, items: { transfer_item_id: number; batch_id: number; quantity: number }[]) => {
        const { data, error } = await supabase.rpc('submit_transfer_shipping', {
            p_transfer_id: transferId,
            p_batch_items: items
        });

        if (error) throw error;
        return data;
    }
};

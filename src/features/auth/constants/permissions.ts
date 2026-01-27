export const PERMISSIONS = {
  INVENTORY: {
    VIEW_COST: 'inventory.product.view_cost',       // Xem Giá Vốn
    MANAGE_SUPPLIER: 'inventory.product.manage_supplier', // Xem/Sửa Nhà cung cấp
    EDIT_INFO: 'inventory.product.edit_info',       // Sửa thông tin chung
    VIEW_MARGIN_RETAIL: 'inventory.product.view_margin_retail',     // [NEW]
    VIEW_MARGIN_WHOLESALE: 'inventory.product.view_margin_wholesale', // [NEW]
  },
  MARKETING: {
    EDIT_CONTENT: 'marketing.content.edit',         // Sửa bài viết Marketing
  },
  ORDER: {
    DELETE_COMPLETED: 'order.delete_completed',     // Xóa đơn đã chốt
  },
  QUICK: {
    UNIT_SETUP: 'quick.unit_setup',
    LOCATION_UPDATE: 'quick.location_update',
    PRICE_UPDATE: 'quick.price_update',
    MIN_MAX: 'quick.min_max',
    BARCODE: 'quick.barcode_update',
    VOUCHER: 'quick.create_voucher',
    PRESCRIPTION: 'quick.prescription_template',
    VACCINATION: 'quick.vaccination_template',
  },
  // [NEW PHASE 2]
  PARTNER: {
    SUPPLIER: { 
      VIEW: 'partner.supplier.view', 
      CREATE: 'partner.supplier.create', 
      EDIT: 'partner.supplier.edit', 
      DELETE: 'partner.supplier.delete' 
    },
    SHIPPING: { 
      VIEW: 'partner.shipping.view', 
      CREATE: 'partner.shipping.create', 
      EDIT: 'partner.shipping.edit', 
      DELETE: 'partner.shipping.delete' 
    },
  },
  CRM: {
    B2C: { 
      VIEW: 'crm.b2c.view', 
      CREATE: 'crm.b2c.create', 
      EDIT: 'crm.b2c.edit', 
      DELETE: 'crm.b2c.delete' 
    },
    B2B: { 
      VIEW: 'crm.b2b.view', 
      CREATE: 'crm.b2b.create', 
      EDIT: 'crm.b2b.edit', 
      DELETE: 'crm.b2b.delete' 
    },
  },
  FINANCE: {
    VIEW_BALANCE: 'finance.view_balance',
  }
};

// Append to INVENTORY
// Note: Can't easily append to nested object with replace_file_content unless we replace the whole block or regex.
// I'll assume the user wants me to merge it into the existing structure.
// Let's retry the replacement strategy. I will replace the INVENTORY block first.

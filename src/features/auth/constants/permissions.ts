// Permission keys — PHẢI KHỚP với giá trị trong bảng role_permissions.permission_key
// DB hiện có 2 format: legacy (setting-view) và mới (crm.b2c.view)
// Constants dưới đây map đúng DB values

export const PERMISSIONS = {
  INVENTORY: {
    VIEW: "inv-product-view",
    VIEW_COST: "inventory.product.view_cost",
    MANAGE_SUPPLIER: "inventory.product.manage_supplier",
    EDIT_INFO: "inventory.product.edit_info",
    VIEW_MARGIN_RETAIL: "inventory.product.view_margin_retail",
    VIEW_MARGIN_WHOLESALE: "inventory.product.view_margin_wholesale",
  },
  PURCHASING: {
    VIEW: "inv-po-create",         // Legacy key — ai có quyền tạo PO cũng xem được
    CREATE: "inv-po-create",
    EDIT: "inv-po-create",
    COSTING: "inv-po-approve",     // Approve = được tính giá vốn
  },
  MEDICAL: {
    VIEW: "clinic",
    EXAMINE: "clinic-prescribe",
    RECEPTION: "clinic-inbox",
  },
  MARKETING: {
    EDIT_CONTENT: "marketing.content.edit",
  },
  ORDER: {
    DELETE_COMPLETED: "order.delete_completed",
  },
  SETTINGS: {
    VIEW: "setting-view",          // Legacy key
    PERMISSIONS: "setting-users",  // Legacy key
  },
  QUICK: {
    UNIT_SETUP: "quick.unit_setup",
    LOCATION_UPDATE: "quick.location_update",
    PRICE_UPDATE: "quick.price_update",
    MIN_MAX: "quick.min_max",
    BARCODE: "quick.barcode_update",
    VOUCHER: "quick.create_voucher",
    PRESCRIPTION: "quick.prescription_template",
    VACCINATION: "quick.vaccination_template",
  },
  PARTNER: {
    SUPPLIER: {
      VIEW: "partner.supplier.view",
      CREATE: "partner.supplier.create",
      EDIT: "partner.supplier.edit",
      DELETE: "partner.supplier.delete",
    },
    SHIPPING: {
      VIEW: "partner.shipping.view",
      CREATE: "partner.shipping.create",
      EDIT: "partner.shipping.edit",
      DELETE: "partner.shipping.delete",
    },
  },
  CRM: {
    B2C: {
      VIEW: "crm.b2c.view",
      CREATE: "crm.b2c.create",
      EDIT: "crm.b2c.edit",
      DELETE: "crm.b2c.delete",
    },
    B2B: {
      VIEW: "crm.b2b.view",
      CREATE: "crm.b2b.create",
      EDIT: "crm.b2b.edit",
      DELETE: "crm.b2b.delete",
    },
  },
  FINANCE: {
    VIEW_BALANCE: "finance.view_balance",
  },
  POS: {
    VIEW: "pos",
    CREATE: "pos-create",
    LIST: "pos-list",
  },
};

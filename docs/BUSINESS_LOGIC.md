# Nghiệp Vụ ERP Nam Việt

> Tài liệu tổng hợp logic nghiệp vụ đã triển khai. Claude đọc file này khi cần context về luồng kinh doanh.
> Cập nhật lần cuối: 2026-04-16

---

## 1. Mua Hàng (Purchasing)

### Vòng đời đơn mua (PO)
```
DRAFT → PENDING → APPROVED → ORDERING → COMPLETED
  ↓                                        
CANCELLED (bất kỳ lúc nào)
```

### Tính giá vốn (Costing)
```
final_unit_cost = (unit_price × (1 - rebate%) × (1 + VAT%) + allocated_shipping)
                  ÷ (quantity_ordered + bonus_quantity)
```

- **Phân bổ ship**: `ship[i] = total_shipping × (item_value / total_value)` — chỉ theo giá trị, skip item = 0
- **Rebate**: % giảm giá từ chương trình NCC, dựa trên doanh thu nhóm SP
- **Bonus**: Từ rule `buy_x_get_y` → `bonus = floor(qty / buy_qty) × get_qty` → chia đều vào giá vốn

### Chương trình NCC (Supplier Program)
| Rule | Logic |
|------|-------|
| `rebate_revenue` | Nếu doanh thu >= min_turnover → áp rebate % |
| `buy_x_get_y` | Mua X tặng Y sản phẩm |
| `buy_amt_get_gift` | Mua >= giá trị X → tặng quà (lưu `gift_items`) |

### RPC chính
| RPC | Mô tả |
|-----|-------|
| `create_purchase_order` | Tạo PO (DRAFT hoặc PENDING) |
| `confirm_purchase_order` | DRAFT → PENDING |
| `confirm_purchase_costing` | Chốt giá vốn, cập nhật `actual_cost` sản phẩm |
| `cancel_purchase_order` | Hủy đơn + audit log |
| `auto_create_purchase_orders_min_max` | Tự tạo PO dựa Min/Max kho |
| `create_full_supplier_program` | Tạo chương trình NCC + rules |

### Gotchas
- Items API trả key không nhất quán: `quantity_ordered` hoặc `quantity`, `uom_ordered` hoặc `unit` → phải map cả 2
- Confirm costing xong → `actual_cost` sản phẩm được cập nhật, snapshot giá cũ để so sánh impact
- Realtime subscription trên bảng `purchase_orders` → auto-refresh
- `update_purchase_order_logistics` cập nhật vận chuyển riêng, KHÔNG touch items

---

## 2. Tài Chính (Finance)

### Hóa đơn VAT
**3 cách nhập**: AI Scan ảnh (Gemini) | Upload XML (DLHDon) | Nhập thủ công

**Vòng đời**: `draft → verified → verified_outbound`
- Verify lần đầu → gọi `process_vat_invoice_entry` (cập nhật tồn kho VAT)
- Verify lần 2 → chỉ update payload, KHÔNG gọi RPC lần nữa (idempotent)
- Xuất VAT → `process_vat_export_entry` (trừ kho VAT, check constraint không âm)
- Xóa → `delete_invoice_atomic` (reverse VAT + delete trong 1 transaction)

**XML Parse**: DOMParser → trích TTChung, NBan, DSHHDVu

**Product Mapping 3 tầng**:
1. DB: `vendor_product_mappings` (tax_code + product_name + vendor_unit)
2. AI: Token matching (name/SKU/barcode)
3. User chọn thủ công

**Auto-Learn**: Khi verify XML → lưu mapping cho lần sau

### Thu/Chi (Finance Transaction)
| Loại | Luồng |
|------|-------|
| `trade` (mua/bán) | Lập phiếu → duyệt → hoàn tất |
| `advance` (tạm ứng) | Lập → duyệt |
| `reimbursement` (hoàn ứng) | Tham chiếu phiếu tạm ứng cũ → cập nhật cũ thành completed |
| `other` | Linh hoạt |

### Gạch nợ B2B (Bulk Payment Allocation)
- Lấy nợ: `b2b_customer_debt_view` → `actual_current_debt`
- Waterfall: sắp đơn cũ → mới, cấp phát tiền cho đến hết
- `process_bulk_payment` → tạo transaction + cập nhật `payment_status` (paid/partial)
- Tiền dư → lập phiếu tạm ứng riêng

### Đối soát ngân hàng
- Quỹ: type=`cash` (tiền mặt) hoặc `bank` (ngân hàng + account_number + bank_id)
- Sync VietQR: `syncBanksFromVietQR()` → fetch API vietqr.io → upsert DB

### RPC chính
| RPC | Mô tả |
|-----|-------|
| `process_vat_invoice_entry` | Nhập kho VAT |
| `process_vat_export_entry` | Xuất kho VAT |
| `delete_invoice_atomic` | Xóa invoice + reverse VAT |
| `check_invoice_exists` | Check trùng (tax_code + symbol + number) |
| `process_bulk_payment` | Gạch nợ hàng loạt |
| `create_finance_transaction` | Tạo phiếu thu/chi |
| `confirm_finance_transaction` | Duyệt phiếu |

---

## 3. Kho Hàng (Inventory)

### Nhập kho (Inbound)
- Nhận phiếu từ PO → xử lý SL theo đơn vị (quy đổi 3 tầng), lô, hạn
- `process_inbound_receipt` → ghi `inventory_receipts` + `inventory_receipt_items`
- `allocate_inbound_costs` → phân bổ chi phí vào giá vốn (Landed Cost)
- Hỗ trợ draft data restoration (khôi phục tiến độ nhập trước đó)

### Xuất kho (Outbound)
- Luồng: Bốc hàng (picking) → Xác nhận → Đóng gói → Giao
- `confirm_outbound_packing` → xác nhận packing
- `save_outbound_progress` → lưu SL bốc tạm (draft)
- `handover_to_shipping` → bàn giao vận chuyển
- Optimistic update package count, rollback nếu fail

### Chuyển kho (Transfer)
```
pending → approved → shipping → completed
```
- Hỗ trợ auto-replenishment hoặc thủ công
- FEFO pre-allocation: tự động phân bổ lô ngay khi init (oldest expiry first)
- `confirm_transfer_outbound_fefo` → backend chọn lô tự động
- `confirm_transfer_inbound` → nhập kho đích

### Kiểm kê (Inventory Check)
- Scope: ALL | CATEGORY | MANUFACTURER | CABINET | SUPPLIER
- Snapshot tồn máy + giá vốn lúc tạo phiếu
- 3-tier quantity input (hộp/lẻ/viên) + barcode scan + tách lô
- Per-item debounce (`Map<itemId, debounce>`) để tránh mất data khi edit nhiều item
- `complete_inventory_check` → cập nhật tồn kho hệ thống theo chênh lệch

### Quy đổi đơn vị 3 tầng
```
Wholesale (Thùng) ←rate→ Retail (Hộp) ←rate→ Base (Viên)
total_base = (wholesale_qty × wholesale_rate) + (retail_qty × retail_rate) + base_qty
```
- Dùng `moneyMul`, `moneyAdd`, `moneySub` tránh lỗi floating point

### Thẻ kho (Cardex)
- `get_product_cardex` → lịch sử giao dịch per SP/kho
- Type: in/out | Business type: sale, purchase, import, export, check

### Gotchas
- Unit parsing: tìm Base (is_base/rate=1) → lọc trùng tên → Retail/Wholesale theo unit_type
- Batch split kiểm kê: tạo record qty=0 cho lô mới
- FEFO pre-allocation khi init transfer, user chỉ cần update SL
- Location snapshot kiểm kê (cabinet-row-slot)

---

## 4. Bán Hàng B2B (Sales)

### Vòng đời đơn bán
```
DRAFT → QUOTE → CONFIRMED → SHIPPED → DELIVERED
```

### Logic giá & giảm giá
- B2B dùng `price_wholesale`
- Manual discount ưu tiên hơn voucher (nếu > 0)
- Voucher: `fixed` hoặc `percent` (có `min_order_value`, `max_discount_value`)
- `final = subTotal + shippingFee - discountAmount`
- Discount tự động cap ≤ subTotal

### Hạn mức công nợ
- `CREDIT_LIMIT_ENABLED = false` (tạm tắt, chờ data chuẩn)
- Logic: `currentDebt + orderAmount > debtLimit` → từ chối
- Nợ lấy từ `b2b_customer_debt_view` (real-time)

### Vận chuyển
- Phương thức: `internal` | `app` (hãng VC) | `coach` (xe khách)
- Cut-off time: quá giờ chốt → 8:00 sáng hôm sau
- Phí: `base_fee` + phụ phí theo kiện

### Thanh toán
- `bulk_pay_orders` → xác nhận thu tiền hàng loạt
- `confirm_order_payment` → ghi nợ theo fund_account_id
- Tổng phải trả = `finalTotal + oldDebt`

### RPC chính
| RPC | Mô tả |
|-----|-------|
| `create_sales_order` | Tạo đơn B2B/POS |
| `get_sales_orders_view` | Liệt kê đơn + thống kê |
| `update_sales_order` | Chỉnh sửa (DRAFT/QUOTE) |
| `cancel_order` | Hủy đơn + lý do |
| `clone_sales_order` | Nhân bản đơn cũ |
| `process_sales_return` | Trả hàng |
| `get_available_vouchers` | Voucher khả dụng cho B2B |

---

## 5. Bán Lẻ POS

### Luồng
```
Tìm khách → Tìm SP (barcode/search) → Thêm giỏ → Voucher → Thanh toán → Lưu
```

### Multi-tab
- Hỗ trợ 2+ đơn song song (F1 tạo tab), persist localStorage (`pos-cart-multi-tab`)
- ≤1 tab → chỉ clear data, KHÔNG xóa tab
- Voucher stale detection: bỏ kết quả nếu tab đã thay đổi

### Tính toán
- Dùng `retail_price` (khác B2B dùng `price_wholesale`)
- Hàm `money*()` bắt buộc cho mọi tính toán
- `amountGiven - grandTotal` = tiền thừa (F8 input)
- Thanh toán: cash | credit | bank_transfer (cho phép bán chịu)

### Gotchas
- Stock validation client-side trước khi add/update quantity
- Default warehouse từ `auth.profile?.warehouse_id`
- Search truyền `warehouse_id` để lấy đúng stock

---

## 6. Sản Phẩm (Product)

### Hệ đơn vị 4 tầng
| Tầng | Dùng cho |
|------|---------|
| Base (Cơ sở) | Đơn vị nhỏ nhất, `is_base: true`, `conversion_rate: 1` |
| Retail (Lẻ) | Bán lẻ, giá cao nhất |
| Wholesale (Sỉ) | Bán sỉ, giá trung bình |
| Logistics | Vận chuyển/nhập kho (items per carton) |

Mỗi unit lưu `product_units` với `unit_type` enum. Hỗ trợ barcode riêng.

### Định giá Margin
- `actual_cost` (tự động từ costing) → `wholesale_margin` → `retail_margin`
- Margin type: `percent` hoặc `amount`
- Backend tự tính `price` nếu unit chưa có giá

### AI Scanner
- Edge Function `scan-product-ai`: ảnh/PDF → Gemini → JSON (tên, barcode, units, giá, hoạt chất)

### Master Data
- `registration_number`, `packing_spec`, `active_ingredient` (tags)
- `inventory_settings`: Min/Max stock, shelf location per warehouse
- `product_contents`: Marketing HTML (channel='website')
- `usage_instructions`: JSONB theo lứa tuổi (0_2, 2_6, 6_18, 18_plus, contraindication)

### Gotchas
- Soft delete (`status: 'deleted'`) — không xóa thật
- Dependency check trước delete/deactivate
- Inventory settings: client gửi Object → backend nhận Array
- Base unit PHẢI `is_base: true`, nếu không → pricing sai

---

## 7. Phân Quyền (Auth & RBAC)

### Cấu trúc
- `roles` → `role_permissions` → `permissions` (N-N)
- Permission key: legacy (`setting-view`) + mới (`crm.b2c.view`)
- 40+ quyền, group theo module

### Luồng user
```
Đăng ký → pending_approval → approve_user RPC → active
```
- Admin gán role theo branch: `update_user_assignments`
- Onboarding: check `profile_updated_at` để trigger profile update

### Gotchas
- Permission tree có GROUP_ prefix keys → PHẢI lọc bỏ trước save
- `get_my_permissions` gọi với `silent: true` → fail không throw
- Supabase `onAuthStateChange` → auto clear store khi token hết

---

## 8. Y Tế (Medical)

### Khám bệnh (5 blocks)
1. **Hành chính**: Thông tin KH, lịch sử khám, sao chép đơn cũ
2. **Lâm sàng**: Sinh hiệu (mạch, nhiệt, SpO2, HA, cân nặng, chiều cao), form theo độ tuổi
3. **Chỉ định dịch vụ**: Tìm + thêm dịch vụ cận lâm sàng (lab, imaging)
4. **Kê đơn**: Tìm thuốc, liều lượng, kiểm tra dị ứng, "Gửi Dược sĩ" → chọn nhà thuốc
5. **Kết thúc**: In phiếu, tái khám (follow-up appointment), lưu (in_progress/finished/ready_for_vaccine)

### AI Assistant (SmartClinicalAssistant)
- Sốt >= 38.5°C → Gợi ý Paracetamol
- HA >= 140 mmHg → Gợi ý ECG + siêu âm tim
- SpO2 < 95% → Gợi ý O2 + X-quang phổi
- Keyword: "ho"+"đờm" → Viêm phế quản cấp; "đau họng"+"sốt" → Test cúm A/B

### Điều dưỡng
- `get_nurse_execution_queue` → queue tiêm hôm nay
- `execute_vaccination_combo` → scan barcode vắc-xin → tự tính tiền + sổ tiêm chủng

### Cận lâm sàng
- Lab: nhập kết quả số + phân loại theo `lab_indicators_config`
- Imaging: upload ảnh + mô tả, template theo dịch vụ

---

## 9. Đặt Lịch (Booking)

### Luồng
1. Chọn KH (tìm/tạo mới B2C)
2. Body Map: SVG 7 vùng cơ thể → click chọn triệu chứng
3. Symptom tags: đánh dấu "Khẩn cấp" (isUrgent)
4. Submit: `create_appointment_booking` hoặc `check_in_patient` (vào queue ngay)

---

## 10. CRM

### Khách hàng
- B2C: `get_customers_b2c_list` (search, status, pagination)
- B2B: tương tự, phân biệt `type_filter`

### Phân khúc (Segmentation)
- **Static**: thành viên cố định (thêm/xóa tay)
- **Dynamic**: criteria tự động (gender, birthday month, age range, loyalty points, last purchase)
- `refresh_segment_members` → chạy lại criteria

### Phân phối voucher
- Chọn voucher + segment → `distribute_voucher_to_segment`
- Trả về số KH được nhận

---

## 11. Shared Utilities & Patterns

### safeRpc (BẮT BUỘC)
- Wrapper cho mọi RPC call
- Auto detect JWT expired → redirect login + toast tiếng Việt
- Translate PG error codes (P0001, 23505, 23503, 42501) → Vietnamese

### Money Utils (BẮT BUỘC cho tính toán tiền)
- SCALE = 1000, tính trên integer domain
- `moneyAdd/Sub/Mul/Div`, `moneySum`, `moneyLineTotal`, `moneyVat`
- `calcInvoiceTotals()` → pre-tax, tax, final
- `fmtMoney()` → format VND (max 3 decimal, bỏ trailing 0)

### Quy tắc tham số RPC
- `timestamptz/bigint/uuid/date` → `|| null`, KHÔNG BAO GIỜ `|| ""`
- Chỉ `text/varchar` mới được `|| ""`

### Edge Functions
| Function | Mô tả |
|----------|-------|
| `scan-product-ai` | Gemini: scan ảnh/PDF SP → JSON |
| `scan-invoice-gemini` | OCR hóa đơn → extract data |
| `scan-product-label` | Scan nhãn SP |
| `create-user` | Tạo user mới |
| `sepay-proxy` | Payment gateway proxy |
| `webhook-timo` | Timo payment webhook |
| `notify` | Notification engine (cron) |
| `approve-registration` | B2B registration approval |

### Shared Components
- `SmartTable`, `DebounceSelect`, `DebounceCustomerSelect`, `DebounceProductSelect`
- `UniversalCustomerSelect`, `SupplierSelectModal`, `AIVisionCamera`, `ScannerListener`
- `VoiceCommander`, `StandardPagination`, `StatHeader`, `TextEditor`

# Notification Fixes — Navigate + Deploy + View All

## Boi canh

3 van de voi notification system:
1. Click notification khong navigate — migration chua apply, `category` = NULL
2. Portal khong nhan thong bao + ERP lich su gui trong — Edge Function `notify` chua deploy
3. Khong co button "Xem tat ca" va trang danh sach thong bao admin

## Fix 1: Apply migration (click navigate)

Migration `20260415100000_notification_click_navigation.sql` da co san trong repo. Can apply vao DB (local + prod).

Migration lam gi:
- Them cot `category` TEXT + `metadata` JSONB vao `notifications` table
- Update 7 trigger functions de set `category` khi insert
- Backfill notifications cu dua tren title pattern

Sau khi apply, frontend code da co san (`getNotificationLink()` trong `NotificationBell.tsx`) se hoat dong:
- `portal_order` → `/b2b/orders/{reference_id}`
- `portal_registration` → `/portal/registrations`
- `payment_received` → `/finance/transactions`
- `purchase_order` → `/purchase-orders/{po_id}`
- `expense_approval` → `/finance/transactions`

**Khong can sua frontend code.**

## Fix 2: Deploy Edge Function `notify`

Edge Function `supabase/functions/notify/index.ts` da code dung. Can deploy:
```
supabase functions deploy notify
```

Sau khi deploy:
- ERP ComposeNotificationForm goi `supabase.functions.invoke('notify')` → insert vao `b2b_notifications`
- Portal nhan qua Supabase Realtime
- ERP "Lich su gui" (`get_notification_history` RPC) hien data tu `b2b_notifications`

Fallback (local dev khong co Edge Functions): Them API route proxy trong ERP hoac Portal de insert truc tiep vao `b2b_notifications`.

## Fix 3: Button "Xem tat ca" + trang /notifications

### 3a. NotificationBell — them button "Xem tat ca"

Vi tri: cuoi popover, duoi danh sach notifications.
Click → navigate `/notifications`, dong popover.

### 3b. Trang /notifications (moi)

Route: `/notifications` (khong can PermissionGuard, query filter `user_id` tu auth)

UI:
- Filter theo `category`: tat ca, don hang portal, dang ky, thanh toan, mua hang, KPI
- Table: Tieu de, Loai (tag color), Thoi gian, Trang thai doc
- Click row → navigate toi nguon (dung `getNotificationLink()` da co)
- Button "Danh dau tat ca da doc" (goi RPC `mark_all_notifications_read`)
- Pagination 20 items/page

Data source: `notifications` table, filter `user_id = auth.uid()`, order by `created_at DESC`

Can RPC moi: `get_my_notifications(p_category, p_page, p_page_size)` tra ve paginated list.

## Files thay doi

### ERP (`nam_viet_erp/`)

| File | Action |
|------|--------|
| Migration SQL | **Apply** vao DB (local + prod) |
| Edge Function `notify` | **Deploy** len Supabase |
| `src/features/notifications/components/NotificationBell.tsx` | **Sua** — them button "Xem tat ca" |
| `src/pages/notifications/NotificationsPage.tsx` | **Tao moi** — trang danh sach |
| `src/app/router/index.tsx` | **Sua** — them route `/notifications` |
| Migration moi: RPC `get_my_notifications` + `mark_all_notifications_read` | **Tao moi** |

### Portal (`duoc-pham-web-portal/`)

Khong can thay doi. Portal da co NotificationBell doc tu `b2b_notifications` + Realtime. Chi can Edge Function deploy la Portal nhan duoc thong bao.

## Verification

1. Apply migration → click "Don hang Portal moi" trong ERP bell → navigate toi `/b2b/orders/{id}`
2. Deploy notify → ERP gui thong bao → Portal nhan duoc trong bell
3. ERP "Lich su gui" hien thong bao da gui
4. Click "Xem tat ca" → mo trang `/notifications` voi full list
5. Filter theo category hoat dong
6. "Danh dau tat ca da doc" clear badge count

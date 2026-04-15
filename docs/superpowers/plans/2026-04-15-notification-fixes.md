# Notification Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix notification click navigation, deploy Edge Function for Portal notifications, add "Xem tất cả" button + full notifications page.

**Architecture:** Apply pending migration for `category`/`metadata` columns. Create new RPCs for admin notification queries. Build a new `NotificationsPage` with filter/pagination. Deploy `notify` Edge Function.

**Tech Stack:** React 19, Ant Design 5, Zustand, Supabase RPCs, Supabase Edge Functions (Deno)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/20260415100000_notification_click_navigation.sql` | **Apply to DB** | Add category/metadata + update triggers |
| `supabase/migrations/20260415120000_admin_notification_rpcs.sql` | **Create** | RPCs: get_my_notifications, mark_all_my_notifications_read |
| `src/pages/notifications/NotificationsPage.tsx` | **Create** | Full notification list page |
| `src/features/notifications/components/NotificationBell.tsx` | **Modify** | Add "Xem tất cả" button |
| `src/features/settings/stores/useNotificationStore.ts` | **Modify** | Add markAllAsRead action |
| `src/app/router/index.tsx` | **Modify** | Add /notifications route |
| `supabase/functions/notify/index.ts` | **Deploy** | Edge Function for Portal notifications |

---

### Task 1: Apply navigation migration to DB

**Files:**
- Apply: `supabase/migrations/20260415100000_notification_click_navigation.sql`

- [ ] **Step 1: Apply migration to local Supabase**

Run from `d:/Lwcifer/Namviet/nam_viet_erp`:

```bash
npx supabase db push
```

Or apply directly:

```bash
npx supabase db query -f supabase/migrations/20260415100000_notification_click_navigation.sql
```

- [ ] **Step 2: Verify migration applied**

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
(async () => {
  const { data } = await sb.from('notifications').select('id, category, metadata').limit(5);
  console.log('Columns exist:', data !== null);
  console.log('Sample:', JSON.stringify(data?.[0]));
})();
"
```

Expected: `category` and `metadata` columns exist, backfill applied to old notifications.

- [ ] **Step 3: Apply to production**

```bash
npx supabase db push --linked
```

Or via Supabase Dashboard SQL editor: paste contents of the migration file.

- [ ] **Step 4: Verify ERP notification click navigates**

Open ERP → click bell → click "Đơn hàng Portal mới" → should navigate to `/b2b/orders/{id}`.

---

### Task 2: Create admin notification RPCs

**Files:**
- Create: `supabase/migrations/20260415120000_admin_notification_rpcs.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/20260415120000_admin_notification_rpcs.sql`:

```sql
-- =============================================================================
-- Admin Notification RPCs
-- Date: 2026-04-15
-- 1. get_my_notifications — paginated list for current user
-- 2. mark_all_my_notifications_read — bulk mark read for current user
-- =============================================================================

BEGIN;

-- 1. get_my_notifications
CREATE OR REPLACE FUNCTION public.get_my_notifications(
  p_category TEXT DEFAULT NULL,
  p_page     INT DEFAULT 1,
  p_page_size INT DEFAULT 20
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_offset INT := (GREATEST(p_page, 1) - 1) * p_page_size;
  v_total  INT;
  v_data   JSON;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM public.notifications n
  WHERE n.user_id = auth.uid()
    AND (p_category IS NULL OR n.category = p_category);

  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_data
  FROM (
    SELECT
      n.id,
      n.title,
      n.message,
      n.type,
      n.is_read,
      n.category,
      n.metadata,
      n.reference_id,
      n.created_at
    FROM public.notifications n
    WHERE n.user_id = auth.uid()
      AND (p_category IS NULL OR n.category = p_category)
    ORDER BY n.created_at DESC
    LIMIT p_page_size OFFSET v_offset
  ) t;

  RETURN json_build_object(
    'data', v_data,
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size
  );
END;
$$;

-- 2. mark_all_my_notifications_read
CREATE OR REPLACE FUNCTION public.mark_all_my_notifications_read()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = auth.uid()
    AND is_read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.get_my_notifications(TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_my_notifications_read() TO authenticated;

COMMIT;
```

- [ ] **Step 2: Apply migration**

```bash
cd d:/Lwcifer/Namviet/nam_viet_erp
npx supabase db query -f supabase/migrations/20260415120000_admin_notification_rpcs.sql
```

- [ ] **Step 3: Verify RPCs work**

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
(async () => {
  // Test with service_role (auth.uid() will be null — expect empty result, no error)
  const { data, error } = await sb.rpc('get_my_notifications', { p_page: 1, p_page_size: 5 });
  console.log('RPC exists:', !error || !error.message.includes('not find'));
  console.log('Result:', JSON.stringify(data));
  console.log('Error:', error?.message);
})();
"
```

- [ ] **Step 4: Commit**

```bash
cd d:/Lwcifer/Namviet/nam_viet_erp
git add -f supabase/migrations/20260415120000_admin_notification_rpcs.sql
git commit -m "feat: RPCs get_my_notifications + mark_all_my_notifications_read"
```

---

### Task 3: Add "Xem tất cả" button + markAllAsRead to NotificationBell

**Files:**
- Modify: `src/features/notifications/components/NotificationBell.tsx`
- Modify: `src/features/settings/stores/useNotificationStore.ts`

- [ ] **Step 1: Add markAllAsRead to store**

In `src/features/settings/stores/useNotificationStore.ts`, add to the interface and implementation:

After line 31 (`markAsRead: (id: string) => void;`), add:
```typescript
  markAllAsRead: () => void;
```

After the `markAsRead` implementation (after line 59), add:
```typescript

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    })),
```

- [ ] **Step 2: Add "Xem tất cả" button and "Đọc tất cả" to NotificationBell**

In `src/features/notifications/components/NotificationBell.tsx`:

Add import `RightOutlined, CheckOutlined` at line 2:
```typescript
import { BellOutlined, RightOutlined, CheckOutlined } from "@ant-design/icons";
```

Add `Divider` to Ant Design imports at line 3:
```typescript
import { Badge, Button, Divider, List, Popover, Typography, Empty, Avatar } from "antd";
```

Add `markAllAsRead` from store at line 56:
```typescript
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
```

Add handler after `handleClick` function (after line 97):
```typescript
  const handleMarkAllRead = async () => {
    markAllAsRead();
    await safeRpc("mark_all_my_notifications_read", undefined, { silent: true });
  };

  const handleViewAll = () => {
    setOpen(false);
    navigate("/notifications");
  };
```

Replace the `content` JSX (lines 100-148) with:

```tsx
  const content = (
    <div style={{ width: 350 }}>
      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        <List
          dataSource={notifications}
          locale={{ emptyText: <Empty description="Không có thông báo mới" /> }}
          renderItem={(item) => {
            const hasLink = !!getNotificationLink(item);
            return (
              <List.Item
                style={{
                  background: item.is_read ? "white" : "#e6f7ff",
                  cursor: "pointer",
                  padding: "8px 12px",
                }}
                onClick={() => handleClick(item)}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      style={{
                        backgroundColor:
                          item.type === "warning" ? "#ff4d4f" : "#1890ff",
                      }}
                      icon={<BellOutlined />}
                    />
                  }
                  title={
                    <Typography.Text
                      strong={!item.is_read}
                      style={hasLink ? { color: "#1890ff" } : undefined}
                    >
                      {item.title}
                    </Typography.Text>
                  }
                  description={
                    <div>
                      <div>{item.message}</div>
                      <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                        {dayjs(item.created_at).fromNow()}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      </div>
      <Divider style={{ margin: 0 }} />
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px" }}>
        {unreadCount > 0 && (
          <Button
            type="link"
            size="small"
            icon={<CheckOutlined />}
            onClick={handleMarkAllRead}
          >
            Đọc tất cả
          </Button>
        )}
        <Button
          type="link"
          size="small"
          onClick={handleViewAll}
          style={{ marginLeft: "auto" }}
        >
          Xem tất cả <RightOutlined />
        </Button>
      </div>
    </div>
  );
```

- [ ] **Step 3: Verify build**

```bash
cd d:/Lwcifer/Namviet/nam_viet_erp && npm run build
```

- [ ] **Step 4: Commit**

```bash
cd d:/Lwcifer/Namviet/nam_viet_erp
git add src/features/notifications/components/NotificationBell.tsx src/features/settings/stores/useNotificationStore.ts
git commit -m "feat: NotificationBell them Xem tat ca + Doc tat ca"
```

---

### Task 4: Create NotificationsPage + route

**Files:**
- Create: `src/pages/notifications/NotificationsPage.tsx`
- Modify: `src/app/router/index.tsx`

- [ ] **Step 1: Create NotificationsPage**

Create `src/pages/notifications/NotificationsPage.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  Tag,
  Button,
  Select,
  Typography,
  Space,
  Card,
} from "antd";
import {
  BellOutlined,
  CheckOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi";

import { safeRpc } from "@/shared/lib/safeRpc";
import {
  AppNotification,
  NotificationCategory,
  useNotificationStore,
} from "@/features/settings/stores/useNotificationStore";

dayjs.extend(relativeTime);
dayjs.locale("vi");

const PAGE_SIZE = 20;

const CATEGORY_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: "portal_order", label: "Đơn hàng Portal", color: "blue" },
  { value: "portal_registration", label: "Đăng ký Portal", color: "cyan" },
  { value: "payment_received", label: "Thanh toán", color: "green" },
  { value: "sales_payment", label: "Tiền về", color: "green" },
  { value: "expense_approval", label: "Duyệt chi", color: "orange" },
  { value: "purchase_order", label: "Đơn mua hàng", color: "purple" },
  { value: "task_update", label: "Công việc", color: "geekblue" },
];

function getCategoryTag(category: string | null | undefined) {
  const opt = CATEGORY_OPTIONS.find((o) => o.value === category);
  if (!opt) return <Tag>Khác</Tag>;
  return <Tag color={opt.color}>{opt.label}</Tag>;
}

/** Reuse from NotificationBell — map category to route */
function getNotificationLink(noti: {
  category?: NotificationCategory | null;
  reference_id?: string | null;
  metadata?: Record<string, unknown> | null;
}): string | null {
  const meta = noti.metadata as Record<string, unknown> | null;
  switch (noti.category) {
    case "purchase_order": {
      const poId = meta?.po_id;
      return poId ? `/purchase-orders/${poId}` : "/purchase-orders";
    }
    case "expense_approval":
    case "payment_received":
    case "sales_payment":
      return "/finance/transactions";
    case "portal_order":
      return noti.reference_id
        ? `/b2b/orders/${noti.reference_id}`
        : "/b2b/orders";
    case "portal_registration":
      return "/portal/registrations";
    case "task_update":
      return "/hr/kpi";
    default:
      return null;
  }
}

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  category: string | null;
  metadata: Record<string, unknown> | null;
  reference_id: string | null;
  created_at: string;
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);

  const [data, setData] = useState<NotificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<string | undefined>(undefined);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: result, error } = await safeRpc("get_my_notifications", {
      p_category: category || null,
      p_page: page,
      p_page_size: PAGE_SIZE,
    });
    if (!error && result) {
      const parsed = result as { data: NotificationRow[]; total: number };
      setData(parsed.data ?? []);
      setTotal(parsed.total ?? 0);
    }
    setLoading(false);
  }, [page, category]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMarkAllRead = async () => {
    markAllAsRead();
    await safeRpc("mark_all_my_notifications_read", undefined, {
      silent: true,
    });
    fetchData();
  };

  const handleRowClick = async (record: NotificationRow) => {
    if (!record.is_read) {
      await safeRpc(
        "mark_notification_read",
        { p_noti_id: record.id },
        { silent: true }
      );
    }
    const link = getNotificationLink(record as AppNotification);
    if (link) navigate(link);
  };

  const columns = [
    {
      title: "Tiêu đề",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      render: (text: string, record: NotificationRow) => (
        <Typography.Text strong={!record.is_read}>
          {text}
        </Typography.Text>
      ),
    },
    {
      title: "Loại",
      dataIndex: "category",
      key: "category",
      width: 160,
      render: (cat: string | null) => getCategoryTag(cat),
    },
    {
      title: "Thời gian",
      dataIndex: "created_at",
      key: "created_at",
      width: 160,
      render: (d: string) => (
        <Typography.Text type="secondary">
          {dayjs(d).fromNow()}
        </Typography.Text>
      ),
    },
    {
      title: "",
      key: "action",
      width: 40,
      render: (_: unknown, record: NotificationRow) => {
        const link = getNotificationLink(record as AppNotification);
        return link ? (
          <ArrowRightOutlined style={{ color: "#1890ff" }} />
        ) : null;
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          <BellOutlined style={{ marginRight: 8 }} />
          Thông báo
        </Typography.Title>
        <Space>
          <Select
            allowClear
            placeholder="Lọc theo loại"
            style={{ width: 200 }}
            options={CATEGORY_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            value={category}
            onChange={(val) => {
              setCategory(val);
              setPage(1);
            }}
          />
          <Button icon={<CheckOutlined />} onClick={handleMarkAllRead}>
            Đọc tất cả
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: {
              cursor: getNotificationLink(record as AppNotification)
                ? "pointer"
                : "default",
              background: record.is_read ? undefined : "#e6f7ff",
            },
          })}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (t) => `${t} thông báo`,
          }}
        />
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Add route**

In `src/app/router/index.tsx`, add lazy import near the top with other page imports:

```typescript
const NotificationsPage = lazy(() => import("@/pages/notifications/NotificationsPage"));
```

Add the route inside the `ProtectedLayout` children array (before or after the portal routes section, around line 510):

```typescript
          {
            path: "notifications",
            element: <NotificationsPage />,
          },
```

- [ ] **Step 3: Verify build**

```bash
cd d:/Lwcifer/Namviet/nam_viet_erp && npm run build
```

- [ ] **Step 4: Commit**

```bash
cd d:/Lwcifer/Namviet/nam_viet_erp
git add src/pages/notifications/NotificationsPage.tsx src/app/router/index.tsx
git commit -m "feat: trang /notifications voi filter + pagination"
```

---

### Task 5: Deploy Edge Function `notify`

- [ ] **Step 1: Deploy to Supabase**

```bash
cd d:/Lwcifer/Namviet/nam_viet_erp
npx supabase functions deploy notify
```

If using linked project:
```bash
npx supabase functions deploy notify --project-ref <project-ref>
```

- [ ] **Step 2: Verify Edge Function works**

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../duoc-pham-web-portal/.env.local' });
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
(async () => {
  const { data, error } = await sb.functions.invoke('notify', {
    body: { type: 'system', customer_b2b_id: null, title: 'Test deploy', body: 'Edge Function hoat dong' },
  });
  console.log('Response:', JSON.stringify(data));
  console.log('Error:', error?.message);

  // Verify b2b_notifications has the record
  const { data: notifs } = await sb.from('b2b_notifications').select('id, title').order('created_at', { ascending: false }).limit(1);
  console.log('Latest notification:', JSON.stringify(notifs?.[0]));
})();
"
```

Expected: `{ success: true, notification_id: "..." }` and record in `b2b_notifications`.

- [ ] **Step 3: Test from ERP compose form**

Open ERP → `/portal/notifications` → tab "Gửi thông báo" → fill form → send.
Verify: tab "Lịch sử gửi" shows the sent notification.

- [ ] **Step 4: Test Portal receives notification**

Open Portal (`localhost:3456`) → login → check notification bell.
Expected: notification from ERP appears in bell dropdown.

---

### Task 6: Manual verification

- [ ] **Step 1: ERP notification click navigation**

Click "Đơn hàng Portal mới" in bell → navigates to `/b2b/orders/{id}`.
Click "Đăng ký Portal mới" → navigates to `/portal/registrations`.

- [ ] **Step 2: "Xem tất cả" button**

Click bell → click "Xem tất cả" → navigates to `/notifications`.
Full page shows all notifications with filter + pagination.

- [ ] **Step 3: "Đọc tất cả" button**

Click "Đọc tất cả" in bell popover → badge count resets to 0.
All notifications turn white background.

- [ ] **Step 4: Filter on notifications page**

Select "Đơn hàng Portal" from filter → only portal_order notifications shown.
Clear filter → all notifications shown.

- [ ] **Step 5: Portal notification delivery**

ERP admin sends notification via compose form.
Portal customer sees it in bell (via Realtime).
ERP "Lịch sử gửi" tab shows the record.

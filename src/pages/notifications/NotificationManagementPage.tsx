import { Card, Tabs } from 'antd'
import { useState } from 'react'
import { ComposeNotificationForm } from '@/features/notifications/components/ComposeNotificationForm'
import { NotificationHistoryTable } from '@/features/notifications/components/NotificationHistoryTable'

export default function NotificationManagementPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>Quản lý thông báo Portal</h2>
      <Tabs
        items={[
          {
            key: 'compose',
            label: 'Gửi thông báo',
            children: (
              <Card>
                <ComposeNotificationForm onSent={() => setRefreshKey((k) => k + 1)} />
              </Card>
            ),
          },
          {
            key: 'history',
            label: 'Lịch sử gửi',
            children: (
              <Card>
                <NotificationHistoryTable refreshKey={refreshKey} />
              </Card>
            ),
          },
        ]}
      />
    </div>
  )
}

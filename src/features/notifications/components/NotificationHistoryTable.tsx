import { useEffect, useState } from 'react'
import { Tag } from 'antd'
import dayjs from 'dayjs'
import { SmartTable } from '@/shared/ui/listing/SmartTable'
import { safeRpc } from '@/shared/lib/safeRpc'
import type { ColumnsType } from 'antd/es/table'

interface NotificationHistory {
  id: string
  type: string
  title: string
  body: string
  customer_name: string | null
  customer_b2b_id: number | null
  created_at: string
}

const TYPE_TAG: Record<string, { color: string; label: string }> = {
  promotion: { color: 'purple', label: 'Khuyến mãi' },
  system: { color: 'default', label: 'Hệ thống' },
  order_status: { color: 'blue', label: 'Đơn hàng' },
  debt_reminder: { color: 'orange', label: 'Công nợ' },
  invoice: { color: 'green', label: 'Hóa đơn' },
  broadcast: { color: 'cyan', label: 'Broadcast' },
}

export function NotificationHistoryTable({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<NotificationHistory[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const PAGE_SIZE = 20

  useEffect(() => {
    fetchData()
  }, [page, refreshKey])

  async function fetchData() {
    setLoading(true)
    const { data: result, error } = await safeRpc('get_notification_history', {
      p_page: page,
      p_page_size: PAGE_SIZE,
    })

    if (!error && result) {
      const parsed = result as unknown as { data: NotificationHistory[]; total: number }
      setData(parsed.data || [])
      setTotal(parsed.total || 0)
    }
    setLoading(false)
  }

  const columns: ColumnsType<NotificationHistory> = [
    { title: 'Tiêu đề', dataIndex: 'title', width: 250, ellipsis: true },
    {
      title: 'Loại',
      dataIndex: 'type',
      width: 120,
      render: (type: string) => {
        const t = TYPE_TAG[type] || { color: 'default', label: type }
        return <Tag color={t.color}>{t.label}</Tag>
      },
    },
    {
      title: 'Đối tượng',
      width: 200,
      ellipsis: true,
      render: (_: unknown, record: NotificationHistory) =>
        record.customer_b2b_id === null
          ? 'Tất cả khách hàng'
          : (record.customer_name || `KH #${record.customer_b2b_id}`),
    },
    {
      title: 'Ngày gửi',
      dataIndex: 'created_at',
      width: 160,
      render: (d: string) => dayjs(d).format('DD/MM/YYYY HH:mm'),
    },
  ]

  return (
    <SmartTable<NotificationHistory>
      rowKey="id"
      columns={columns}
      dataSource={data}
      loading={loading}
      pagination={{
        current: page,
        pageSize: PAGE_SIZE,
        total,
        onChange: setPage,
        showSizeChanger: false,
      }}
    />
  )
}

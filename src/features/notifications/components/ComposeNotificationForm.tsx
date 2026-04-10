import { Button, Form, Input, Modal, Radio, Select, message } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { supabase } from '@/shared/lib/supabaseClient'

const { TextArea } = Input

interface FormValues {
  type: 'promotion' | 'system'
  target: 'all' | 'specific'
  customer_ids: number[]
  title: string
  body: string
  link: string
}

interface CustomerOption {
  value: number
  label: string
}

export function ComposeNotificationForm({ onSent }: { onSent?: () => void }) {
  const [form] = Form.useForm<FormValues>()
  const [sending, setSending] = useState(false)
  const [target, setTarget] = useState<'all' | 'specific'>('all')
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  async function searchCustomers(search: string) {
    if (search.length < 2) return
    setSearchLoading(true)
    const { data } = await supabase
      .from('customers_b2b')
      .select('id, name')
      .ilike('name', `%${search}%`)
      .limit(20)

    if (data) {
      setCustomers(data.map((c) => ({ value: c.id, label: c.name })))
    }
    setSearchLoading(false)
  }

  async function handleSubmit(values: FormValues) {
    Modal.confirm({
      title: 'Xác nhận gửi thông báo',
      content: `Gửi thông báo "${values.title}" tới ${values.target === 'all' ? 'tất cả khách hàng' : `${values.customer_ids.length} khách hàng`}?`,
      okText: 'Gửi',
      cancelText: 'Hủy',
      onOk: async () => {
        setSending(true)

        const customerIds = values.target === 'all' ? [null] : values.customer_ids

        const results = await Promise.allSettled(
          customerIds.map((customerId) =>
            supabase.functions.invoke('notify', {
              body: {
                type: values.type,
                customer_b2b_id: customerId,
                title: values.title,
                body: values.body,
                data: values.link ? { link: values.link } : {},
              },
            })
          )
        )

        const failed = results.filter((r) => r.status === 'rejected')
        if (failed.length > 0) {
          message.warning(`Gửi thành công ${results.length - failed.length}/${results.length}`)
        } else {
          message.success('Đã gửi thông báo thành công')
        }

        form.resetFields()
        setTarget('all')
        setSending(false)
        onSent?.()
      },
    })
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{ type: 'promotion', target: 'all' }}
    >
      <Form.Item name="type" label="Loại thông báo" rules={[{ required: true }]}>
        <Radio.Group>
          <Radio.Button value="promotion">Khuyến mãi</Radio.Button>
          <Radio.Button value="system">Hệ thống</Radio.Button>
        </Radio.Group>
      </Form.Item>

      <Form.Item name="target" label="Đối tượng" rules={[{ required: true }]}>
        <Radio.Group onChange={(e) => setTarget(e.target.value)}>
          <Radio value="all">Tất cả khách hàng</Radio>
          <Radio value="specific">Chọn khách cụ thể</Radio>
        </Radio.Group>
      </Form.Item>

      {target === 'specific' && (
        <Form.Item
          name="customer_ids"
          label="Khách hàng"
          rules={[{ required: true, message: 'Chọn ít nhất 1 khách hàng' }]}
        >
          <Select
            mode="multiple"
            showSearch
            placeholder="Tìm tên khách hàng..."
            filterOption={false}
            onSearch={searchCustomers}
            loading={searchLoading}
            options={customers}
          />
        </Form.Item>
      )}

      <Form.Item
        name="title"
        label="Tiêu đề"
        rules={[
          { required: true, message: 'Nhập tiêu đề' },
          { max: 200, message: 'Tối đa 200 ký tự' },
        ]}
      >
        <Input placeholder="VD: Giảm 10% đơn trên 5 triệu" maxLength={200} />
      </Form.Item>

      <Form.Item
        name="body"
        label="Nội dung"
        rules={[
          { required: true, message: 'Nhập nội dung' },
          { max: 1000, message: 'Tối đa 1000 ký tự' },
        ]}
      >
        <TextArea
          rows={4}
          placeholder="Nội dung chi tiết thông báo..."
          maxLength={1000}
          showCount
        />
      </Form.Item>

      <Form.Item name="link" label="Link đính kèm (tùy chọn)">
        <Input placeholder="/san-pham hoặc URL" />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={sending}>
          Gửi thông báo
        </Button>
      </Form.Item>
    </Form>
  )
}

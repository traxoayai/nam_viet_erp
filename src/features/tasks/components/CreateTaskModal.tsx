
import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker } from 'antd';
import { useTaskBoard } from '../hooks/useTaskBoard';
import { safeRpc } from '@/shared/lib/safeRpc';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import TextEditor from '@/shared/ui/common/TextEditor';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const CreateTaskModal: React.FC<Props> = ({ open, onClose }) => {
  const [form] = Form.useForm();
  const { createTaskMutation } = useTaskBoard();
  const { user } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      // Gọi RPC thay vì query table trực tiếp
      const { data } = await safeRpc('get_users_with_roles');
      if (data) setUsers(data);
    };
    if (open) fetchUsers();
  }, [open]);

  const handleSubmit = async (values: any) => {
    try {
      await createTaskMutation.mutateAsync({
        ...values,
        due_date: values.due_date?.toISOString(),
        status: 'todo',
        assigner_id: user?.id || null,
      });
      form.resetFields();
      onClose();
    } catch (error: any) {
      // Error is already handled by mutation's onError
    }
  };

  return (
    <Modal
      title={<h3 className="text-xl font-bold text-gray-800 m-0">Giao Việc Mới</h3>}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Tạo Công Việc"
      cancelText="Hủy"
      okButtonProps={{ size: 'large', className: 'rounded-lg shadow-md font-medium' }}
      cancelButtonProps={{ size: 'large', className: 'rounded-lg' }}
      className="rounded-xl overflow-hidden"
      width={800}
      styles={{
        content: { borderRadius: '16px', padding: '24px' },
        header: { marginBottom: '20px' }
      }}
      confirmLoading={createTaskMutation.isPending}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ priority: 'medium' }}
        className="mt-4"
        size="large"
      >
        <Form.Item
          name="title"
          label={<span className="font-semibold text-gray-700">Tên công việc</span>}
          rules={[{ required: true, message: 'Vui lòng nhập tên công việc' }]}
        >
          <Input placeholder="Nhập tiêu đề công việc..." className="rounded-lg" />
        </Form.Item>

        <Form.Item
          name="assignee_id"
          label={<span className="font-semibold text-gray-700">Người nhận việc</span>}
          rules={[{ required: true, message: 'Vui lòng chọn người nhận việc' }]}
        >
          <Select
            placeholder="Chọn nhân sự..."
            className="rounded-lg h-10"
            options={users.map(u => ({ 
              label: u.email ? `${u.name} (${u.email})` : u.name, 
              value: u.id 
            }))}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>

        <div className="grid grid-cols-2 gap-4">
          <Form.Item
            name="priority"
            label={<span className="font-semibold text-gray-700">Độ ưu tiên</span>}
            rules={[{ required: true }]}
          >
            <Select
              className="rounded-lg"
              options={[
                { label: 'Thấp (Low)', value: 'low' },
                { label: 'Trung bình (Medium)', value: 'medium' },
                { label: 'Cao (High)', value: 'high' },
                { label: 'Khẩn cấp (Urgent)', value: 'urgent' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="due_date"
            label={<span className="font-semibold text-gray-700">Hạn chót</span>}
            rules={[{ required: true, message: 'Vui lòng chọn hạn chót' }]}
          >
            <DatePicker className="w-full rounded-lg" format="DD/MM/YYYY" placeholder="Chọn ngày" />
          </Form.Item>
        </div>

        <Form.Item
          name="description"
          label={<span className="font-semibold text-gray-700">Ghi chú / Mô tả chi tiết (Tùy chọn)</span>}
          className="mb-0"
        >
          <TextEditor height={300} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// src/features/connect/components/CreatePostModal.tsx
import { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, Switch, InputNumber, Select, Upload, message } from 'antd';
import { UploadOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';
import { useConnectStore } from '../hooks/useConnectStore';
import { connectService } from '../api/connectService';
import TextEditor from '@/shared/ui/common/TextEditor'; // Component Sếp đã cung cấp

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({ open, onClose }) => {
  const [form] = Form.useForm();
  const { activeTab, fetchPosts, editingPost } = useConnectStore();
  const [submitting, setSubmitting] = useState(false);

  // Reset form khi mở và set category mặc định theo Tab đang đứng
  useEffect(() => {
    if (open) {
      if (editingPost) {
        // CHẾ ĐỘ SỬA: Fill data cũ
        form.setFieldsValue({
          category: editingPost.category,
          title: editingPost.title,
          content: editingPost.content,
          priority: editingPost.priority,
          must_confirm: editingPost.must_confirm,
          reward_points: editingPost.reward_points,
          is_anonymous: editingPost.is_anonymous,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ 
          category: activeTab === 'docs' ? 'news' : activeTab, // Docs tạm thời coi như News có đính kèm
          priority: 'normal',
          reward_points: 10
        });
      }
    }
  }, [open, activeTab, form, editingPost]);

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      if (editingPost) {
        // GỌI API UPDATE
        await connectService.updatePost(editingPost.id, {
            p_category: values.category,
            p_title: values.title,
            p_content: values.content || '',
            p_is_anonymous: values.is_anonymous,
            p_must_confirm: values.must_confirm,
            p_reward_points: values.reward_points
        });
        message.success('Cập nhật thành công!');
      } else {
        // Gọi API tạo bài
        await connectService.createPost({
          p_category: values.category,
          p_title: values.title,
          p_content: values.content || '',
          p_is_anonymous: values.is_anonymous || false,
          p_must_confirm: values.must_confirm || false,
          p_reward_points: values.reward_points || 0,
          // p_attachments: Handle upload logic here if needed
        });
        message.success('Đăng bài thành công!');
      }

      onClose();
      fetchPosts(activeTab); // Reload list
    } catch (error: any) {
      console.error(error);
      message.error('Lỗi: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isNews = activeTab === 'news' || activeTab === 'docs';

  return (
    <Modal
      title={editingPost ? "Chỉnh sửa bài viết" : (isNews ? "Soạn Thông Báo Mới" : "Gửi Ý Kiến Đóng Góp")}
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      centered
      maskClosable={false}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        {/* Hidden field category */}
        <Form.Item name="category" hidden><Input /></Form.Item>

        <Form.Item 
          name="title" 
          label="Tiêu đề" 
          rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
        >
          <Input placeholder={isNews ? "Vd: Thông báo nghỉ lễ 30/4..." : "Vd: Đề xuất thay đổi..."} size="large" />
        </Form.Item>

        <Form.Item 
          name="content" 
          label="Nội dung chi tiết"
          rules={[{ required: true, message: 'Vui lòng nhập nội dung' }]}
        >
          {/* Tích hợp TextEditor của Sếp */}
          <TextEditor /> 
        </Form.Item>

        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cấu hình cho News */}
          {isNews && (
            <>
              <Form.Item name="priority" label="Độ ưu tiên" style={{marginBottom: 0}}>
                <Select options={[
                  { label: 'Bình thường', value: 'normal' },
                  { label: 'Quan trọng (Gấp)', value: 'high' }
                ]} />
              </Form.Item>
              
              <Form.Item name="must_confirm" valuePropName="checked" style={{marginBottom: 0}} label="Yêu cầu xác nhận">
                <Switch checkedChildren="Có" unCheckedChildren="Không" />
              </Form.Item>

              <Form.Item 
                noStyle 
                shouldUpdate={(prev, curr) => prev.must_confirm !== curr.must_confirm}
              >
                {({ getFieldValue }) => 
                  getFieldValue('must_confirm') && (
                    <Form.Item name="reward_points" label="Điểm thưởng khi đọc" style={{marginBottom: 0}}>
                      <InputNumber min={0} addonAfter="Xu" />
                    </Form.Item>
                  )
                }
              </Form.Item>
            </>
          )}

          {/* Cấu hình cho Feedback */}
          {!isNews && (
            <Form.Item name="is_anonymous" valuePropName="checked" label="Chế độ danh tính" style={{marginBottom: 0}}>
               <Switch 
                  checkedChildren={<><UserOutlined /> Ẩn danh</>} 
                  unCheckedChildren={<><UserOutlined /> Công khai</>} 
                  defaultChecked 
               />
            </Form.Item>
          )}

          <Form.Item label="Đính kèm tệp" style={{marginBottom: 0}}>
             <Upload>
                <Button icon={<UploadOutlined />}>Chọn file</Button>
             </Upload>
          </Form.Item>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button onClick={onClose}>Hủy</Button>
          <Button type="primary" htmlType="submit" loading={submitting} icon={<SendOutlined />}>
            {editingPost ? 'Cập Nhật' : (isNews ? 'Đăng Thông Báo' : 'Gửi Ý Kiến')}
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

// src/features/booking/components/QuickCustomerModal.tsx
import React, { useEffect } from 'react';
import { Modal, Form, Input, DatePicker, Select } from 'antd';
import { BookingCustomer, useBookingResources } from '../hooks/useBookingResources';
import dayjs from 'dayjs';

interface QuickCustomerModalProps {
    open: boolean;
    onCancel: () => void;
    onSuccess: (newCustomerId?: number) => void;
    initialValues?: Partial<BookingCustomer>;
}

export const QuickCustomerModal: React.FC<QuickCustomerModalProps> = ({ 
    open, 
    onCancel, 
    onSuccess, 
    initialValues 
}) => {
    const [form] = Form.useForm();
    const { actions, loading } = useBookingResources();

    useEffect(() => {
        if (open) {
            if (initialValues) {
                form.setFieldsValue({
                    ...initialValues,
                    dob: initialValues.dob ? dayjs(initialValues.dob) : null
                });
            } else {
                form.resetFields();
            }
        }
    }, [open, initialValues, form]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            const payload = {
                name: values.name,
                phone: values.phone,
                gender: values.gender,
                address: values.address,
                dob: values.dob ? values.dob.format('YYYY-MM-DD') : null
            };

            let result;
            if (initialValues?.id) {
                // Update
                result = await actions.updateCustomer(initialValues.id, payload);
                if (result) {
                    onSuccess(initialValues.id);
                    onCancel();
                }
            } else {
                // Create
                result = await actions.createCustomer(payload); // returns new ID or object
                if (result) {
                    // result might be the ID directly or an object containing ID, depending on RPC.
                    // Based on logic in useBookingResources, createCustomer returns `data`, which is usually the ID or the object.
                    // Assuming create_customer_b2c returns the ID or object with id.
                    const newId = typeof result === 'object' ? result?.id : result; 
                    onSuccess(newId);
                    onCancel();
                }
            }
        } catch (error) {
            console.error(error);
            // message.error managed by hook
        }
    };

    return (
        <Modal
            title={initialValues?.id ? "Cập Nhật Thông Tin Khách Hàng" : "Thêm Khách Hàng Mới"}
            open={open}
            onCancel={onCancel}
            onOk={handleSubmit}
            confirmLoading={loading}
            destroyOnClose
        >
            <Form form={form} layout="vertical">
                <Form.Item 
                    name="name" 
                    label="Họ và tên" 
                    rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
                >
                    <Input placeholder="Nguyễn Văn A" />
                </Form.Item>

                <Form.Item 
                    name="phone" 
                    label="Số điện thoại" 
                    rules={[{ required: true, message: 'Vui lòng nhập SĐT' }]}
                >
                    <Input placeholder="090..." />
                </Form.Item>

                <Form.Item name="gender" label="Giới tính">
                    <Select placeholder="Chọn giới tính">
                        <Select.Option value="Nam">Nam</Select.Option>
                        <Select.Option value="Nữ">Nữ</Select.Option>
                    </Select>
                </Form.Item>

                <Form.Item name="dob" label="Ngày sinh">
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Chọn ngày sinh" />
                </Form.Item>

                <Form.Item name="address" label="Địa chỉ">
                    <Input.TextArea placeholder="Nhập địa chỉ..." rows={2} />
                </Form.Item>
            </Form>
        </Modal>
    );
};
